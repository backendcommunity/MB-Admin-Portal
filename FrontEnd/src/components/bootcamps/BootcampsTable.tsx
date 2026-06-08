"use client";

import React, { useMemo, useState } from "react";
import { useApiQuery } from "@/lib/api/query";
import { type Bootcamp } from "@/lib/api/bootcamps";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import AddBootcampModal from "@/components/bootcamps/AddBootcampModal";
import EditBootcampModal from "@/components/bootcamps/EditBootcampModal";
import ConfirmDelete from "@/components/users/ConfirmDelete";
import { deleteBootcamp } from "@/lib/api/bootcamps";

export default function BootcampsTable() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Bootcamp | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sortParam = sorting[0]
    ? `&sort=${sorting[0].id}&order=${sorting[0].desc ? "desc" : "asc"}`
    : "";
  const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";

  const { data, isLoading, isError, refetch } = useApiQuery<{ data: Bootcamp[]; total: number }>(
    ["bootcamps", pageIndex, pageSize, q, statusFilter, sorting],
    `/bootcamps?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(q)}${statusParam}${sortParam}`
  );
  const list = data?.data || [];
  const total = data?.total || 0;

  const columns = useMemo<ColumnDef<Bootcamp, unknown>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "location", header: "Location" },
      {
        accessorKey: "active",
        header: "Active",
        cell: (info) => (info.getValue() ? "Yes" : "No"),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2 items-center">
            <a href={`/bootcamps/${row.original.id}/cohorts`} className="btn btn-sm btn-outline">Cohorts</a>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(row.original)}>Edit</button>
            <button className="btn btn-sm btn-ghost text-red-600" onClick={() => setDeletingId(row.original.id)}>Delete</button>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: list,
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
            placeholder="Search bootcamps"
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
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="btn btn-sm" onClick={() => refetch()}>Refresh</button>
        </div>
        <div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>New Bootcamp</button>
        </div>
      </div>

      {isLoading ? <p>Loading...</p> : isError ? <p>Error</p> : (
        <>
          <table className="w-full table-auto border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="p-2 text-left">
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

      <AddBootcampModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); setPageIndex(0); refetch(); }} />
      <EditBootcampModal open={Boolean(editing)} bootcamp={editing} onClose={() => setEditing(null)} onUpdated={() => { setEditing(null); setPageIndex(0); refetch(); }} />
      <ConfirmDelete open={Boolean(deletingId)} title="Delete bootcamp" description={`Permanently delete bootcamp ${deletingId}?`} onCancel={() => setDeletingId(null)} onConfirm={async () => { if (!deletingId) return; try { await deleteBootcamp(deletingId); setDeletingId(null); setPageIndex(0); refetch(); } catch (err) { console.error(err); } }} />
    </div>
  );
}
