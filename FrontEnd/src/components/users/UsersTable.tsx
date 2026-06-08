"use client";

import React, { useState, useMemo } from "react";
import { useApiQuery } from "@/lib/api/query";
import type { User } from "@/lib/api/users";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import AddUserModal from "@/components/users/AddUserModal";
import EditUserModal from "@/components/users/EditUserModal";
import ConfirmDelete from "@/components/users/ConfirmDelete";
import { deleteUser, suspendUserById } from "@/lib/api/users";
import Link from "next/link";

export default function UsersTable() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [globalFilter, setGlobalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  const queryKey = [
    "users",
    pageIndex,
    pageSize,
    globalFilter,
    roleFilter,
    statusFilter,
    sorting,
  ];

  const sortParam = sorting[0]
    ? `&sort=${sorting[0].id}&order=${sorting[0].desc ? "desc" : "asc"}`
    : "";

  const roleParam = roleFilter !== "all" ? `&role=${encodeURIComponent(roleFilter)}` : "";
  const statusParam =
    statusFilter !== "all" ? `&active=${statusFilter === "active" ? "true" : "false"}` : "";

  const { data, isLoading, isError, refetch } = useApiQuery<{
    data: User[];
    total: number;
  }>(
    queryKey,
    `/users?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(globalFilter)}${roleParam}${statusParam}${sortParam}`
  );

  const users: User[] = data?.data || [];
  const total: number = data?.total || 0;

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const columns = useMemo<ColumnDef<User, any>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "role", header: "Role" },
      { accessorKey: "active", header: "Active", cell: (info) => (info.getValue() ? "Yes" : "No") },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Link className="btn btn-sm btn-ghost" href={`/users/${row.original.id}`}>
              View
            </Link>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditingUser(row.original)}>
              Edit
            </button>
            <button
              className="btn btn-sm btn-ghost text-red-600"
              onClick={() => setDeletingId(row.original.id)}
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: users,
    columns,
    pageCount: Math.ceil(total / pageSize) || -1,
    state: { pagination: { pageIndex, pageSize }, sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex ?? 0);
      setPageSize(next.pageSize ?? pageSize);
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedUsers = useMemo(
    () => table.getSelectedRowModel().flatRows.map((row) => row.original),
    [table, rowSelection, users]
  );

  const exportSelectedCsv = () => {
    if (!selectedUsers.length) return;

    const rows = [
      ["id", "name", "email", "role", "active", "plan", "joinedAt"],
      ...selectedUsers.map((user) => [
        user.id,
        user.name,
        user.email,
        user.role,
        user.active ? "active" : "inactive",
        user.plan || "",
        user.joinedAt || "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "users-export.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const bulkSuspendSelected = async () => {
    if (!selectedUsers.length) return;
    setIsBulkBusy(true);
    try {
      await Promise.all(selectedUsers.map((user) => suspendUserById(user.id, false)));
      setRowSelection({});
      setPageIndex(0);
      refetch();
    } catch (error) {
      console.error(error);
    } finally {
      setIsBulkBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            placeholder="Search users"
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              setPageIndex(0);
            }}
            className="input input-bordered"
          />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPageIndex(0);
            }}
            className="select select-bordered"
          >
            <option value="all">All roles</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="ADMIN">ADMIN</option>
            <option value="INSTRUCTOR">INSTRUCTOR</option>
          </select>
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
          <button className="btn btn-sm" onClick={() => refetch()}>
            Refresh
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={bulkSuspendSelected}
            disabled={!selectedUsers.length || isBulkBusy}
          >
            Bulk suspend ({selectedUsers.length})
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={exportSelectedCsv}
            disabled={!selectedUsers.length}
          >
            Export CSV ({selectedUsers.length})
          </button>
        </div>
        <div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            Add User
          </button>
        </div>
      </div>

      {isLoading ? (
        <p>Loading...</p>
      ) : isError ? (
        <p>Error loading users</p>
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
                          {...{
                            onClick: header.column.getToggleSortingHandler(),
                            style: { cursor: header.column.getCanSort() ? "pointer" : undefined },
                          }}
                        >
                          {header.column.id === "select" ? (
                            <input
                              type="checkbox"
                              checked={table.getIsAllPageRowsSelected()}
                              ref={(input) => {
                                if (input) {
                                  input.indeterminate = table.getIsSomePageRowsSelected();
                                }
                              }}
                              onChange={table.getToggleAllPageRowsSelectedHandler()}
                            />
                          ) : null}
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span>
                            {header.column.getIsSorted() === "asc" ? " 🔼" : header.column.getIsSorted() === "desc" ? " 🔽" : ""}
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
              <button
                className="btn btn-sm"
                onClick={() => table.setPageIndex(Math.max(0, pageIndex - 1))}
                disabled={pageIndex === 0}
              >
                Prev
              </button>
              <button
                className="btn btn-sm"
                onClick={() => table.setPageIndex(pageIndex + 1)}
                disabled={(pageIndex + 1) * pageSize >= total}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <AddUserModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setPageIndex(0);
          refetch();
        }}
      />

      <EditUserModal
        open={Boolean(editingUser)}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onUpdated={() => {
          setEditingUser(null);
          setPageIndex(0);
          refetch();
        }}
      />

      <ConfirmDelete
        open={Boolean(deletingId)}
        title="Delete user"
        description={`Permanently delete user ${deletingId}?`}
        onCancel={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await deleteUser(deletingId);
            setDeletingId(null);
            setPageIndex(0);
            refetch();
          } catch (err) {
            console.error(err);
          }
        }}
      />
    </div>
  );
}
