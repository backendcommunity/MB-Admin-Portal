"use client";

import React, { useEffect, useState } from "react";
import { useApiMutation } from "@/lib/api/query";
import type { Cohort } from "@/lib/api/cohorts";

type Props = { open: boolean; cohort?: Cohort | null; onClose: () => void; onUpdated?: () => void };

export default function EditCohortModal({ open, cohort, onClose, onUpdated }: Props) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (cohort) {
      setName(cohort.name || "");
      setStartDate(cohort.startDate || "");
      setEndDate(cohort.endDate || "");
      setActive(Boolean(cohort.active));
    }
  }, [cohort]);

  const mutation = useApiMutation<Cohort, { id: number; name?: string; startDate?: string; endDate?: string; active?: boolean }>({ url: "/cohorts", method: "put" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cohort) return;
    try {
      await mutation.mutateAsync({ id: cohort.id, name, startDate, endDate, active });
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
        <h2 className="text-lg font-semibold mb-4">Edit Cohort</h2>
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
          <div className="flex items-center gap-2">
            <input id="active_cohort" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <label htmlFor="active_cohort">Active</label>
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
