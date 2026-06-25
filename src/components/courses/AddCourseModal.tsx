"use client";

import React, { useState } from "react";
import { createCourse } from "@/lib/api/courses";

type Props = { open: boolean; onClose: () => void; onCreated?: () => void };

export default function AddCourseModal({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [instructor, setInstructor] = useState("");
  const [tags, setTags] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [status, setStatus] = useState("DRAFT");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCourse({
        title,
        description,
        category,
        instructor,
        thumbnail,
        status,
        published: status === "PUBLISHED",
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      onCreated?.();
      onClose();
    } catch (err) {
      console.error(err);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow p-6 w-[540px]">
        <h2 className="text-lg font-semibold mb-4">New Course</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input input-bordered w-full" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm">Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} className="input input-bordered w-full" />
            </div>
            <div>
              <label className="block text-sm">Instructor</label>
              <input value={instructor} onChange={(e) => setInstructor(e.target.value)} className="input input-bordered w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm">Thumbnail URL</label>
            <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} className="input input-bordered w-full" />
          </div>
          <div>
            <label className="block text-sm">Tags</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="input input-bordered w-full" placeholder="react,frontend" />
          </div>
          <div>
            <label className="block text-sm">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea textarea-bordered w-full" />
          </div>
          <div>
            <label className="block text-sm">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="select select-bordered w-full"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}
