'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { fetchUserImports, type UserImport } from '@/lib/api/userImports';

/** Mirrors CertificateImportsTable — same shape of import (created via a
 * modal on a parent page, processed asynchronously, paginated here). */

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

function importStatusTone(status: string): Tone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'PROCESSING') return 'info';
  if (status === 'FAILED') return 'danger';
  return 'neutral';
}

const PAGE_SIZE = 20;

export function UserImportsTable() {
  const [pageIndex, setPageIndex] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['userImports', pageIndex],
    queryFn: () => fetchUserImports({ page: pageIndex + 1, limit: PAGE_SIZE }),
  });

  const imports: UserImport[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  const columns: ColumnDef<UserImport, unknown>[] = [
    { accessorKey: 'filename', header: 'File' },
    {
      id: 'progress',
      header: 'Created',
      cell: ({ row }) => `${row.original.created}/${row.original.totalRows}`,
    },
    { accessorKey: 'alreadyRegistered', header: 'Already registered' },
    { accessorKey: 'skipped', header: 'Skipped' },
    { accessorKey: 'failed', header: 'Failed' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge label={row.original.status} tone={importStatusTone(row.original.status)} />
      ),
    },
    {
      id: 'createdAt',
      header: 'Date',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/users/imports/${row.original.id}`}>View</Link>
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data: imports,
    columns,
    pageCount: Math.ceil(total / PAGE_SIZE) || -1,
    state: { pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater({ pageIndex, pageSize: PAGE_SIZE }) : updater;
      setPageIndex(next.pageIndex ?? 0);
    },
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="User imports"
        description="Past bulk imports of names and emails, with per-row outcome and retry."
        actions={
          <Button variant="outline" asChild>
            <Link href="/users">← Back to users</Link>
          </Button>
        }
      />

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex justify-end">
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <LoadingState label="Loading imports…" />
        ) : isError ? (
          <ErrorState message="Error loading imports. Please try again." onRetry={refetch} />
        ) : imports.length === 0 ? (
          <EmptyState
            title="No imports yet"
            description="Use Import users on the Users page to bulk-create accounts from a CSV or JSON roster."
          />
        ) : (
          <>
            <DataTable table={table} mobileTitle={(r) => r.original.filename} />

            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min(pageIndex * PAGE_SIZE + 1, total)}–
                {Math.min((pageIndex + 1) * PAGE_SIZE, total)} of {total} imports
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                  disabled={pageIndex === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {pageIndex + 1} of {Math.ceil(total / PAGE_SIZE) || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageIndex(pageIndex + 1)}
                  disabled={(pageIndex + 1) * PAGE_SIZE >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
