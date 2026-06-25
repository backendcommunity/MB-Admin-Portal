"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useApiQuery } from "@/lib/api/query";
import type { User, UsersListResponse } from "@/lib/api/users";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  const { data, isLoading, isError, refetch } = useApiQuery<UsersListResponse>(
    queryKey,
    `/admin/users?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(globalFilter)}${roleParam}${statusParam}${sortParam}`
  );

  const users: User[] = data?.data || [];
  const total: number = data?.total || 0;

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-red-100 text-red-800";
      case "ADMIN":
        return "bg-blue-100 text-blue-800";
      case "INSTRUCTOR":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const columns = useMemo<ColumnDef<User, any>[]>(
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
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "role",
        header: "Role",
        cell: (info) => (
          <Badge className={`${getRoleBadgeColor(info.getValue())} px-2 py-1 text-xs`}>
            {info.getValue()}
          </Badge>
        ),
      },
      {
        accessorKey: "plan",
        header: "Plan",
        cell: (info) => info.getValue() || "—",
      },
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
        accessorKey: "joinedAt",
        header: "Joined",
        cell: (info) => {
          const date = info.getValue();
          return date ? new Date(date as string).toLocaleDateString() : "—";
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Link
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              href={`/users/${row.original.id}`}
            >
              View
            </Link>
            <button
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              onClick={() => setEditingUser(row.original)}
            >
              Edit
            </button>
            <button
              className="text-red-600 hover:text-red-800 text-sm font-medium"
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

  const exportSelectedCsv = useCallback(() => {
    if (!selectedUsers.length) return;

    const rows = [
      ["ID", "Name", "Email", "Role", "Plan", "Status", "Joined Date"],
      ...selectedUsers.map((user) => [
        user.id,
        user.name,
        user.email,
        user.role,
        user.plan || "",
        user.active ? "Active" : "Inactive",
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
    anchor.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [selectedUsers]);

  const bulkSuspendSelected = useCallback(async () => {
    if (!selectedUsers.length) return;
    setIsBulkBusy(true);
    try {
      await Promise.all(selectedUsers.map((user) => suspendUserById(user.id, false)));
      setRowSelection({});
      setPageIndex(0);
      await refetch();
    } catch (error) {
      console.error("Bulk suspend failed:", error);
    } finally {
      setIsBulkBusy(false);
    }
  }, [selectedUsers, refetch]);

  return (
    <Card className="p-6">
      {/* Filters & Actions */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Search by name or email..."
              value={globalFilter}
              onChange={(e) => {
                setGlobalFilter(e.target.value);
                setPageIndex(0);
              }}
            />
          </div>
          <Button
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Add User
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPageIndex(0);
            }}
            className="select select-bordered select-sm"
          >
            <option value="all">All roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="INSTRUCTOR">Instructor</option>
          </select>

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

          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
          >
            Refresh
          </Button>

          {selectedUsers.length > 0 && (
            <>
              <Button
                onClick={bulkSuspendSelected}
                disabled={isBulkBusy}
                variant="outline"
                size="sm"
                className="text-yellow-600"
              >
                Suspend ({selectedUsers.length})
              </Button>
              <Button
                onClick={exportSelectedCsv}
                variant="outline"
                size="sm"
              >
                Export CSV ({selectedUsers.length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : isError ? (
        <div className="alert alert-error">
          <span>Error loading users. Please try again.</span>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No users found</p>
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

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {Math.min(pageIndex * pageSize + 1, total)}-{Math.min((pageIndex + 1) * pageSize, total)} of {total} users
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                  setPageIndex(0);
                }}
                className="select select-bordered select-sm"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                disabled={pageIndex === 0}
              >
                Previous
              </Button>

              <span className="text-sm">
                Page {pageIndex + 1} of {Math.ceil(total / pageSize) || 1}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageIndex(pageIndex + 1)}
                disabled={(pageIndex + 1) * pageSize >= total}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AddUserModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setPageIndex(0);
          refetch();
        }}
      />

      {editingUser && (
        <EditUserModal
          open={Boolean(editingUser)}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={() => {
            setEditingUser(null);
            refetch();
          }}
        />
      )}

      {deletingId && (
        <ConfirmDelete
          open={Boolean(deletingId)}
          title="Delete User"
          description={`Are you sure you want to permanently delete this user?`}
          onCancel={() => setDeletingId(null)}
          onConfirm={async () => {
            if (!deletingId) return;
            try {
              await deleteUser(deletingId);
              setDeletingId(null);
              refetch();
            } catch (err) {
              console.error("Delete failed:", err);
            }
          }}
        />
      )}
    </Card>
  );
}
