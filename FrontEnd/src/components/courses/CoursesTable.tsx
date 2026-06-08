"use client";

import React, { useMemo, useState } from "react";
import { useApiQuery } from "@/lib/api/query";
import { type Course } from "@/lib/api/courses";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import AddCourseModal from "@/components/courses/AddCourseModal";
import EditCourseModal from "@/components/courses/EditCourseModal";
import ConfirmDelete from "@/components/users/ConfirmDelete";
import { deleteCourse } from "@/lib/api/courses";
import Link from "next/link";

export default function CoursesTable() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sortParam = sorting[0]
    ? `&sort=${sorting[0].id}&order=${sorting[0].desc ? "desc" : "asc"}`
    : "";

  const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";

  const { data, isLoading, isError, refetch } = useApiQuery<{ data: Course[]; total: number }>(
    ["courses", pageIndex, pageSize, q, statusFilter, sorting],
    `/courses?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(q)}${statusParam}${sortParam}`
  );

  const courses: Course[] = data?.data || [];
  const total: number = data?.total || 0;

  const columns = useMemo<ColumnDef<Course, unknown>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "title", header: "Title" },
      { accessorKey: "category", header: "Category" },
      { accessorKey: "instructor", header: "Instructor" },
      { accessorKey: "chaptersCount", header: "Chapters" },
      { accessorKey: "enrolledCount", header: "Enrolled" },
      {
        accessorKey: "published",
        header: "Published",
        cell: (info) => (info.getValue() ? "Yes" : "No"),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Link className="btn btn-sm btn-ghost" href={`/courses/${row.original.id}`}>
              View
            </Link>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(row.original)}>
              Edit
            </button>
            <button className="btn btn-sm btn-ghost text-red-600" onClick={() => setDeletingId(row.original.id)}>
              Delete
            </button>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: courses,
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            placeholder="Search courses"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPageIndex(0);
            }}
            className="input input-bordered"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPageIndex(0);
            }}
            className="select select-bordered"
          >
            <option value="all">All status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
          <button className="btn btn-sm" onClick={() => refetch()}>
            Refresh
          </button>
        </div>
        <div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>New Course</button>
        </div>
      </div>

      {isLoading ? (
        <p>Loading...</p>
      ) : isError ? (
        <p>Error loading courses</p>
      ) : (
        <>
          <table className="w-full table-auto border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="text-left p-2">
                      {header.isPlaceholder ? null : (
                        <div
                          onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                          style={{ cursor: header.column.getCanSort() ? "pointer" : undefined }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span>
                            {header.column.getIsSorted() === "asc"
                              ? " 🔼"
                              : header.column.getIsSorted() === "desc"
                                ? " 🔽"
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
                <tr key={row.id} className="border-t">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between mt-4">
            <div>
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
              <button className="btn btn-sm" onClick={() => table.setPageIndex(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0}>Prev</button>
              <button className="btn btn-sm" onClick={() => table.setPageIndex(pageIndex + 1)} disabled={(pageIndex + 1) * pageSize >= total}>Next</button>
            </div>
          </div>
        </>
      )}

      <AddCourseModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={() => { setPageIndex(0); refetch(); }} />
      <EditCourseModal open={Boolean(editing)} course={editing} onClose={() => setEditing(null)} onUpdated={() => { setEditing(null); setPageIndex(0); refetch(); }} />
      <ConfirmDelete open={Boolean(deletingId)} title="Delete course" description={`Permanently delete course ${deletingId}?`} onCancel={() => setDeletingId(null)} onConfirm={async () => { if (!deletingId) return; try { await deleteCourse(deletingId); setDeletingId(null); setPageIndex(0); refetch(); } catch (err) { console.error(err); } }} />
    </div>
  );
}
