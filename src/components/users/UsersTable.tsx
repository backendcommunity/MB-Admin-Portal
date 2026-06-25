'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useApiQuery } from '@/lib/api/query';
import type { User, UsersListResponse } from '@/lib/api/users';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import AddUserModal from '@/components/users/AddUserModal';
import EditUserModal from '@/components/users/EditUserModal';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import { deleteUser, suspendUserById } from '@/lib/api/users';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';

function roleTone(role: string): 'danger' | 'info' | 'success' | 'neutral' {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'danger';
    case 'ADMIN':
      return 'info';
    case 'INSTRUCTOR':
      return 'success';
    default:
      return 'neutral';
  }
}

export default function UsersTable() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [globalFilter, setGlobalFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  const queryKey = ['users', pageIndex, pageSize, globalFilter, roleFilter, statusFilter, sorting];

  const sortParam = sorting[0]
    ? `&sort=${sorting[0].id}&order=${sorting[0].desc ? 'desc' : 'asc'}`
    : '';

  const roleParam = roleFilter !== 'all' ? `&role=${encodeURIComponent(roleFilter)}` : '';
  const statusParam =
    statusFilter !== 'all' ? `&active=${statusFilter === 'active' ? 'true' : 'false'}` : '';

  const { data, isLoading, isError, refetch } = useApiQuery<UsersListResponse>(
    queryKey,
    `/admin/users?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(globalFilter)}${roleParam}${statusParam}${sortParam}`,
  );

  const users: User[] = data?.data || [];
  const total: number = data?.total || 0;

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const columns = useMemo<ColumnDef<User, any>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        ),
      },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'email', header: 'Email' },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: (info) => (
          <StatusBadge label={info.getValue<string>()} tone={roleTone(info.getValue<string>())} />
        ),
      },
      {
        accessorKey: 'plan',
        header: 'Plan',
        cell: (info) => info.getValue() || '—',
      },
      {
        accessorKey: 'active',
        header: 'Status',
        cell: (info) => (
          <StatusBadge
            label={info.getValue<boolean>() ? 'Active' : 'Inactive'}
            tone={info.getValue<boolean>() ? 'success' : 'neutral'}
          />
        ),
      },
      {
        accessorKey: 'joinedAt',
        header: 'Joined',
        cell: (info) => {
          const date = info.getValue();
          return date ? new Date(date as string).toLocaleDateString() : '—';
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/users/${row.original.id}`}>View</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditingUser(row.original)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeletingId(row.original.id)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
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
      const next = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
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
    [table, rowSelection, users],
  );

  const exportSelectedCsv = useCallback(() => {
    if (!selectedUsers.length) return;

    const rows = [
      ['ID', 'Name', 'Email', 'Role', 'Plan', 'Status', 'Joined Date'],
      ...selectedUsers.map((user) => [
        user.id,
        user.name,
        user.email,
        user.role,
        user.plan || '',
        user.active ? 'Active' : 'Inactive',
        user.joinedAt || '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
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
      console.error('Bulk suspend failed:', error);
    } finally {
      setIsBulkBusy(false);
    }
  }, [selectedUsers, refetch]);

  return (
    <Card className="p-6">
      <PageHeader
        title="Users"
        actions={<Button onClick={() => setShowAdd(true)}>Add User</Button>}
      />

      <FilterBar className="mb-6">
        <Input
          placeholder="Search by name or email..."
          value={globalFilter}
          onChange={(e) => {
            setGlobalFilter(e.target.value);
            setPageIndex(0);
          }}
          className="flex-1"
        />

        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v);
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={() => refetch()} variant="outline" size="sm">
          Refresh
        </Button>

        {selectedUsers.length > 0 && (
          <>
            <Button
              onClick={bulkSuspendSelected}
              disabled={isBulkBusy}
              variant="outline"
              size="sm"
              className="text-amber-600"
            >
              Suspend ({selectedUsers.length})
            </Button>
            <Button onClick={exportSelectedCsv} variant="outline" size="sm">
              Export CSV ({selectedUsers.length})
            </Button>
          </>
        )}
      </FilterBar>

      {isLoading ? (
        <LoadingState label="Loading users..." />
      ) : isError ? (
        <ErrorState message="Error loading users. Please try again." onRetry={refetch} />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <DataTable table={table} mobileTitle={(r) => r.original.name} />

          {/* Pagination */}
          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {Math.min(pageIndex * pageSize + 1, total)}–
              {Math.min((pageIndex + 1) * pageSize, total)} of {total} users
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  table.setPageSize(Number(v));
                  setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                disabled={pageIndex === 0}
              >
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">
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
              console.error('Delete failed:', err);
            }
          }}
        />
      )}
    </Card>
  );
}
