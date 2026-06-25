"use client";

import React, { useState } from "react";
import { createBootcamp } from "@/lib/api/bootcamps";

type Props = { open: boolean; onClose: () => void; onCreated?: () => void };

export default function AddBootcampModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createBootcamp({ name, location });
      onCreated?.();
      onClose();
    } catch (err) {
      console.error(err);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow p-6 w-[520px]">
        <h2 className="text-lg font-semibold mb-4">New Bootcamp</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input input-bordered w-full" />
          </div>
          <div>
            <label className="block text-sm">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="input input-bordered w-full" />
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
