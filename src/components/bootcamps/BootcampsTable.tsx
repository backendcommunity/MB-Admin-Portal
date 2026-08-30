'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

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
import ConfirmDelete from '@/components/users/ConfirmDelete';
import ImportBootcampModal from '@/components/bootcamps/ImportBootcampModal';
import {
  createBootcamp,
  deleteBootcamp,
  fetchBootcamps,
  LEVELS,
  type Bootcamp,
} from '@/lib/api/bootcamps';

const LEVEL_FILTERS = ['ALL', ...LEVELS] as const;

function levelTone(level: string): 'success' | 'neutral' | 'warning' | 'info' {
  if (level === 'Beginner') return 'success';
  if (level === 'Intermediate') return 'info';
  if (level === 'Advanced') return 'warning';
  return 'neutral';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function BootcampsTable() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<string>('ALL');
  const [confirming, setConfirming] = useState<Bootcamp | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  const params = useMemo(
    () => ({
      page: 1,
      limit: 50,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(level !== 'ALL' ? { level } : {}),
    }),
    [q, level],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-bootcamps', params],
    queryFn: () => fetchBootcamps(params),
  });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const total = data?.total ?? 0;

  const startDraft = async () => {
    setBusy(true);
    try {
      const created = await createBootcamp({ title: 'Untitled bootcamp' });
      router.push(`/bootcamps/${created.id}`);
    } catch (error) {
      toast.error('Could not create the bootcamp', { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirming) return;
    try {
      await deleteBootcamp(confirming.id);
      toast.success(`Deleted “${confirming.title}”.`);
      setConfirming(null);
      refetch();
    } catch (error) {
      // A 409 here is the guard doing its job — enrolled learners, or a path
      // still pointing at this bootcamp.
      toast.error('Could not delete it', { description: (error as Error).message });
    }
  };

  const columns = useMemo<ColumnDef<Bootcamp>[]>(
    () => [
      {
        id: 'bootcamp',
        header: 'Bootcamp',
        cell: ({ row }) => (
          <button
            type="button"
            className="block max-w-xs text-left"
            onClick={() => router.push(`/bootcamps/${row.original.id}`)}
          >
            <span className="block truncate font-medium">
              {row.original.title || 'Untitled bootcamp'}
            </span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              /{row.original.slug}
            </span>
          </button>
        ),
      },
      {
        id: 'level',
        header: 'Level',
        cell: ({ row }) => (
          <StatusBadge label={row.original.level || '—'} tone={levelTone(row.original.level)} />
        ),
      },
      {
        id: 'cohorts',
        header: 'Cohorts',
        meta: { align: 'right' as const },
        cell: ({ row }) => <span className="tabular-nums">{row.original.cohortCount ?? 0}</span>,
      },
      {
        id: 'students',
        header: 'Students',
        meta: { align: 'right' as const },
        cell: ({ row }) => <span className="tabular-nums">{row.original.studentCount ?? 0}</span>,
      },
      {
        id: 'next',
        header: 'Next cohort',
        // A bootcamp with no open cohort is not joinable, however finished its
        // curriculum is — so the absence reads as a warning, not a blank.
        cell: ({ row }) =>
          row.original.nextCohort ? (
            <span className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {fmtDate(row.original.nextCohort.startsAt)}
              </span>
              <StatusBadge
                label={row.original.nextCohort.status}
                tone={row.original.nextCohort.status === 'OPEN' ? 'success' : 'info'}
              />
            </span>
          ) : (
            <StatusBadge label="no cohort" tone="warning" />
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${row.original.title || 'bootcamp'}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/bootcamps/${row.original.id}`)}>
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setConfirming(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [router],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bootcamps"
        description={`${total} bootcamp${total === 1 ? '' : 's'}. A bootcamp is the shell — each cohort is one run of it, with its own curriculum, schedule and roster.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImporting(true)}>
              Import JSON
            </Button>
            <Button onClick={startDraft} disabled={busy}>
              {busy ? 'Creating…' : 'New bootcamp'}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search bootcamps…"
          className="max-w-xs"
          aria-label="Search bootcamps"
        />
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-40" aria-label="Filter by level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEVEL_FILTERS.map((value) => (
              <SelectItem key={value} value={value}>
                {value === 'ALL' ? 'All levels' : value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <LoadingState /> : null}
      {isError ? <ErrorState onRetry={() => refetch()} /> : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <EmptyState
          title="No bootcamps yet"
          description="Create one, then add the cohort that will run it."
        />
      ) : null}

      {rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataTable
            table={table}
            mobileTitle={(row) => row.original.title || 'Untitled bootcamp'}
          />
        </Card>
      ) : null}

      <ImportBootcampModal
        open={importing}
        onOpenChange={setImporting}
        onImported={(id) => {
          refetch();
          router.push(`/bootcamps/${id}`);
        }}
      />

      <ConfirmDelete
        open={Boolean(confirming)}
        onCancel={() => setConfirming(null)}
        title={`Delete “${confirming?.title ?? ''}”?`}
        description="This removes the bootcamp with its cohorts, weeks, lessons and schedule. It is refused if any learner is enrolled."
        onConfirm={remove}
      />
    </div>
  );
}
