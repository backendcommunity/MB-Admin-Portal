"use client";

import React, { useEffect, useMemo, useState } from "react";

import { useApiQuery } from "@/lib/api/query";
import {
  addRoadmapTopic,
  fetchRoadmapTopics,
  linkCourseToRoadmapTopic,
  reorderRoadmapTopics,
  unlinkCourseFromRoadmapTopic,
  type RoadmapTopic,
} from "@/lib/api/roadmaps";

type Props = {
  open: boolean;
  roadmapId: string;
  onClose: () => void;
};

type CourseOption = { id: string; title: string };

export default function TopicManagerModal({ open, roadmapId, onClose }: Props) {
  const [topics, setTopics] = useState<RoadmapTopic[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const { data: coursesData } = useApiQuery<{ data: CourseOption[]; total: number }>(
    ["courses-for-roadmap-linking"],
    "/admin/courses?page=1&limit=200"
  );

  const courseOptions = useMemo(() => coursesData?.data || [], [coursesData]);

  useEffect(() => {
    if (!open) return;
    void fetchRoadmapTopics(roadmapId).then((res) => {
      setTopics(res.data || []);
      setSelectedTopicId((res.data || [])[0]?.id || "");
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
    setTitle("");
    setDescription("");
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
    await reorderRoadmapTopics(roadmapId, next.map((t) => t.id));
    await refreshTopics();
  }

  async function handleLinkCourse() {
    if (!selectedTopicId || !selectedCourseId) return;
    await linkCourseToRoadmapTopic(roadmapId, selectedTopicId, selectedCourseId);
    setSelectedCourseId("");
    await refreshTopics();
  }

  async function handleUnlinkCourse(topicId: string, courseId: string) {
    await unlinkCourseFromRoadmapTopic(roadmapId, topicId, courseId);
    await refreshTopics();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow p-6 w-[900px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold">Topic Manager</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <form onSubmit={handleAddTopic} className="space-y-2 border rounded p-3">
              <h3 className="font-medium">Add Topic</h3>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="input input-bordered w-full" placeholder="Topic title" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea textarea-bordered w-full" placeholder="Topic description" />
              <button type="submit" className="btn btn-primary btn-sm">Add Topic</button>
            </form>

            <div className="border rounded p-3 space-y-2">
              <h3 className="font-medium">Topics</h3>
              {topics.length === 0 ? <p className="text-sm text-gray-500">No topics yet.</p> : null}
              {topics.map((topic, index) => (
                <div key={topic.id} className="border rounded p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{topic.title}</div>
                      <div className="text-xs text-gray-500">Order: {index + 1}</div>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn btn-xs" onClick={() => moveTopic(topic.id, -1)}>Up</button>
                      <button className="btn btn-xs" onClick={() => moveTopic(topic.id, 1)}>Down</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="border rounded p-3 space-y-2">
              <h3 className="font-medium">Topic-Course Linking</h3>
              <select className="select select-bordered w-full" value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)}>
                <option value="">Select topic</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>{topic.title}</option>
                ))}
              </select>
              <select className="select select-bordered w-full" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
                <option value="">Select course</option>
                {courseOptions.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleLinkCourse}>Link Course</button>
            </div>

            <div className="border rounded p-3 space-y-2">
              <h3 className="font-medium">Linked Courses Per Topic</h3>
              {topics.map((topic) => (
                <div key={topic.id} className="border rounded p-2">
                  <p className="font-medium text-sm mb-1">{topic.title}</p>
                  {topic.courseLinks.length === 0 ? <p className="text-xs text-gray-500">No linked courses.</p> : null}
                  <div className="space-y-1">
                    {topic.courseLinks.map((course) => (
                      <div key={course.courseId} className="flex items-center justify-between text-sm">
                        <span>{course.title || course.courseId}</span>
                        <button className="btn btn-xs btn-ghost text-red-600" onClick={() => handleUnlinkCourse(topic.id, course.courseId)}>Unlink</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
