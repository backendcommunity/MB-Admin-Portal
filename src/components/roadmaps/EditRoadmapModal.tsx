"use client";

import React, { useEffect, useState } from "react";

import type { Roadmap } from "@/lib/api/roadmaps";
import { updateRoadmap } from "@/lib/api/roadmaps";

type Props = {
  open: boolean;
  roadmap?: Roadmap | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export default function EditRoadmapModal({ open, roadmap, onClose, onUpdated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [status, setStatus] = useState("DRAFT");
  const [estimatedWeeks, setEstimatedWeeks] = useState(0);
  const [hoursPerWeek, setHoursPerWeek] = useState(0);
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (!roadmap) return;
    setTitle(roadmap.title || "");
    setDescription(roadmap.description || "");
    setDifficulty(roadmap.difficulty || "Beginner");
    setStatus(roadmap.status || "DRAFT");
    setEstimatedWeeks(Number(roadmap.estimatedWeeks || 0));
    setHoursPerWeek(Number(roadmap.hoursPerWeek || 0));
    setTags((roadmap.tags || []).join(", "));
  }, [roadmap]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roadmap) return;

    try {
      await updateRoadmap({
        id: roadmap.id,
        title,
        description,
        difficulty,
        status: status as "DRAFT" | "PUBLISHED",
        estimatedWeeks,
        hoursPerWeek,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow p-6 w-[560px] max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Edit Roadmap</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input input-bordered w-full" required />
          </div>
          <div>
            <label className="block text-sm">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea textarea-bordered w-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="select select-bordered w-full">
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="select select-bordered w-full">
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm">Estimated Weeks</label>
              <input type="number" value={estimatedWeeks} onChange={(e) => setEstimatedWeeks(Number(e.target.value))} className="input input-bordered w-full" />
            </div>
            <div>
              <label className="block text-sm">Hours/Week</label>
              <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} className="input input-bordered w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm">Skills Tags</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="input input-bordered w-full" placeholder="nodejs,postgresql" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
