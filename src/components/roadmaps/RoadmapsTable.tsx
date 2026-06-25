"use client";

import React, { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import { useApiQuery } from "@/lib/api/query";
import { deleteRoadmap, type Roadmap, type RoadmapsListResponse } from "@/lib/api/roadmaps";
import AddRoadmapModal from "@/components/roadmaps/AddRoadmapModal";
import EditRoadmapModal from "@/components/roadmaps/EditRoadmapModal";
import TopicManagerModal from "@/components/roadmaps/TopicManagerModal";
import ConfirmDelete from "@/components/users/ConfirmDelete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function RoadmapsTable() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Roadmap | null>(null);
  const [managingTopicsFor, setManagingTopicsFor] = useState<Roadmap | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortParam = sorting[0]
    ? `&sort=${sorting[0].id}&order=${sorting[0].desc ? "desc" : "asc"}`
    : "";
  const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
  const difficultyParam = difficultyFilter !== "all" ? `&difficulty=${difficultyFilter}` : "";

  const { data, isLoading, isError, refetch } = useApiQuery<RoadmapsListResponse>(
    ["roadmaps", pageIndex, pageSize, q, statusFilter, difficultyFilter, sorting],
    `/admin/roadmaps?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(q)}${statusParam}${difficultyParam}${sortParam}`
  );

  const roadmaps = data?.data || [];
  const total = data?.total || 0;

  const columns = useMemo<ColumnDef<Roadmap, unknown>[]>(
    () => [
      { accessorKey: "title", header: "Title" },
      { accessorKey: "difficulty", header: "Difficulty" },
      { accessorKey: "topicsCount", header: "Topics" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge className={row.original.status === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium" onClick={() => setManagingTopicsFor(row.original)}>
              Topics
            </button>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium" onClick={() => setEditing(row.original)}>
              Edit
            </button>
            <button className="text-red-600 hover:text-red-800 text-sm font-medium" onClick={() => setDeletingId(row.original.id)}>
              Delete
            </button>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: roadmaps,
    columns,
    pageCount: Math.ceil(total / pageSize) || -1,
    state: { pagination: { pageIndex, pageSize }, sorting },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex ?? 0);
      setPageSize(next.pageSize ?? pageSize);
    },
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search roadmaps"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPageIndex(0);
            }}
            className="w-72"
          />
          <select
            className="select select-bordered"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPageIndex(0);
            }}
          >
            <option value="all">All status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <select
            className="select select-bordered"
            value={difficultyFilter}
            onChange={(e) => {
              setDifficultyFilter(e.target.value);
              setPageIndex(0);
            }}
          >
            <option value="all">All difficulty</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>

        <Button className="bg-blue-600 hover:bg-blue-700 text-white" size="sm" onClick={() => setShowAdd(true)}>
          New Roadmap
        </Button>
      </div>

      {isLoading ? (
        <p>Loading...</p>
      ) : isError ? (
        <p>Error loading roadmaps.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="text-left px-4 py-3 text-sm font-semibold">
                        {header.isPlaceholder
                          ? null
                          : (
                            <div
                              onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                              style={{ cursor: header.column.getCanSort() ? "pointer" : undefined }}
                              className="flex items-center gap-2"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <span className="text-xs">
                                {header.column.getIsSorted() === "asc"
                                  ? "↑"
                                  : header.column.getIsSorted() === "desc"
                                    ? "↓"
                                    : ""}
                              </span>
                            </div>
                          )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600">
              Showing {Math.min(pageIndex * pageSize + 1, total)}-{Math.min((pageIndex + 1) * pageSize, total)} of {total}
            </div>
            <div className="flex gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                  table.setPageIndex(0);
                }}
                className="select select-bordered select-sm"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <Button variant="outline" size="sm" onClick={() => table.setPageIndex(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0}>
                Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.setPageIndex(pageIndex + 1)} disabled={(pageIndex + 1) * pageSize >= total}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <AddRoadmapModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false);
          setPageIndex(0);
          refetch();
        }}
      />

      <EditRoadmapModal
        open={Boolean(editing)}
        roadmap={editing}
        onClose={() => setEditing(null)}
        onUpdated={() => {
          setEditing(null);
          refetch();
        }}
      />

      {managingTopicsFor ? (
        <TopicManagerModal
          open={Boolean(managingTopicsFor)}
          roadmapId={managingTopicsFor.id}
          onClose={() => {
            setManagingTopicsFor(null);
            refetch();
          }}
        />
      ) : null}

      <ConfirmDelete
        open={Boolean(deletingId)}
        title="Delete roadmap"
        description={`Permanently delete roadmap ${deletingId}?`}
        onCancel={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await deleteRoadmap(deletingId);
            setDeletingId(null);
            setPageIndex(0);
            refetch();
          } catch (err) {
            console.error(err);
          }
        }}
      />
    </Card>
  );
}
