"use client";

import React, { useEffect, useState } from "react";
import type { Bootcamp } from "@/lib/api/bootcamps";
import { updateBootcamp } from "@/lib/api/bootcamps";

type Props = { open: boolean; bootcamp?: Bootcamp | null; onClose: () => void; onUpdated?: () => void };

export default function EditBootcampModal({ open, bootcamp, onClose, onUpdated }: Props) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (bootcamp) {
      setName(bootcamp.name || "");
      setLocation(bootcamp.location || "");
      setActive(Boolean(bootcamp.active));
    }
  }, [bootcamp]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bootcamp) return;
    try {
      await updateBootcamp({ id: bootcamp.id, name, location, active });
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow p-6 w-[520px]">
        <h2 className="text-lg font-semibold mb-4">Edit Bootcamp</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input input-bordered w-full" />
          </div>
          <div>
            <label className="block text-sm">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="input input-bordered w-full" />
          </div>
          <div className="flex items-center gap-2">
            <input id="active_bc" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <label htmlFor="active_bc">Active</label>
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
