"use client";

import React, { useState } from "react";

import { approvalAction, type ApprovalItem, type ApprovalType, type ApprovalsResponse } from "@/lib/api/approvals";
import { useApiQuery } from "@/lib/api/query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ApprovalsQueue() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | ApprovalType>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch } = useApiQuery<ApprovalsResponse>(
    ["approvals", q, type, pageIndex, pageSize],
    `/admin/approvals?q=${encodeURIComponent(q)}&type=${type}&page=${pageIndex + 1}&limit=${pageSize}`
  );

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  async function runAction(item: ApprovalItem, action: "approve" | "reject" | "request-changes") {
    await approvalAction({
      type: item.type,
      id: item.id,
      action,
      feedback: feedbackById[item.id],
    });
    await refetch();
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPageIndex(0);
          }}
          placeholder="Search pending approvals"
          className="w-80"
        />
        <select
          className="select select-bordered"
          value={type}
          onChange={(e) => {
            setType(e.target.value as "all" | ApprovalType);
            setPageIndex(0);
          }}
        >
          <option value="all">All types</option>
          <option value="COURSE">Course</option>
          <option value="PROJECT">Project</option>
          <option value="ROADMAP">Roadmap</option>
          <option value="OFFER">Offer</option>
          <option value="SOLUTION">Solution</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <p>Loading approvals...</p>
      ) : isError ? (
        <p>Error loading approvals.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending approvals.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Title</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Submitted By</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Submitted</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Feedback</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="border-b hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 text-sm">{item.type}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{item.title}</div>
                      {item.feedback ? <div className="text-xs text-gray-500 mt-1">Last note: {item.feedback}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-sm">{item.submittedBy || "-"}</td>
                    <td className="px-4 py-3 text-sm">{item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "-"}</td>
                    <td className="px-4 py-3 text-sm min-w-64">
                      <textarea
                        className="textarea textarea-bordered w-full min-h-20"
                        placeholder="Optional feedback"
                        value={feedbackById[item.id] ?? ""}
                        onChange={(e) => setFeedbackById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-col gap-2 min-w-36">
                        <button className="btn btn-success btn-xs" onClick={() => runAction(item, "approve")}>Approve</button>
                        <button className="btn btn-warning btn-xs" onClick={() => runAction(item, "request-changes")}>Request Changes</button>
                        <button className="btn btn-error btn-xs" onClick={() => runAction(item, "reject")}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {Math.min(pageIndex * pageSize + 1, total)}-{Math.min((pageIndex + 1) * pageSize, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPageIndex(0);
                }}
                className="select select-bordered select-sm"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <Button size="sm" variant="outline" disabled={pageIndex === 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(pageIndex + 1) * pageSize >= total}
                onClick={() => setPageIndex((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
