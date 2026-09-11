'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  setTeamGroupMembers,
  fetchTeamAssignments,
  type TeamGroupRow,
  type TeamMemberRow,
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
 * Create, rename, delete and — per the spec ("Groups: Full CRUD plus
 * membership") — edit a team's groups.
 *
 * `setTeamGroupMembers` REPLACES a group's entire membership with exactly
 * the ids submitted. `listGroups` carries each group's real `memberIds`, so
 * the Edit dialog opens with the checkboxes for actual current members
 * already checked — no more blank form that silently drops everyone else on
 * save. The dialog still says plainly that saving replaces the whole set
 * (true, and still useful), and if the pending selection would remove any
 * current member, saving requires an explicit confirm naming how many would
 * go. A save that only adds members needs no confirmation.
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
  members,
  isArchived,
  onChanged,
}: {
  teamId: string;
  members: TeamMemberRow[];
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

  const activeMembers = members.filter((m) => m.status === 'ACTIVE');

  const [membersFor, setMembersFor] = useState<TeamGroupRow | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useSeededForm(
    membersFor?.id ?? 'closed',
    () => membersFor?.memberIds ?? [],
  );
  const [savingMembers, setSavingMembers] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{ removed: number; total: number } | null>(
    null,
  );

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
  };

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

  const doSaveMembers = async () => {
    if (!membersFor) return;
    setSavingMembers(true);
    try {
      await setTeamGroupMembers(teamId, membersFor.id, selectedMemberIds);
      toast.success(`Updated ${membersFor.name}'s membership.`);
      setMembersFor(null);
      setPendingRemoval(null);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not update membership', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setSavingMembers(false);
    }
  };

  /**
   * `setTeamGroupMembers` replaces the whole set, so unchecking anyone who is
   * currently a member is a real, silent removal. Saving a selection that
   * drops nobody goes straight through — the common case (creating a group,
   * adding people) stays a single click. Saving one that drops someone stops
   * here and shows exactly how many, via `pendingRemoval`.
   */
  const requestSaveMembers = () => {
    if (!membersFor) return;
    const currentIds = membersFor.memberIds;
    const removed = currentIds.filter((id) => !selectedMemberIds.includes(id));
    if (removed.length === 0) {
      void doSaveMembers();
      return;
    }
    setPendingRemoval({ removed: removed.length, total: currentIds.length });
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
              onClick={() => setMembersFor(row.original)}
            >
              Edit
            </Button>
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

      <Dialog
        open={Boolean(membersFor)}
        onOpenChange={(next) => {
          if (!next) {
            setMembersFor(null);
            setPendingRemoval(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {membersFor?.name} membership</DialogTitle>
            <DialogDescription>
              Saving replaces this group&apos;s entire membership with exactly who you check below —
              anyone left unchecked is removed from the group.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {activeMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active members on this team.</p>
            ) : (
              activeMembers.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedMemberIds.includes(m.id)}
                    onCheckedChange={() => toggleMember(m.id)}
                    aria-label={m.user?.name ?? m.user?.email ?? m.id}
                  />
                  <span>{m.user?.name ?? m.user?.email ?? m.id}</span>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersFor(null)} disabled={savingMembers}>
              Cancel
            </Button>
            <Button onClick={requestSaveMembers} disabled={savingMembers}>
              {savingMembers ? 'Saving…' : 'Save membership'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={Boolean(pendingRemoval)}
        title="Remove members?"
        description={
          pendingRemoval
            ? `This removes ${pendingRemoval.removed} of ${pendingRemoval.total} current members from ${membersFor?.name ?? 'this group'}.`
            : undefined
        }
        confirmLabel="Remove"
        onCancel={() => setPendingRemoval(null)}
        onConfirm={doSaveMembers}
      />

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
