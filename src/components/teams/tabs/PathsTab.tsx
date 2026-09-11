'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/shared/form/Section';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import {
  fetchTeamPaths,
  createTeamPath,
  updateTeamPath,
  archiveTeamPath,
  restoreTeamPath,
  type TeamPathRow,
} from '@/lib/api/teams';

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { message?: string } } };
  return anyErr.response?.data?.message || fallback;
}

/**
 * Create, rename, archive and restore a team's own paths. The section/item
 * editor lives on the team's own manager and is explicitly out of scope for
 * this slice (see AssignmentsTab's equivalent note on assignment items) —
 * there is no "Edit sections" action here, only the four listed above.
 *
 * "Items" and "Started" (the artifact's own column names) have no backing
 * data: `listTeamPaths` (`modules/teams/helpers/team-paths.ts`) selects only
 * `id/title/slug/summary/sectionCount/createdAt` — no total item count
 * across sections, and no per-path "members started" figure exists
 * anywhere in this stack. Rather than fabricate either, both render an em
 * dash, the same honest-gap convention `MembersTab` uses for progress data
 * it cannot back.
 *
 * "Status"/archived-row support is forward-compatible rather than fully
 * live: `listTeamPaths` hardcodes `where: { archivedAt: null }` and never
 * selects the column, so `TeamPathRow.archivedAt` is always `undefined` on
 * real data today — meaning `GET /:id/paths` can never actually hand this
 * tab an archived row to restore. That is a real backend gap (flagged on
 * `TeamPathRow` in `lib/api/teams.ts`): staff need to see archived paths to
 * restore them, and today's endpoint filters them out entirely. This tab
 * still renders Restore vs. Archive correctly off `archivedAt` so it works
 * the moment that endpoint gains an `includeArchived` option.
 */
export function PathsTab({
  teamId,
  isArchived,
  onChanged,
}: {
  teamId: string;
  isArchived: boolean;
  onChanged: () => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-team-paths', teamId],
    queryFn: () => fetchTeamPaths(teamId),
    enabled: Boolean(teamId),
  });

  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useSeededForm(creating ? 'open' : 'closed', () => ({
    title: '',
    summary: '',
  }));
  const [saving, setSaving] = useState(false);

  const [renameFor, setRenameFor] = useState<TeamPathRow | null>(null);
  const [renameDraft, setRenameDraft] = useSeededForm(renameFor?.id ?? 'closed', () => ({
    title: renameFor?.title ?? '',
    summary: renameFor?.summary ?? '',
  }));
  const [renaming, setRenaming] = useState(false);

  const [archiveFor, setArchiveFor] = useState<TeamPathRow | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const doCreate = async () => {
    const title = createDraft.title.trim();
    if (!title) return;
    setSaving(true);
    try {
      await createTeamPath(teamId, { title, summary: createDraft.summary.trim() });
      toast.success(`Created ${title}.`);
      setCreating(false);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not create the path', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setSaving(false);
    }
  };

  const doRename = async () => {
    if (!renameFor) return;
    const title = renameDraft.title.trim();
    if (!title) return;
    setRenaming(true);
    try {
      await updateTeamPath(teamId, renameFor.id, {
        title,
        summary: renameDraft.summary.trim(),
      });
      toast.success(`Renamed to ${title}.`);
      setRenameFor(null);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not rename the path', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setRenaming(false);
    }
  };

  const doArchive = async () => {
    const path = archiveFor;
    setArchiveFor(null);
    if (!path) return;
    try {
      await archiveTeamPath(teamId, path.id);
      toast.success(`Archived ${path.title}.`);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not archive the path', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    }
  };

  const doRestore = async (path: TeamPathRow) => {
    setRestoringId(path.id);
    try {
      await restoreTeamPath(teamId, path.id);
      toast.success(`Restored ${path.title} — it is back in every list and picker.`);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not restore the path', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setRestoringId(null);
    }
  };

  const columns = useMemo<ColumnDef<TeamPathRow>[]>(
    () => [
      {
        id: 'title',
        header: 'Path',
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: 'sections',
        header: 'Sections',
        meta: { align: 'right' as const },
        cell: ({ row }) => row.original.sectionCount,
      },
      {
        id: 'items',
        header: 'Items',
        meta: { align: 'right' as const },
        // No total item count across sections is exposed by `listTeamPaths`
        // — see this file's module doc. Honest em dash, not a fabricated 0.
        cell: () => '—',
      },
      {
        id: 'started',
        header: 'Started',
        meta: { align: 'right' as const },
        // No "members started" figure exists anywhere in this stack for a
        // team path — see this file's module doc.
        cell: () => '—',
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const archived = Boolean(row.original.archivedAt);
          return (
            <StatusBadge
              label={archived ? 'Archived' : 'Active'}
              tone={archived ? 'neutral' : 'success'}
            />
          );
        },
      },
      {
        id: 'created',
        header: 'Created',
        cell: ({ row }) => fmt(row.original.createdAt),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const path = row.original;
          const archived = Boolean(path.archivedAt);
          if (archived) {
            return (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isArchived || restoringId === path.id}
                  onClick={() => doRestore(path)}
                >
                  {restoringId === path.id ? 'Restoring…' : 'Restore'}
                </Button>
              </div>
            );
          }
          return (
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={isArchived}
                onClick={() => setRenameFor(path)}
              >
                Rename
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={isArchived}
                onClick={() => setArchiveFor(path)}
              >
                Archive
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isArchived, restoringId],
  );

  const paths = data ?? [];
  const table = useReactTable({ data: paths, columns, getCoreRowModel: getCoreRowModel() });

  if (isLoading) return <LoadingState label="Loading paths…" />;
  if (isError) return <ErrorState message="Failed to load paths." onRetry={() => refetch()} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Paths</span>
        <Button size="sm" disabled={isArchived} onClick={() => setCreating(true)}>
          New path
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <DataTable table={table} mobileTitle={(row) => row.original.title} />
      </Card>
      {paths.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No paths yet.</p>
      ) : null}

      <Dialog open={creating} onOpenChange={(next) => !next && setCreating(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New path</DialogTitle>
          </DialogHeader>
          <Field label="Title" htmlFor="path-title" required>
            <Input
              id="path-title"
              value={createDraft.title}
              onChange={(event) => setCreateDraft((d) => ({ ...d, title: event.target.value }))}
            />
          </Field>
          <Field label="Summary" htmlFor="path-summary" hint="Optional.">
            <Input
              id="path-summary"
              value={createDraft.summary}
              onChange={(event) => setCreateDraft((d) => ({ ...d, summary: event.target.value }))}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={doCreate} disabled={saving || !createDraft.title.trim()}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameFor)} onOpenChange={(next) => !next && setRenameFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename {renameFor?.title}</DialogTitle>
          </DialogHeader>
          <Field label="Title" htmlFor="path-rename-title" required>
            <Input
              id="path-rename-title"
              value={renameDraft.title}
              onChange={(event) => setRenameDraft((d) => ({ ...d, title: event.target.value }))}
            />
          </Field>
          <Field label="Summary" htmlFor="path-rename-summary" hint="Optional.">
            <Input
              id="path-rename-summary"
              value={renameDraft.summary}
              onChange={(event) => setRenameDraft((d) => ({ ...d, summary: event.target.value }))}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFor(null)} disabled={renaming}>
              Cancel
            </Button>
            <Button onClick={doRename} disabled={renaming || !renameDraft.title.trim()}>
              {renaming ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={Boolean(archiveFor)}
        confirmLabel="Archive"
        onCancel={() => setArchiveFor(null)}
        title={`Archive ${archiveFor?.title ?? 'this path'}?`}
        description="This removes the path from the team's list and every assignment picker immediately. Members keep whatever progress they've already made on it, and you can restore it later — nothing is deleted."
        onConfirm={doArchive}
      />
    </div>
  );
}

export default PathsTab;
