"use client";

import React, { useMemo, useState } from "react";
import { useApiQuery } from "@/lib/api/query";
import type { Cohort, CohortsListResponse } from "@/lib/api/cohorts";
import AddCohortModal from "@/components/bootcamps/AddCohortModal";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = { bootcampId: string };

export default function CohortsTable({ bootcampId }: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showAdd, setShowAdd] = useState(false);

  const sortParam = sorting[0]
    ? `&sort=${sorting[0].id}&order=${sorting[0].desc ? "desc" : "asc"}`
    : "";
  const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";

  const { data, isLoading, isError, refetch } = useApiQuery<CohortsListResponse>(
    ["cohorts", bootcampId, pageIndex, pageSize, q, statusFilter, sorting],
    `/admin/bootcamps/${bootcampId}/cohorts?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(q)}${statusParam}${sortParam}`
  );

  const list = data?.data || [];
  const total = data?.total || 0;

  const columns = useMemo<ColumnDef<Cohort, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "startDate", header: "Start" },
      { accessorKey: "endDate", header: "End" },
      { accessorKey: "memberCount", header: "Members" },
      { accessorKey: "weekCount", header: "Weeks" },
      {
        accessorKey: "active",
        header: "Status",
        cell: (info) => (
          <Badge className={info.getValue() ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
            {info.getValue() ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            href={`/bootcamps/${bootcampId}/cohorts/${row.original.id}`}
          >
            Manage
          </Link>
        ),
      },
    ],
    [bootcampId]
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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search cohorts"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPageIndex(0);
            }}
            className="w-72"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPageIndex(0);
            }}
            className="select select-bordered select-sm"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
        </div>
        <div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" size="sm" onClick={() => setShowAdd(true)}>New Cohort</Button>
        </div>
      </div>

      {isLoading ? <p>Loading...</p> : isError ? <p>Error</p> : (
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

      <AddCohortModal open={showAdd} bootcampId={bootcampId} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); refetch(); }} />
    </Card>
  );
}
