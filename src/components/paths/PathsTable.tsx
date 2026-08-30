'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import ImportPathModal from '@/components/paths/ImportPathModal';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import {
  createPath,
  deletePath,
  fetchPaths,
  setPathStatus,
  type PathListRow,
  type PathStatus,
} from '@/lib/api/paths';

const STATUSES: Array<{ value: PathStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'WAITLIST', label: 'Waitlist' },
  { value: 'TEAM', label: 'Team' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function tone(status: PathStatus): 'success' | 'neutral' | 'warning' | 'info' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'DRAFT') return 'neutral';
  if (status === 'TEAM') return 'info';
  return 'warning';
}

export default function PathsTable() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<PathStatus | 'ALL'>('ALL');
  const [importOpen, setImportOpen] = useState(false);
  const [confirming, setConfirming] = useState<PathListRow | null>(null);
  const [busy, setBusy] = useState(false);

  const params = useMemo(
    () => ({
      page: 1,
      limit: 50,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(status !== 'ALL' ? { status } : {}),
    }),
    [q, status],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-paths', params],
    queryFn: () => fetchPaths(params),
  });

  const rows = data?.data ?? [];

  const startDraft = async () => {
    setBusy(true);
    try {
      const created = await createPath({ title: 'Untitled path' });
      router.push(`/paths/${created.id}`);
    } catch (error) {
      toast.error('Could not create the draft', {
        description: (error as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Paths"
        description="A path sequences topics, and each topic gathers the content a learner works through."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Import JSON
            </Button>
            <Button onClick={startDraft} disabled={busy}>
              {busy ? 'Creating…' : 'New path'}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search paths…"
          className="max-w-xs"
          aria-label="Search paths"
        />
        <Select value={status} onValueChange={(value) => setStatus(value as PathStatus | 'ALL')}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading paths…" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No paths yet"
          description="Start a draft, or import one from JSON."
          action={
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Import a path from JSON
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-semibold">Path</th>
                <th className="px-4 py-2.5 text-left font-semibold">Level</th>
                <th className="px-4 py-2.5 text-left font-semibold">Visibility</th>
                <th className="px-4 py-2.5 text-right font-semibold">Topics</th>
                <th className="px-4 py-2.5 text-right font-semibold">Enrolled</th>
                <th className="px-4 py-2.5 text-right font-semibold">Weeks</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => router.push(`/paths/${row.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') router.push(`/paths/${row.id}`);
                  }}
                  className="cursor-pointer border-b border-border-soft last:border-0 hover:bg-muted"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{row.title}</div>
                    <div className="font-mono text-[11.5px] text-muted-foreground">/{row.slug}</div>
                  </td>
                  <td className="px-4 py-3">{row.level || '—'}</td>
                  <td className="px-4 py-3">
                    {row.ownerTeamId ? (
                      <StatusBadge tone="info" label="Team" />
                    ) : (
                      <span className="text-muted-foreground">Catalogue</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {row.counts.topics}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {row.counts.enrolled.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {row.estimatedWeeks}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={tone(row.status)} label={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label="Open menu">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/paths/${row.id}`)}>
                          Edit
                        </DropdownMenuItem>

                        {/*
                          A team path is never published to the catalogue, and an
                          archived one is restored first — so neither is offered
                          the publish action at all.
                        */}
                        {row.archivedAt || row.ownerTeamId ? null : row.isPublic ? (
                          <DropdownMenuItem
                            onClick={async () => {
                              await setPathStatus(row.id, 'unpublish');
                              await refetch();
                              toast.success('Unpublished.');
                            }}
                          >
                            Unpublish
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await setPathStatus(row.id, 'publish');
                                await refetch();
                                toast.success('Published.');
                              } catch (error) {
                                toast.error('Not ready to publish', {
                                  description:
                                    (error as { failures?: Array<{ message: string }> }).failures
                                      ?.map((f) => f.message)
                                      .join(' · ') ?? (error as Error).message,
                                });
                              }
                            }}
                          >
                            Publish
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem
                          onClick={async () => {
                            await setPathStatus(row.id, row.archivedAt ? 'restore' : 'archive');
                            await refetch();
                            toast.success(row.archivedAt ? 'Restored.' : 'Archived.');
                          }}
                        >
                          {row.archivedAt ? 'Restore' : 'Archive'}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setConfirming(row)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ImportPathModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(id) => {
          setImportOpen(false);
          router.push(`/paths/${id}`);
        }}
      />

      {confirming ? (
        <ConfirmDelete
          open
          title={`Delete “${confirming.title}”?`}
          description={
            confirming.counts.enrolled > 0
              ? `${confirming.counts.enrolled} learner(s) are enrolled, so this will be refused — archive it instead.`
              : 'Topics used only by this path go with it. Anything shared with another path stays.'
          }
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            try {
              await deletePath(confirming.id);
              toast.success('Deleted.');
              await refetch();
            } catch (error) {
              const body = (error as { response?: { data?: { message?: string } } }).response?.data;
              toast.error('Could not delete', { description: body?.message });
            } finally {
              setConfirming(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
