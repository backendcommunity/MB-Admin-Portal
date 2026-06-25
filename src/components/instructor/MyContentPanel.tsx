"use client";

import React, { useMemo, useState } from "react";

import { submitMyContentForReview, createInstructorContent, type MyContentItem } from "@/lib/api/instructor";
import { useApiQuery } from "@/lib/api/query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MyContentPanel() {
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newContentType, setNewContentType] = useState("COURSE");
  const [newContentTitle, setNewContentTitle] = useState("");
  const [newContentDesc, setNewContentDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading, isError, refetch } = useApiQuery<{ data: { courses: MyContentItem[]; projects: MyContentItem[]; roadmaps: MyContentItem[] } }>(
    ["instructor-my-content"],
    "/instructor/my-content"
  );

  const rows = useMemo(
    () => [
      ...(data?.data?.courses || []),
      ...(data?.data?.projects || []),
      ...(data?.data?.roadmaps || []),
    ],
    [data]
  );

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Content</h2>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={() => setIsCreateModalOpen(true)}>Create Content</Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>

      {isLoading ? (
        <p>Loading your content...</p>
      ) : isError ? (
        <p>Failed to load your content.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No content found for your instructor account yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold">Type</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Title</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Difficulty</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Progress</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Review Notes</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.type}-${row.id}`} className="border-b hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 text-sm">{row.type}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium">{row.title}</div>
                    {row.feedback && row.status !== "APPROVED" && (
                      <div className="text-xs text-red-500 mt-1">Feedback: {row.feedback}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{row.difficulty || "-"}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${row.status === "APPROVED" ? "bg-green-100 text-green-700" : row.status === "PENDING_REVIEW" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700"}`}>
                      {row.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{row.progress}%</td>
                  <td className="px-4 py-3 text-sm min-w-64">
                    <textarea
                      className="textarea textarea-bordered w-full min-h-20"
                      placeholder="Optional note to reviewer"
                      value={notesById[row.id] ?? ""}
                      onChange={(e) => setNotesById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={row.status === "PENDING_REVIEW" || row.status === "APPROVED"}
                      onClick={async () => {
                        if (!window.confirm("Are you sure you want to submit this content for review?")) return;
                        
                        try {
                          await submitMyContentForReview({
                            id: row.id,
                            type: row.type,
                            notes: notesById[row.id],
                          });
                          await refetch();
                          alert("Successfully submitted for review!");
                        } catch (err: any) {
                          alert(err?.response?.data?.message || "Failed to submit for review.");
                        }
                      }}
                    >
                      {row.status === "PENDING_REVIEW" ? "Pending Review" : row.status === "APPROVED" ? "Approved" : "Submit for Review"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Content Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-xl font-semibold">Create Content</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <select 
                className="select select-bordered w-full"
                value={newContentType}
                onChange={(e) => setNewContentType(e.target.value)}
              >
                <option value="COURSE">Course</option>
                <option value="PROJECT">Project</option>
                <option value="ROADMAP">Roadmap</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <input 
                type="text"
                className="input input-bordered w-full"
                placeholder="Enter title..."
                value={newContentTitle}
                onChange={(e) => setNewContentTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea 
                className="textarea textarea-bordered w-full"
                placeholder="Enter short description..."
                value={newContentDesc}
                onChange={(e) => setNewContentDesc(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
              <Button 
                variant="default"
                disabled={isCreating || !newContentTitle.trim()}
                onClick={async () => {
                  try {
                    setIsCreating(true);
                    await createInstructorContent({
                      type: newContentType,
                      title: newContentTitle,
                      description: newContentDesc,
                    });
                    await refetch();
                    setIsCreateModalOpen(false);
                    setNewContentTitle("");
                    setNewContentDesc("");
                  } catch (err: any) {
                    alert(err?.response?.data?.message || "Failed to create content");
                  } finally {
                    setIsCreating(false);
                  }
                }}
              >
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
