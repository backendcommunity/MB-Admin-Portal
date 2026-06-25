"use client";

import React, { useEffect, useState } from "react";

import type { Project } from "@/lib/api/projects";
import { updateProject } from "@/lib/api/projects";

type Props = {
  open: boolean;
  project?: Project | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export default function EditProjectModal({ open, project, onClose, onUpdated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [status, setStatus] = useState("DRAFT");
  const [tags, setTags] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [thumbnail, setThumbnail] = useState("");

  useEffect(() => {
    if (!project) return;
    setTitle(project.title || "");
    setDescription(project.description || "");
    setDifficulty(project.difficulty || "Beginner");
    setStatus(project.status || "DRAFT");
    setTags((project.tags || []).join(", "));
    setGithubUrl(project.githubUrl || "");
    setLiveUrl(project.liveUrl || "");
    setThumbnail(project.thumbnail || "");
  }, [project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;

    try {
      await updateProject({
        id: project.id,
        title,
        description,
        difficulty,
        status: status as "DRAFT" | "PUBLISHED",
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        githubUrl,
        liveUrl,
        thumbnail,
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
        <h2 className="text-lg font-semibold mb-4">Edit Project</h2>
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
          <div>
            <label className="block text-sm">Tags</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="input input-bordered w-full" placeholder="nodejs,postgresql" />
          </div>
          <div>
            <label className="block text-sm">GitHub URL</label>
            <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className="input input-bordered w-full" />
          </div>
          <div>
            <label className="block text-sm">Live URL</label>
            <input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} className="input input-bordered w-full" />
          </div>
          <div>
            <label className="block text-sm">Thumbnail URL</label>
            <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} className="input input-bordered w-full" />
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
