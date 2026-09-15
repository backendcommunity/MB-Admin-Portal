'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { fetchTeams, type TeamListParams, type TeamSummary } from '@/lib/api/teams';

const PAGE = 25;

// Values the `/admin/teams` list endpoint understands for each filter
// (see the admin teams router). "ALL" is the portal-local sentinel for
// "no filter" and is stripped before the request goes out.
const STATUSES = ['active', 'past_due', 'paused', 'canceled', 'archived'] as const;
const PROCESSORS = [
  'PADDLE',
  'ASYNCPAY',
  'STRIPE',
  'PAYSTACK',
  'MANUAL',
  'NONE',
  'COMPED',
] as const;
const SEAT_STATES = ['mismatch'] as const;

/** `MANUAL` (a real subscription with no payment channel — paid by bank
 * transfer, see `TeamProcessor`) reads better than the raw enum value. */
function processorLabel(processor: TeamSummary['processor']): string {
  return processor === 'MANUAL' ? 'Paid manually' : (processor ?? '');
}

/** The processor filter dropdown mixes payment processors (PADDLE, MANUAL,
 * …) with billing states (NONE, COMPED) — `admin/teams.ts`'s `GET /` maps
 * `processor=COMPED` to `where.comped = true`, disjoint from `NONE`. Label
 * the two billing-state options so they read as states, not a processor. */
function filterOptionLabel(option: string): string {
  if (option === 'NONE') return 'No subscription';
  if (option === 'COMPED') return 'Comped';
  return option;
}

function TeamsTable() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [processor, setProcessor] = useState('ALL');
  const [seatState, setSeatState] = useState('ALL');
  const [page, setPage] = useState(1);

  const params = useMemo(() => {
    const p: TeamListParams = { page, limit: PAGE };
    if (q.trim()) p.q = q.trim();
    if (status !== 'ALL') p.status = status;
    if (processor !== 'ALL') p.processor = processor;
    if (seatState !== 'ALL') p.seatState = seatState;
    return p;
  }, [q, status, processor, seatState, page]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-teams', params],
    queryFn: () => fetchTeams(params),
  });

  const rows = useMemo(() => data?.teams ?? [], [data]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const columns = useMemo<ColumnDef<TeamSummary>[]>(
    () => [
      {
        id: 'name',
        header: 'Team',
        cell: ({ row }) => (
          <div>
            <Link href={`/teams/${row.original.id}`} className="font-medium hover:underline">
              {row.original.name}
            </Link>
            <div className="font-mono text-xs text-muted-foreground">{row.original.id}</div>
          </div>
        ),
      },
      {
        id: 'owner',
        header: 'Owner',
        cell: ({ row }) => (
          <div>
            <div>{row.original.owner?.name ?? '—'}</div>
            <div className="text-xs text-muted-foreground">{row.original.owner?.email ?? ''}</div>
          </div>
        ),
      },
      {
        id: 'subscription',
        header: 'Subscription',
        cell: ({ row }) => {
          // Comped is checked FIRST: a comped team grants Pro to every
          // active member independent of any subscription (`teamRow`'s
          // `comped` field, academy `modules/admin/helpers/team-shape.ts`),
          // and — before this — rendered identically to a team funding
          // nothing at all. That collision is exactly what this branch
          // fixes: a comped team must never read as "No subscription".
          if (row.original.comped) {
            return (
              <div>
                <StatusBadge tone="info" label="Comped" />
                {row.original.processor ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Also has a {processorLabel(row.original.processor)} subscription (
                    {row.original.subscriptionStatus ?? '—'})
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-muted-foreground">Staff-granted Pro</div>
                )}
              </div>
            );
          }
          return row.original.processor ? (
            <div>
              <div>{row.original.subscriptionStatus ?? '—'}</div>
              <div className="text-xs text-muted-foreground">
                {processorLabel(row.original.processor)}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">No subscription</span>
          );
        },
      },
      {
        id: 'seats',
        header: 'Seats',
        cell: ({ row }) => {
          const s = row.original.seats;
          return (
            <div className="flex items-center gap-2">
              <span className="tabular-nums">
                {s.used}/{s.subscribed ? s.paidSeats : '—'}
              </span>
              {row.original.seatGap != null && (
                <StatusBadge tone="warning" label={`±${row.original.seatGap}`} />
              )}
            </div>
          );
        },
      },
      {
        id: 'members',
        header: 'Members',
        meta: { align: 'right' as const },
        cell: ({ row }) => <span className="tabular-nums">{row.original.seats.activeMembers}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.archivedAt ? (
            <StatusBadge tone="neutral" label="Archived" />
          ) : (
            <StatusBadge tone="success" label="Active" />
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${row.original.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/teams/${row.original.id}`)}>
                Open
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [router],
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  const filter = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    options: readonly string[],
    allLabel: string,
  ) => (
    <Select
      value={value}
      onValueChange={(next) => {
        onChange(next);
        // A narrower filter can leave the current page past the end.
        setPage(1);
      }}
    >
      <SelectTrigger className="w-auto min-w-36" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {filterOptionLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Teams"
        description={`${total} team${total === 1 ? '' : 's'}. Every team account, its owner, seats, and processor.`}
        actions={<Button onClick={() => router.push('/teams/new')}>New team</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
          placeholder="Search teams…"
          className="max-w-xs"
          aria-label="Search teams"
        />
        {filter('Filter by status', status, setStatus, STATUSES, 'Any status')}
        {filter('Filter by processor', processor, setProcessor, PROCESSORS, 'Any processor')}
        {filter('Filter by seat state', seatState, setSeatState, SEAT_STATES, 'Any seat state')}
      </div>

      {isLoading ? <LoadingState /> : null}
      {isError ? <ErrorState onRetry={() => refetch()} /> : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <EmptyState title="No teams" description="Nothing matches those filters." />
      ) : null}

      {rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataTable table={table} mobileTitle={(row) => row.original.name} />
        </Card>
      ) : null}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {pages} · {total} team{total === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Named export kept alongside the default so the existing
// `import { TeamsTable } from '@/components/teams/TeamsTable'` in
// src/app/(app)/teams/page.tsx (out of scope for this task) keeps working.
export { TeamsTable };
export default TeamsTable;
