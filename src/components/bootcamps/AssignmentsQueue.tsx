'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  approveAssignment,
  fetchAssignments,
  fetchBootcamps,
  type Assignment,
} from '@/lib/api/bootcamps';

export default function AssignmentsQueue({ bootcampId }: { bootcampId?: string } = {}) {
  // Only the standalone queue (no fixed bootcamp) ever needs its own picker —
  // on a bootcamp's detail page the id is already chosen. `enabled: false`
  // means that query never runs at all, not merely stays hidden.
  const [selectedBootcampId, setSelectedBootcampId] = useState('ALL');
  const [q, setQ] = useState('');
  const [onlyPending, setOnlyPending] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const bootcampsQuery = useQuery({
    queryKey: ['admin-bootcamps', 'for-assignments'],
    queryFn: () => fetchBootcamps({ limit: 100 }),
    enabled: !bootcampId,
  });

  const effectiveBootcampId = bootcampId ?? selectedBootcampId;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-assignments', effectiveBootcampId],
    queryFn: () =>
      fetchAssignments(effectiveBootcampId === 'ALL' ? undefined : effectiveBootcampId),
  });

  const rows = useMemo(() => {
    const all = data?.data ?? [];
    const needle = q.trim().toLowerCase();
    return all.filter((row) => {
      if (onlyPending && row.completed) return false;
      if (!needle) return true;
      return [row.user?.name, row.user?.email, row.lesson?.title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [data, q, onlyPending]);

  const pending = (data?.data ?? []).filter((row) => !row.completed).length;

  const approve = async (row: Assignment) => {
    setBusyId(row.id);
    try {
      await approveAssignment(row.id);
      toast.success('Approved.', {
        description: 'The lesson is marked complete and its points are awarded.',
      });
      // The endpoint caches for 60s, so the list may lag a beat behind.
      await refetch();
    } catch (error) {
      toast.error('Could not approve it', { description: (error as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assignments"
        description={
          bootcampId
            ? 'Submissions for this bootcamp. Only assignment, exercise and project lessons are reviewed — the other four types have nothing to hand in.'
            : 'Submissions across every bootcamp. Only assignment, exercise and project lessons are reviewed — the other four types have nothing to hand in.'
        }
        actions={
          <StatusBadge
            label={`${pending} awaiting review`}
            tone={pending ? 'warning' : 'success'}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search by learner or lesson…"
          className="max-w-xs"
          aria-label="Search submissions"
        />
        {bootcampId ? null : (
          <Select value={selectedBootcampId} onValueChange={setSelectedBootcampId}>
            <SelectTrigger className="w-56" aria-label="Filter by bootcamp">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All bootcamps</SelectItem>
              {(bootcampsQuery.data?.data ?? []).map((bootcamp) => (
                <SelectItem key={bootcamp.id} value={bootcamp.id}>
                  {bootcamp.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant={onlyPending ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyPending((value) => !value)}
        >
          {onlyPending ? 'Pending only' : 'Showing all'}
        </Button>
      </div>

      {isLoading ? <LoadingState /> : null}
      {isError ? <ErrorState onRetry={() => refetch()} /> : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <EmptyState
          title={onlyPending ? 'Nothing awaiting review' : 'No submissions'}
          description={
            onlyPending
              ? 'Every submission has been approved.'
              : 'Nobody has handed anything in yet.'
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <Card className="divide-y p-0">
          {rows.map((row) => {
            const cohort = row.lesson?.week?.cohort;
            return (
              <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {row.user?.name || row.user?.email || 'Unknown learner'}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{row.user?.email}</div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{cohort?.bootcamp?.title ?? '—'}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {cohort?.name ?? '—'}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{row.lesson?.title ?? '—'}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.lesson?.week?.title ?? ''}
                  </div>
                </div>

                {row.submissionUrl ? (
                  <a
                    href={row.submissionUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex max-w-48 items-center gap-1 truncate text-xs text-primary underline underline-offset-2"
                  >
                    <ExternalLink className="size-3 shrink-0" />
                    <span className="truncate">{row.submissionUrl}</span>
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">No link</span>
                )}

                <StatusBadge
                  label={row.completed ? 'approved' : 'pending'}
                  tone={row.completed ? 'success' : 'warning'}
                />

                {row.completed ? null : (
                  <Button size="sm" onClick={() => approve(row)} disabled={busyId === row.id}>
                    {busyId === row.id ? 'Approving…' : 'Approve'}
                  </Button>
                )}
              </div>
            );
          })}
        </Card>
      ) : null}
    </div>
  );
}
