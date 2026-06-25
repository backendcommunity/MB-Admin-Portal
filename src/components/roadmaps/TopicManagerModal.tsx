'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApiQuery } from '@/lib/api/query';
import {
  addRoadmapTopic,
  fetchRoadmapTopics,
  linkCourseToRoadmapTopic,
  reorderRoadmapTopics,
  unlinkCourseFromRoadmapTopic,
  type RoadmapTopic,
} from '@/lib/api/roadmaps';

type Props = {
  open: boolean;
  roadmapId: string;
  onClose: () => void;
};

type CourseOption = { id: string; title: string };

export default function TopicManagerModal({ open, roadmapId, onClose }: Props) {
  const [topics, setTopics] = useState<RoadmapTopic[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const { data: coursesData } = useApiQuery<{ data: CourseOption[]; total: number }>(
    ['courses-for-roadmap-linking'],
    '/admin/courses?page=1&limit=200',
  );

  const courseOptions = useMemo(() => coursesData?.data || [], [coursesData]);

  useEffect(() => {
    if (!open) return;
    void fetchRoadmapTopics(roadmapId).then((res) => {
      setTopics(res.data || []);
      setSelectedTopicId((res.data || [])[0]?.id || '');
    });
  }, [open, roadmapId]);

  async function refreshTopics() {
    const res = await fetchRoadmapTopics(roadmapId);
    setTopics(res.data || []);
  }

  async function handleAddTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await addRoadmapTopic(roadmapId, { title: title.trim(), description: description.trim() });
    setTitle('');
    setDescription('');
    await refreshTopics();
  }

  async function moveTopic(topicId: string, direction: -1 | 1) {
    const currentIndex = topics.findIndex((t) => t.id === topicId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= topics.length) return;

    const next = [...topics];
    const temp = next[currentIndex];
    next[currentIndex] = next[targetIndex];
    next[targetIndex] = temp;

    setTopics(next);
    await reorderRoadmapTopics(
      roadmapId,
      next.map((t) => t.id),
    );
    await refreshTopics();
  }

  async function handleLinkCourse() {
    if (!selectedTopicId || !selectedCourseId) return;
    await linkCourseToRoadmapTopic(roadmapId, selectedTopicId, selectedCourseId);
    setSelectedCourseId('');
    await refreshTopics();
  }

  async function handleUnlinkCourse(topicId: string, courseId: string) {
    await unlinkCourseFromRoadmapTopic(roadmapId, topicId, courseId);
    await refreshTopics();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Topic Manager</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <form onSubmit={handleAddTopic} className="space-y-2 border border-border rounded p-3">
              <h3 className="font-medium">Add Topic</h3>
              <div className="space-y-1.5">
                <Label htmlFor="topicTitle">Topic Title</Label>
                <Input
                  id="topicTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Topic title"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="topicDescription">Description</Label>
                <textarea
                  id="topicDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Topic description"
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button type="submit" size="sm">
                Add Topic
              </Button>
            </form>

            <div className="border border-border rounded p-3 space-y-2">
              <h3 className="font-medium">Topics</h3>
              {topics.length === 0 ? (
                <p className="text-sm text-muted-foreground">No topics yet.</p>
              ) : null}
              {topics.map((topic, index) => (
                <div key={topic.id} className="border border-border rounded p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{topic.title}</div>
                      <div className="text-xs text-muted-foreground">Order: {index + 1}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => moveTopic(topic.id, -1)}>
                        Up
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => moveTopic(topic.id, 1)}>
                        Down
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-border rounded p-3 space-y-2">
              <h3 className="font-medium">Topic-Course Linking</h3>
              <div className="space-y-1.5">
                <Label htmlFor="selectTopic">Select Topic</Label>
                <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                  <SelectTrigger id="selectTopic">
                    <SelectValue placeholder="Select topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="selectCourse">Select Course</Label>
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger id="selectCourse">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courseOptions.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleLinkCourse}>
                Link Course
              </Button>
            </div>

            <div className="border border-border rounded p-3 space-y-2">
              <h3 className="font-medium">Linked Courses Per Topic</h3>
              {topics.map((topic) => (
                <div key={topic.id} className="border border-border rounded p-2">
                  <p className="font-medium text-sm mb-1">{topic.title}</p>
                  {topic.courseLinks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No linked courses.</p>
                  ) : null}
                  <div className="space-y-1">
                    {topic.courseLinks.map((course) => (
                      <div
                        key={course.courseId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{course.title || course.courseId}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleUnlinkCourse(topic.id, course.courseId)}
                        >
                          Unlink
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
