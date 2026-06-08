"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { axiosInstance } from "@/lib/api/axios";
import { useApiMutation, useApiQuery } from "@/lib/api/query";

type Chapter = {
  id: number;
  title: string;
  type: "video" | "article";
  published: boolean;
  videoId?: string;
  content?: string;
};

type CourseDetail = {
  id: number;
  title: string;
  description: string;
  published: boolean;
  category: string;
  instructor: string;
  tags: string[];
  thumbnail?: string;
  enrolledCount: number;
  chapters: Chapter[];
  chaptersCount: number;
};

const lessonTypes = ["video", "article"] as const;

export default function CourseDetailClient({ courseId }: { courseId: number }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [instructor, setInstructor] = useState("");
  const [tags, setTags] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [published, setPublished] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterType, setNewChapterType] = useState<(typeof lessonTypes)[number]>("video");
  const [newChapterVideoId, setNewChapterVideoId] = useState("");
  const [newChapterContent, setNewChapterContent] = useState("");
  const [message, setMessage] = useState("");

  const { data: course, isLoading, isError, refetch } = useApiQuery<CourseDetail>(
    ["course", courseId],
    `/courses/${courseId}`
  );

  const saveMutation = useApiMutation<CourseDetail, Partial<CourseDetail> & { id: number }>({
    url: `/courses/${courseId}`,
    method: "put",
  });

  const initialised = useMemo(() => Boolean(course), [course]);

  React.useEffect(() => {
    if (!course || initialised === false) return;
    setTitle(course.title || "");
    setDescription(course.description || "");
    setCategory(course.category || "");
    setInstructor(course.instructor || "");
    setTags((course.tags || []).join(", "));
    setThumbnail(course.thumbnail || "");
    setPublished(Boolean(course.published));
  }, [course, initialised]);

  async function handleSave() {
    if (!course) return;
    await saveMutation.mutateAsync({
      id: course.id,
      title,
      description,
      category,
      instructor,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      thumbnail,
      published,
    });
    setMessage("Course updated");
    await refetch();
  }

  async function handleDelete() {
    await axiosInstance.delete(`/courses/${courseId}`);
    router.push("/courses");
  }

  async function handleAddChapter() {
    await axiosInstance.post(`/courses/${courseId}/chapters`, {
      title: newChapterTitle,
      type: newChapterType,
      videoId: newChapterVideoId,
      content: newChapterContent,
    });
    setNewChapterTitle("");
    setNewChapterVideoId("");
    setNewChapterContent("");
    await refetch();
  }

  async function moveChapter(chapterId: number, direction: -1 | 1) {
    if (!course) return;
    const index = course.chapters.findIndex((chapter) => chapter.id === chapterId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= course.chapters.length) return;
    const reordered = [...course.chapters];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    await axiosInstance.patch(`/courses/${courseId}/chapters`, {
      action: "reorder",
      orderedIds: reordered.map((chapter) => chapter.id),
    });
    await refetch();
  }

  async function toggleChapterPublished(chapter: Chapter) {
    await axiosInstance.put(`/courses/${courseId}/chapters`, {
      chapterId: chapter.id,
      published: !chapter.published,
      title: chapter.title,
      type: chapter.type,
      videoId: chapter.videoId,
      content: chapter.content,
    });
    await refetch();
  }

  async function deleteChapter(chapterId: number) {
    await axiosInstance.delete(`/courses/${courseId}/chapters`, {
      params: { chapterId },
    });
    await refetch();
  }

  if (isLoading) {
    return <div className="p-6">Loading course...</div>;
  }

  if (isError || !course) {
    return (
      <div className="p-6 space-y-4">
        <p>Course not found.</p>
        <Link href="/courses" className="btn btn-sm btn-primary">
          Back to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{course.title}</h1>
            <span className={course.published ? "badge badge-success" : "badge badge-ghost"}>
              {course.published ? "Published" : "Draft"}
            </span>
            <span className="badge badge-outline">{course.category}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {course.instructor} · {course.chaptersCount} chapters · {course.enrolledCount} enrolled
          </p>
        </div>
        <Link href="/courses" className="btn btn-sm btn-ghost">
          Back to courses
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border bg-white p-4 space-y-4">
          <h2 className="text-lg font-semibold">Rich Course Editor</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm">Title</label>
              <input className="input input-bordered w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm">Category</label>
              <input className="input input-bordered w-full" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm">Instructor</label>
              <input className="input input-bordered w-full" value={instructor} onChange={(e) => setInstructor(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm">Thumbnail URL</label>
              <input className="input input-bordered w-full" value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm">Tags</label>
            <input
              className="input input-bordered w-full"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="react, frontend, hooks"
            />
          </div>
          <div>
            <label className="block text-sm">Description</label>
            <textarea
              className="textarea textarea-bordered w-full min-h-40"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rich text placeholder for TipTap in Week 2"
            />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Published
          </label>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={handleSave}>
              Save changes
            </button>
            <button className="btn btn-ghost text-red-600" onClick={handleDelete}>
              Delete course
            </button>
          </div>
          {message ? <p className="text-sm text-sky-700">{message}</p> : null}
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-4">
          <h2 className="text-lg font-semibold">Course Summary</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Chapters:</span> {course.chaptersCount}</p>
            <p><span className="font-medium">Enrolled:</span> {course.enrolledCount}</p>
            <p><span className="font-medium">Published:</span> {course.published ? "Yes" : "No"}</p>
            <p><span className="font-medium">Tags:</span> {course.tags.join(", ") || "—"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold">Chapter Manager</h2>
          <div className="text-sm text-muted-foreground">Use up/down controls to reorder chapters.</div>
        </div>

        <div className="grid gap-3 md:grid-cols-[2fr_160px_160px_1fr_auto]">
          <input
            className="input input-bordered"
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
            placeholder="Chapter title"
          />
          <select className="select select-bordered" value={newChapterType} onChange={(e) => setNewChapterType(e.target.value as "video" | "article") }>
            <option value="video">Video</option>
            <option value="article">Article</option>
          </select>
          <input
            className="input input-bordered"
            value={newChapterVideoId}
            onChange={(e) => setNewChapterVideoId(e.target.value)}
            placeholder="Vimeo ID"
          />
          <input
            className="input input-bordered"
            value={newChapterContent}
            onChange={(e) => setNewChapterContent(e.target.value)}
            placeholder="Article content placeholder"
          />
          <button className="btn btn-primary" onClick={handleAddChapter}>
            Add chapter
          </button>
        </div>

        <div className="space-y-3">
          {course.chapters.map((chapter, index) => (
            <div key={chapter.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="font-medium">{chapter.title}</p>
                <p className="text-xs text-muted-foreground">
                  {chapter.type} · {chapter.published ? "Published" : "Draft"}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <button className="btn btn-sm" onClick={() => moveChapter(chapter.id, -1)} disabled={index === 0}>
                  Up
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => moveChapter(chapter.id, 1)}
                  disabled={index === course.chapters.length - 1}
                >
                  Down
                </button>
                <button className="btn btn-sm btn-outline" onClick={() => toggleChapterPublished(chapter)}>
                  {chapter.published ? "Unpublish" : "Publish"}
                </button>
                <button className="btn btn-sm btn-ghost text-red-600" onClick={() => deleteChapter(chapter.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
