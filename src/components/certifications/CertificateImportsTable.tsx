'use client';

import React, { useState } from 'react';
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
import { NewImportModal } from '@/components/certifications/NewImportModal';
import { fetchCertificateImports, type CertificateImport } from '@/lib/api/certificateImports';

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

function importStatusTone(status: string): Tone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'PROCESSING') return 'info';
  if (status === 'FAILED') return 'danger';
  return 'neutral';
}

const PAGE_SIZE = 20;

export function CertificateImportsTable() {
  const [pageIndex, setPageIndex] = useState(0);
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['certificateImports', pageIndex],
    queryFn: () => fetchCertificateImports({ page: pageIndex + 1, limit: PAGE_SIZE }),
  });

  // Backend returns { success, data: CertificateImport[], total, page, limit }
  // fetchCertificateImports returns res.data (the full JSON body)
  const imports: CertificateImport[] = (data as any)?.data ?? [];
  const total: number = (data as any)?.total ?? 0;

  const columns: ColumnDef<CertificateImport, unknown>[] = [
    { accessorKey: 'filename', header: 'File' },
    {
      id: 'progress',
      header: 'Issued',
      cell: ({ row }) => `${row.original.issued}/${row.original.totalRows}`,
    },
    { accessorKey: 'newUsers', header: 'New users' },
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
          <Link href={`/certifications/${row.original.id}`}>View</Link>
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
        title="Certifications"
        description="Bulk-issue verifiable workshop certificates from a CSV of attendees."
        actions={<Button onClick={() => setShowNew(true)}>New import</Button>}
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
            description="Create a new import to issue certificates to workshop attendees."
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

      <NewImportModal
        open={showNew}
        onClose={() => {
          setShowNew(false);
          refetch();
        }}
      />
    </div>
  );
}
