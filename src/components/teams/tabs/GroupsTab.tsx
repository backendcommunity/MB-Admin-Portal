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
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import {
  fetchTeamGroups,
  createTeamGroup,
  renameTeamGroup,
  deleteTeamGroup,
  fetchTeamAssignments,
  type TeamGroupRow,
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
 * Create, rename and delete a team's groups. No member-management UI here —
 * `setTeamGroupMembers` belongs to a deeper surface out of scope for this
 * slice, same reasoning as the assignment item editor and path section
 * editor (see AssignmentsTab/PathsTab).
 *
 * `listGroups` (`modules/teams/helpers/groups.ts`) carries no assignment
 * count of its own — the "Assignments" column the artifact calls for is
 * computed here by cross-referencing the team's assignments (same query
 * key `AssignmentsTab` uses, so switching tabs reuses the cache) against
 * each group's id. That second query never gates the groups list itself: a
 * slow or failed load there falls back to an em dash, the same
 * non-gating contract `MembersTab` uses for roster progress.
 */
export function GroupsTab({
  teamId,
  isArchived,
  onChanged,
}: {
  teamId: string;
  isArchived: boolean;
  onChanged: () => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-team-groups', teamId],
    queryFn: () => fetchTeamGroups(teamId),
    enabled: Boolean(teamId),
  });

  const {
    data: assignments,
    isLoading: assignmentsLoading,
    isError: assignmentsError,
  } = useQuery({
    queryKey: ['admin-team-assignments', teamId],
    queryFn: () => fetchTeamAssignments(teamId),
    enabled: Boolean(teamId),
  });

  const assignmentCountByGroup = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assignments ?? []) {
      if (a.targetType === 'GROUP' && a.targetGroupId) {
        map.set(a.targetGroupId, (map.get(a.targetGroupId) ?? 0) + 1);
      }
    }
    return map;
  }, [assignments]);

  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useSeededForm(creating ? 'open' : 'closed', () => '');
  const [saving, setSaving] = useState(false);

  const [renameFor, setRenameFor] = useState<TeamGroupRow | null>(null);
  const [renameName, setRenameName] = useSeededForm(
    renameFor?.id ?? 'closed',
    () => renameFor?.name ?? '',
  );
  const [renaming, setRenaming] = useState(false);

  const [deleteFor, setDeleteFor] = useState<TeamGroupRow | null>(null);

  const doCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await createTeamGroup(teamId, name);
      toast.success(`Created ${name}.`);
      setCreating(false);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not create the group', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setSaving(false);
    }
  };

  const doRename = async () => {
    if (!renameFor) return;
    const name = renameName.trim();
    if (!name) return;
    setRenaming(true);
    try {
      await renameTeamGroup(teamId, renameFor.id, name);
      toast.success(`Renamed to ${name}.`);
      setRenameFor(null);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not rename the group', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setRenaming(false);
    }
  };

  const doDelete = async () => {
    const group = deleteFor;
    setDeleteFor(null);
    if (!group) return;
    try {
      await deleteTeamGroup(teamId, group.id);
      toast.success(`Deleted ${group.name}.`);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not delete the group', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    }
  };

  const columns = useMemo<ColumnDef<TeamGroupRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Group',
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'members',
        header: 'Members',
        meta: { align: 'right' as const },
        cell: ({ row }) => row.original.memberCount,
      },
      {
        id: 'assignments',
        header: 'Assignments',
        meta: { align: 'right' as const },
        cell: ({ row }) => {
          if (assignmentsLoading || assignmentsError) return '—';
          return assignmentCountByGroup.get(row.original.id) ?? 0;
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
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={isArchived}
              onClick={() => setRenameFor(row.original)}
            >
              Rename
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={isArchived}
              onClick={() => setDeleteFor(row.original)}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isArchived, assignmentCountByGroup, assignmentsLoading, assignmentsError],
  );

  const groups = data ?? [];
  const table = useReactTable({ data: groups, columns, getCoreRowModel: getCoreRowModel() });

  if (isLoading) return <LoadingState label="Loading groups…" />;
  if (isError) return <ErrorState message="Failed to load groups." onRetry={() => refetch()} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Groups</span>
        <Button size="sm" disabled={isArchived} onClick={() => setCreating(true)}>
          New group
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <DataTable table={table} mobileTitle={(row) => row.original.name} />
      </Card>
      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No groups yet.</p>
      ) : null}

      <Dialog open={creating} onOpenChange={(next) => !next && setCreating(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New group</DialogTitle>
          </DialogHeader>
          <Field label="Name" htmlFor="group-name" required>
            <Input
              id="group-name"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={doCreate} disabled={saving || !createName.trim()}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameFor)} onOpenChange={(next) => !next && setRenameFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename {renameFor?.name}</DialogTitle>
          </DialogHeader>
          <Field label="Name" htmlFor="group-rename" required>
            <Input
              id="group-rename"
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFor(null)} disabled={renaming}>
              Cancel
            </Button>
            <Button onClick={doRename} disabled={renaming || !renameName.trim()}>
              {renaming ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={Boolean(deleteFor)}
        onCancel={() => setDeleteFor(null)}
        title={`Delete ${deleteFor?.name ?? 'this group'}?`}
        description="The group disappears. Everyone in it stays on the team exactly as they are now — deleting a group never removes anyone or changes their access."
        onConfirm={doDelete}
      />
    </div>
  );
}

export default GroupsTab;
