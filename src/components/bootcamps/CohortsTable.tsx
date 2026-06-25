'use client';

import React, { useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/api/query';
import type { Cohort, CohortsListResponse } from '@/lib/api/cohorts';
import AddCohortModal from '@/components/bootcamps/AddCohortModal';
import Link from 'next/link';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
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
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';

type Props = { bootcampId: string };

export default function CohortsTable({ bootcampId }: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showAdd, setShowAdd] = useState(false);

  const sortParam = sorting[0]
    ? `&sort=${sorting[0].id}&order=${sorting[0].desc ? 'desc' : 'asc'}`
    : '';
  const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';

  const { data, isLoading, isError, refetch } = useApiQuery<CohortsListResponse>(
    ['cohorts', bootcampId, pageIndex, pageSize, q, statusFilter, sorting],
    `/admin/bootcamps/${bootcampId}/cohorts?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(q)}${statusParam}${sortParam}`,
  );

  const list = data?.data || [];
  const total = data?.total || 0;

  const columns = useMemo<ColumnDef<Cohort, unknown>[]>(
    () => [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'startDate', header: 'Start' },
      { accessorKey: 'endDate', header: 'End' },
      { accessorKey: 'memberCount', header: 'Members' },
      { accessorKey: 'weekCount', header: 'Weeks' },
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
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/bootcamps/${bootcampId}/cohorts/${row.original.id}`}>Manage</Link>
          </Button>
        ),
      },
    ],
    [bootcampId],
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
    <div className="space-y-4">
      <PageHeader
        title="Cohorts"
        description="Manage cohorts, members, and weekly schedules for this bootcamp."
        actions={<Button onClick={() => setShowAdd(true)}>New Cohort</Button>}
      />

      <Card className="p-4 sm:p-6">
        <div className="mb-4 space-y-3">
          <Input
            placeholder="Search cohorts"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPageIndex(0);
            }}
            className="w-full"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPageIndex(0);
              }}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="col-span-2 sm:col-span-1"
            >
              Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <LoadingState label="Loading cohorts..." />
        ) : isError ? (
          <ErrorState message="Error loading cohorts. Please try again." onRetry={refetch} />
        ) : list.length === 0 ? (
          <EmptyState
            title="No cohorts found"
            description="Try adjusting your search or filters."
          />
        ) : (
          <>
            <DataTable table={table} mobileTitle={(r) => r.original.name} />

            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min(pageIndex * pageSize + 1, total)}–
                {Math.min((pageIndex + 1) * pageSize, total)} of {total} cohorts
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
      </Card>

      <AddCohortModal
        open={showAdd}
        bootcampId={bootcampId}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false);
          refetch();
        }}
      />
    </div>
  );
}
