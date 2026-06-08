"use client";

import React, { useState } from "react";
import { useApiMutation } from "@/lib/api/query";

type Props = { open: boolean; bootcampId: number; onClose: () => void; onCreated?: () => void };

export default function AddCohortModal({ open, bootcampId, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const mutation = useApiMutation<{ id: number; name: string }, { bootcampId: number; name: string; startDate?: string; endDate?: string }>({ url: "/cohorts", method: "post" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ bootcampId, name, startDate, endDate });
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
        <h2 className="text-lg font-semibold mb-4">New Cohort</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input input-bordered w-full" />
          </div>
          <div>
            <label className="block text-sm">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input input-bordered w-full" />
          </div>
          <div>
            <label className="block text-sm">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input input-bordered w-full" />
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
