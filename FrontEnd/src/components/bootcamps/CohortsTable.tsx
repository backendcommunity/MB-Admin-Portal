"use client";

import React, { useState } from "react";
import { useApiQuery } from "@/lib/api/query";
import type { Cohort } from "@/lib/api/cohorts";
import AddCohortModal from "@/components/bootcamps/AddCohortModal";
import EditCohortModal from "@/components/bootcamps/EditCohortModal";
import ConfirmDelete from "@/components/users/ConfirmDelete";
import { deleteCohort } from "@/lib/api/cohorts";
import Link from "next/link";

type Props = { bootcampId: number };

export default function CohortsTable({ bootcampId }: Props) {
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Cohort | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useApiQuery<{ data: Cohort[]; total: number }>(["cohorts", bootcampId, q], `/cohorts?bootcampId=${bootcampId}&q=${encodeURIComponent(q)}`);
  const list = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <input placeholder="Search cohorts" value={q} onChange={(e) => setQ(e.target.value)} className="input input-bordered" />
          <button className="btn btn-sm" onClick={() => refetch()}>Refresh</button>
        </div>
        <div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>New Cohort</button>
        </div>
      </div>

      {isLoading ? <p>Loading...</p> : isError ? <p>Error</p> : (
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Start</th>
              <th className="p-2 text-left">End</th>
              <th className="p-2 text-left">Members</th>
              <th className="p-2 text-left">Weeks</th>
              <th className="p-2 text-left">Active</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.id}</td>
                <td className="p-2">{c.name}</td>
                <td className="p-2">{c.startDate}</td>
                <td className="p-2">{c.endDate}</td>
                <td className="p-2">{(c as any).memberCount ?? 0}</td>
                <td className="p-2">{(c as any).weekCount ?? 0}</td>
                <td className="p-2">{c.active ? "Yes" : "No"}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <Link className="btn btn-sm btn-ghost" href={`/bootcamps/${bootcampId}/cohorts/${c.id}`}>
                      View
                    </Link>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(c)}>Edit</button>
                    <button className="btn btn-sm btn-ghost text-red-600" onClick={() => setDeletingId(c.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddCohortModal open={showAdd} bootcampId={bootcampId} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); refetch(); }} />
      <EditCohortModal open={Boolean(editing)} cohort={editing} onClose={() => setEditing(null)} onUpdated={() => { setEditing(null); refetch(); }} />
      <ConfirmDelete open={Boolean(deletingId)} title="Delete cohort" description={`Permanently delete cohort ${deletingId}?`} onCancel={() => setDeletingId(null)} onConfirm={async () => { if (!deletingId) return; try { await deleteCohort(deletingId); setDeletingId(null); refetch(); } catch (err) { console.error(err); } }} />
    </div>
  );
}
