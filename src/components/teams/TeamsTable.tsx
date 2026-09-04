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
import { fetchTeams, type TeamSummary } from '@/lib/api/teams';
import { Users2 } from 'lucide-react';

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

function subscriptionTone(status: string | null): Tone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'CANCELED') return 'danger';
  if (status === 'PAUSED') return 'warning';
  return 'neutral';
}

const PAGE_SIZE = 20;

export function TeamsTable() {
  const [pageIndex, setPageIndex] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['teams', pageIndex],
    queryFn: () => fetchTeams({ page: pageIndex + 1, limit: PAGE_SIZE }),
  });

  const teams: TeamSummary[] = data?.teams ?? [];
  const total: number = data?.total ?? 0;

  const columns: ColumnDef<TeamSummary, unknown>[] = [
    { accessorKey: 'name', header: 'Team' },
    {
      id: 'owner',
      header: 'Owner',
      cell: ({ row }) => {
        const owner = row.original.owner;
        if (!owner) return <span className="text-muted-foreground">—</span>;
        return (
          <div>
            {owner.name}
            <div className="text-xs text-muted-foreground">{owner.email}</div>
          </div>
        );
      },
    },
    {
      id: 'processor',
      header: 'Processor',
      cell: ({ row }) => row.original.processor ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'status',
      header: 'Subscription',
      cell: ({ row }) =>
        row.original.subscriptionStatus ? (
          <StatusBadge
            label={row.original.subscriptionStatus}
            tone={subscriptionTone(row.original.subscriptionStatus)}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'seats',
      header: 'Seats',
      cell: ({ row }) => {
        const s = row.original.seats;
        return `${s.used} / ${s.paidSeats}`;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/teams/${row.original.id}`}>View</Link>
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data: teams,
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
        title="Teams"
        description="Every team account, its owner, seats, and processor."
      />

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex justify-end">
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <LoadingState label="Loading teams…" />
        ) : isError ? (
          <ErrorState message="Error loading teams. Please try again." onRetry={refetch} />
        ) : teams.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="No teams yet"
            description="Team accounts will show up here once created."
          />
        ) : (
          <>
            <DataTable table={table} mobileTitle={(r) => r.original.name} />

            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min(pageIndex * PAGE_SIZE + 1, total)}–
                {Math.min((pageIndex + 1) * PAGE_SIZE, total)} of {total} teams
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
