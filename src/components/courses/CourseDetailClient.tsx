'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown } from 'lucide-react';

import { useApiQuery } from '@/lib/api/query';
import {
  createCourseChapter,
  deleteCourse,
  deleteCourseChapter,
  reorderCourseChapters,
  updateCourse,
  updateCourseChapter,
  type Chapter,
  type Course,
} from '@/lib/api/courses';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';

type CourseDetail = Course & { chapters?: Chapter[] };

const lessonTypes = ['video', 'article'] as const;

export default function CourseDetailClient() {
  const params = useParams();
  const router = useRouter();
  const courseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [instructor, setInstructor] = useState('');
  const [tags, setTags] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [published, setPublished] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterType, setNewChapterType] = useState<(typeof lessonTypes)[number]>('video');
  const [newChapterVideoId, setNewChapterVideoId] = useState('');
  const [newChapterContent, setNewChapterContent] = useState('');
  const [message, setMessage] = useState('');

  const {
    data: course,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<CourseDetail>(['course', courseId], `/admin/courses/${courseId}`, undefined, {
    enabled: Boolean(courseId),
  });

  const initialised = useMemo(() => Boolean(course), [course]);

  React.useEffect(() => {
    if (!course || initialised === false) return;
    setTitle(course.title || '');
    setDescription(course.description || '');
    setCategory(course.category || '');
    setInstructor(course.instructor || '');
    setTags((course.tags || []).join(', '));
    setThumbnail(course.thumbnail || '');
    setPublished(Boolean(course.published));
  }, [course, initialised]);

  async function handleSave() {
    if (!course || !courseId) return;
    await updateCourse({
      id: course.id,
      title,
      description,
      category,
      instructor,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      thumbnail,
      published,
      status: published ? 'PUBLISHED' : 'DRAFT',
    });
    setMessage('Course updated');
    await refetch();
  }

  async function handleDelete() {
    if (!courseId) return;
    await deleteCourse(courseId);
    router.push('/courses');
  }

  async function handleAddChapter() {
    if (!courseId) return;
    await createCourseChapter(courseId, {
      title: newChapterTitle,
      type: newChapterType,
      videoId: newChapterVideoId,
      content: newChapterContent,
    });
    setNewChapterTitle('');
    setNewChapterVideoId('');
    setNewChapterContent('');
    await refetch();
  }

  async function moveChapter(chapterId: string, direction: -1 | 1) {
    if (!course || !course.chapters || !courseId) return;
    const index = course.chapters.findIndex((chapter) => chapter.id === chapterId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= course.chapters.length) return;
    const reordered = [...course.chapters];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    await reorderCourseChapters(
      courseId,
      reordered.map((chapter) => chapter.id),
    );
    await refetch();
  }

  async function toggleChapterPublished(chapter: Chapter) {
    if (!courseId) return;
    await updateCourseChapter(courseId, {
      chapterId: chapter.id,
      published: !chapter.published,
      title: chapter.title,
      type: chapter.type,
      videoId: chapter.videoId,
      content: chapter.content,
    });
    await refetch();
  }

  async function deleteChapter(chapterId: string) {
    if (!courseId) return;
    await deleteCourseChapter(courseId, chapterId);
    await refetch();
  }

  if (!courseId) {
    return <div className="p-6 text-sm text-muted-foreground">Invalid course id.</div>;
  }

  if (isLoading) {
    return <LoadingState label="Loading course..." />;
  }

  if (isError || !course) {
    return (
      <div className="p-6 space-y-4">
        <ErrorState message="Course not found." />
        <Button variant="outline" asChild>
          <Link href="/courses">Back to courses</Link>
        </Button>
      </div>
    );
  }

  const headerActions = (
    <>
      <Button variant="outline" asChild>
        <Link href="/courses">Back to courses</Link>
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        description={`${course.instructor} · ${course.chaptersCount || course.chapters?.length || 0} chapters · ${course.enrolledCount || 0} enrolled`}
        actions={headerActions}
      />

      {/* Status badges */}
      <div className="flex gap-2 flex-wrap">
        <StatusBadge
          label={course.published ? 'Published' : 'Draft'}
          tone={course.published ? 'success' : 'neutral'}
        />
        {course.category ? <StatusBadge label={course.category} tone="info" /> : null}
      </div>

      {/* Main tabs: Overview (editor) vs Chapters */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Editor panel */}
            <Card>
              <CardHeader>
                <CardTitle>Rich Course Editor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="course-title">Title</Label>
                    <Input
                      id="course-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="course-category">Category</Label>
                    <Input
                      id="course-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="course-instructor">Instructor</Label>
                    <Input
                      id="course-instructor"
                      value={instructor}
                      onChange={(e) => setInstructor(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="course-thumbnail">Thumbnail URL</Label>
                    <Input
                      id="course-thumbnail"
                      value={thumbnail}
                      onChange={(e) => setThumbnail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="course-tags">Tags</Label>
                  <Input
                    id="course-tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="react, frontend, hooks"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="course-description">Description</Label>
                  <textarea
                    id="course-description"
                    className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Rich text placeholder for TipTap in Week 2"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={published} onCheckedChange={(v) => setPublished(!!v)} />
                  Published
                </label>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleSave}>Save changes</Button>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={handleDelete}
                  >
                    Delete course
                  </Button>
                </div>
                {message ? <p className="text-sm text-primary">{message}</p> : null}
              </CardContent>
            </Card>

            {/* Summary panel */}
            <Card>
              <CardHeader>
                <CardTitle>Course Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-foreground">
                <p>
                  <span className="font-medium">Chapters:</span>{' '}
                  {course.chaptersCount || course.chapters?.length || 0}
                </p>
                <p>
                  <span className="font-medium">Enrolled:</span> {course.enrolledCount || 0}
                </p>
                <p>
                  <span className="font-medium">Published:</span> {course.published ? 'Yes' : 'No'}
                </p>
                <p>
                  <span className="font-medium">Tags:</span> {course.tags?.join(', ') || '—'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="chapters">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Chapter Manager</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Use up/down controls to reorder chapters.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add chapter form */}
              <div className="grid gap-3 grid-cols-1 md:grid-cols-[2fr_160px_160px_1fr_auto]">
                <Input
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder="Chapter title"
                />
                <Select
                  value={newChapterType}
                  onValueChange={(v) => setNewChapterType(v as 'video' | 'article')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="article">Article</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={newChapterVideoId}
                  onChange={(e) => setNewChapterVideoId(e.target.value)}
                  placeholder="Vimeo ID"
                />
                <Input
                  value={newChapterContent}
                  onChange={(e) => setNewChapterContent(e.target.value)}
                  placeholder="Article content placeholder"
                />
                <Button onClick={handleAddChapter}>Add chapter</Button>
              </div>

              {/* Chapter list */}
              {(course.chapters || []).length === 0 ? (
                <EmptyState
                  title="No chapters yet"
                  description="Add the first chapter using the form above."
                />
              ) : (
                <div className="space-y-3">
                  {(course.chapters || []).map((chapter, index) => (
                    <div
                      key={chapter.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                    >
                      <div>
                        <p className="font-medium text-foreground">{chapter.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {chapter.type} · {chapter.published ? 'Published' : 'Draft'}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => moveChapter(chapter.id, -1)}
                          disabled={index === 0}
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => moveChapter(chapter.id, 1)}
                          disabled={index === (course.chapters?.length || 0) - 1}
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleChapterPublished(chapter)}
                        >
                          {chapter.published ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteChapter(chapter.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
