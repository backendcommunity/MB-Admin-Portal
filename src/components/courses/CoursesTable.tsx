"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useApiQuery } from "@/lib/api/query";
import { deleteCourse, updateCourse, type Course, type CoursesListResponse } from "@/lib/api/courses";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import AddCourseModal from "@/components/courses/AddCourseModal";
import EditCourseModal from "@/components/courses/EditCourseModal";
import ConfirmDelete from "@/components/users/ConfirmDelete";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function getCourseStatus(course: Course): "PUBLISHED" | "DRAFT" | "ARCHIVED" {
  const status = String(course.status || "").toUpperCase();
  if (status === "ARCHIVED") return "ARCHIVED";
  if (status === "PUBLISHED") return "PUBLISHED";
  return course.published ? "PUBLISHED" : "DRAFT";
}

export default function CoursesTable() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  const sortParam = sorting[0]
    ? `&sort=${sorting[0].id}&order=${sorting[0].desc ? "desc" : "asc"}`
    : "";

  const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";

  const { data, isLoading, isError, refetch } = useApiQuery<CoursesListResponse>(
    ["courses", pageIndex, pageSize, globalFilter, statusFilter, sorting],
    `/admin/courses?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(globalFilter)}${statusParam}${sortParam}`
  );

  const courses: Course[] = data?.data || [];
  const total: number = data?.total || 0;

  const selectedCourses = useMemo(
    () => Object.keys(rowSelection).filter((key) => rowSelection[key]).length,
    [rowSelection]
  );

  const bulkArchiveSelected = useCallback(async () => {
    const rows = table.getSelectedRowModel().rows;
    if (!rows.length) return;

    setIsBulkBusy(true);
    try {
      await Promise.all(
        rows.map((row) =>
          updateCourse({
            id: row.original.id,
            status: "ARCHIVED",
            published: false,
          })
        )
      );
      setRowSelection({});
      setPageIndex(0);
      await refetch();
    } catch (error) {
      console.error("Bulk archive failed:", error);
    } finally {
      setIsBulkBusy(false);
    }
  }, [refetch]);

  const columns = useMemo<ColumnDef<Course, unknown>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            ref={(input) => {
              if (input) {
                input.indeterminate = table.getIsSomePageRowsSelected();
              }
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="checkbox checkbox-sm"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="checkbox checkbox-sm"
          />
        ),
      },
      { accessorKey: "title", header: "Title" },
      { accessorKey: "category", header: "Category" },
      { accessorKey: "instructor", header: "Instructor" },
      { accessorKey: "chaptersCount", header: "Chapters" },
      { accessorKey: "enrolledCount", header: "Enrolled" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = getCourseStatus(row.original);
          const className =
            status === "PUBLISHED"
              ? "bg-green-100 text-green-800"
              : status === "ARCHIVED"
                ? "bg-gray-200 text-gray-800"
                : "bg-amber-100 text-amber-800";

          return <Badge className={className}>{status}</Badge>;
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Link className="text-blue-600 hover:text-blue-800 text-sm font-medium" href={`/courses/${row.original.id}`}>
              View
            </Link>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium" onClick={() => setEditing(row.original)}>
              Edit
            </button>
            <button
              className="text-yellow-700 hover:text-yellow-800 text-sm font-medium"
              onClick={async () => {
                try {
                  await updateCourse({
                    id: row.original.id,
                    status: getCourseStatus(row.original) === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED",
                    published: getCourseStatus(row.original) !== "PUBLISHED",
                  });
                  await refetch();
                } catch (error) {
                  console.error("Status update failed:", error);
                }
              }}
            >
              {getCourseStatus(row.original) === "PUBLISHED" ? "Archive" : "Publish"}
            </button>
            <button className="text-red-600 hover:text-red-800 text-sm font-medium" onClick={() => setDeletingId(row.original.id)}>
              Delete
            </button>
          </div>
        ),
      },
    ],
    [refetch]
  );

  const table = useReactTable({
    data: courses,
    columns,
    pageCount: Math.ceil(total / pageSize) || -1,
    state: { pagination: { pageIndex, pageSize }, sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex ?? 0);
      setPageSize(next.pageSize ?? pageSize);
    },
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card className="p-6">
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Search by title, category, or instructor..."
              value={globalFilter}
              onChange={(e) => {
                setGlobalFilter(e.target.value);
                setPageIndex(0);
              }}
            />
          </div>
          <Button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            Add Course
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPageIndex(0);
            }}
            className="select select-bordered select-sm"
          >
            <option value="all">All status</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <Button onClick={() => refetch()} variant="outline" size="sm">
            Refresh
          </Button>

          {selectedCourses > 0 && (
            <Button
              onClick={bulkArchiveSelected}
              disabled={isBulkBusy}
              variant="outline"
              size="sm"
              className="text-yellow-700"
            >
              Archive ({selectedCourses})
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : isError ? (
        <div className="alert alert-error">
          <span>Error loading courses. Please try again.</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No courses found</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-gray-100 border-b">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="text-left px-4 py-3 text-sm font-semibold">
                      {header.isPlaceholder ? null : (
                        <div
                          onClick={header.column.getToggleSortingHandler()}
                          style={{
                            cursor: header.column.getCanSort() ? "pointer" : undefined,
                          }}
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

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 gap-3">
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
              <Button variant="outline" size="sm" onClick={() => table.setPageIndex(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0}>Prev</Button>
              <Button variant="outline" size="sm" onClick={() => table.setPageIndex(pageIndex + 1)} disabled={(pageIndex + 1) * pageSize >= total}>Next</Button>
            </div>
          </div>
        </>
      )}

      <AddCourseModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={() => { setPageIndex(0); refetch(); }} />
      <EditCourseModal open={Boolean(editing)} course={editing} onClose={() => setEditing(null)} onUpdated={() => { setEditing(null); setPageIndex(0); refetch(); }} />
      <ConfirmDelete open={Boolean(deletingId)} title="Delete course" description={`Permanently delete course ${deletingId}?`} onCancel={() => setDeletingId(null)} onConfirm={async () => { if (!deletingId) return; try { await deleteCourse(deletingId); setDeletingId(null); setPageIndex(0); refetch(); } catch (err) { console.error(err); } }} />
    </Card>
  );
}
