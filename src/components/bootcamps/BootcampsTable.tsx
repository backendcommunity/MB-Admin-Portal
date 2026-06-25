'use client';

import React, { useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/api/query';
import { type Bootcamp } from '@/lib/api/bootcamps';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import AddBootcampModal from '@/components/bootcamps/AddBootcampModal';
import EditBootcampModal from '@/components/bootcamps/EditBootcampModal';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import { deleteBootcamp } from '@/lib/api/bootcamps';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

export default function BootcampsTable() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Bootcamp | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortParam = sorting[0]
    ? `&sort=${sorting[0].id}&order=${sorting[0].desc ? 'desc' : 'asc'}`
    : '';
  const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';

  const { data, isLoading, isError, refetch } = useApiQuery<{ data: Bootcamp[]; total: number }>(
    ['bootcamps', pageIndex, pageSize, q, statusFilter, sorting],
    `/admin/bootcamps?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(q)}${statusParam}${sortParam}`,
  );
  const list = data?.data || [];
  const total = data?.total || 0;

  const columns = useMemo<ColumnDef<Bootcamp, unknown>[]>(
    () => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'location', header: 'Location' },
      {
        accessorKey: 'active',
        header: 'Active',
        cell: (info) => (
          <StatusBadge
            label={info.getValue<boolean>() ? 'Active' : 'Inactive'}
            tone={info.getValue<boolean>() ? 'success' : 'neutral'}
          />
        ),
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
                <Link href={`/bootcamps/${row.original.id}/cohorts`}>Cohorts</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
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
    data: list,
    columns,
    pageCount: Math.ceil(total / pageSize) || -1,
    state: { pagination: { pageIndex, pageSize }, sorting },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex ?? 0);
      setPageSize(next.pageSize ?? pageSize);
    },
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card className="p-6">
      <PageHeader
        title="Bootcamps"
        actions={<Button onClick={() => setShowAdd(true)}>New Bootcamp</Button>}
      />

      <FilterBar className="mb-6">
        <Input
          placeholder="Search bootcamps"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPageIndex(0);
          }}
          className="flex-1"
        />
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
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </FilterBar>

      {isLoading ? (
        <LoadingState label="Loading bootcamps..." />
      ) : isError ? (
        <ErrorState message="Error loading bootcamps. Please try again." onRetry={refetch} />
      ) : list.length === 0 ? (
        <EmptyState
          title="No bootcamps found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <>
          <DataTable table={table} mobileTitle={(r) => r.original.name} />

          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {Math.min(pageIndex * pageSize + 1, total)}–
              {Math.min((pageIndex + 1) * pageSize, total)} of {total} bootcamps
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

      <AddBootcampModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false);
          setPageIndex(0);
          refetch();
        }}
      />
      <EditBootcampModal
        open={Boolean(editing)}
        bootcamp={editing}
        onClose={() => setEditing(null)}
        onUpdated={() => {
          setEditing(null);
          setPageIndex(0);
          refetch();
        }}
      />
      <ConfirmDelete
        open={Boolean(deletingId)}
        title="Delete bootcamp"
        description={`Permanently delete bootcamp ${deletingId}?`}
        onCancel={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await deleteBootcamp(deletingId);
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
