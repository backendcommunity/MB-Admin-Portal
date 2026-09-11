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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/shared/form/Section';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import {
  fetchTeamAssignments,
  fetchTeamGroups,
  createTeamAssignment,
  updateTeamAssignment,
  deleteTeamAssignment,
  type AssignmentTargetType,
  type TeamAssignmentListRow,
  type TeamGroupRow,
  type TeamMemberRow,
} from '@/lib/api/teams';

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

function fmt(iso: string | null) {
  if (!iso) return '—';
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

function audienceTone(type: AssignmentTargetType): Tone {
  if (type === 'TEAM') return 'info';
  if (type === 'GROUP') return 'success';
  return 'warning'; // MEMBER
}

function audienceLabel(type: AssignmentTargetType) {
  if (type === 'TEAM') return 'Team';
  if (type === 'GROUP') return 'Group';
  return 'Member';
}

/**
 * Where an "Edit" action would need the assignment ITEM editor — explicitly
 * out of scope for this slice, the heaviest surface in the feature — this
 * links out to the team's own manager instead of reimplementing it.
 *
 * There is no established base URL for that customer-facing app anywhere in
 * this repo's env config today (`NEXT_PUBLIC_API_URL` names the API host,
 * not necessarily the origin the team manager is served from).
 * `NEXT_PUBLIC_TEAM_APP_URL` is read with a best-effort fallback — confirm
 * the real origin with product/eng before this ships; flagged in the task
 * report rather than silently guessed past.
 */
function teamManagerHref(assignmentId: string): string {
  const base = process.env.NEXT_PUBLIC_TEAM_APP_URL || 'https://masteringbackend.com';
  return `${base.replace(/\/$/, '')}/team?assignmentId=${assignmentId}`;
}

type TargetDraft = {
  targetType: AssignmentTargetType;
  targetGroupId: string | null;
  targetTeamMemberId: string | null;
};

/** The audience picker shared by the create and retarget dialogs. */
function TargetFields({
  draft,
  onChange,
  groups,
  members,
}: {
  draft: TargetDraft;
  onChange: (next: TargetDraft) => void;
  groups: TeamGroupRow[];
  members: TeamMemberRow[];
}) {
  const activeMembers = members.filter((m) => m.status === 'ACTIVE');
  return (
    <>
      <Field label="Audience" htmlFor="assignment-target-type" required>
        <Select
          value={draft.targetType}
          onValueChange={(value) =>
            onChange({
              targetType: value as AssignmentTargetType,
              targetGroupId: null,
              targetTeamMemberId: null,
            })
          }
        >
          <SelectTrigger id="assignment-target-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TEAM">Whole team</SelectItem>
            <SelectItem value="GROUP">A group</SelectItem>
            <SelectItem value="MEMBER">One person</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {draft.targetType === 'GROUP' ? (
        <Field label="Group" htmlFor="assignment-target-detail" required>
          <Select
            value={draft.targetGroupId ?? ''}
            onValueChange={(value) => onChange({ ...draft, targetGroupId: value })}
          >
            <SelectTrigger id="assignment-target-detail">
              <SelectValue placeholder="Choose a group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {draft.targetType === 'MEMBER' ? (
        <Field label="Person" htmlFor="assignment-target-detail" required>
          <Select
            value={draft.targetTeamMemberId ?? ''}
            onValueChange={(value) => onChange({ ...draft, targetTeamMemberId: value })}
          >
            <SelectTrigger id="assignment-target-detail">
              <SelectValue placeholder="Choose a person" />
            </SelectTrigger>
            <SelectContent>
              {activeMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.user?.name ?? m.user?.email ?? m.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
    </>
  );
}

/** How many people the current draft resolves to — null while incomplete. */
function audienceSizeFor(
  draft: TargetDraft,
  groups: TeamGroupRow[],
  members: TeamMemberRow[],
): number | null {
  if (draft.targetType === 'TEAM') return members.filter((m) => m.status === 'ACTIVE').length;
  if (draft.targetType === 'GROUP') {
    return draft.targetGroupId
      ? (groups.find((g) => g.id === draft.targetGroupId)?.memberCount ?? null)
      : null;
  }
  return draft.targetTeamMemberId ? 1 : null;
}

/**
 * Create, rename, retarget and delete a team's assignments. The item editor
 * lives at `/team` on the team's own manager (see `teamManagerHref`) —
 * explicitly out of scope here, so "Edit items" links out instead of
 * reimplementing it.
 *
 * `POST /:id/assignments` fires `notifyAssigned` — every person the target
 * resolves to gets emailed the moment the assignment is created. The create
 * dialog says so plainly. `PATCH` (rename or retarget) does NOT re-notify
 * (`AdminUpdateAssignment` in `modules/admin/teams.ts` has no
 * `notifyTeam`/`notifyAssigned` call at all) — the retarget dialog makes no
 * email claim, because making one up here would be inventing a consequence
 * the API does not actually have.
 */
export function AssignmentsTab({
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
    queryKey: ['admin-team-assignments', teamId],
    queryFn: () => fetchTeamAssignments(teamId),
    enabled: Boolean(teamId),
  });

  // Needed for the GROUP branch of the audience picker (create + retarget).
  // Shares its query key with GroupsTab, so switching tabs reuses the cache.
  const { data: groupsData } = useQuery({
    queryKey: ['admin-team-groups', teamId],
    queryFn: () => fetchTeamGroups(teamId),
    enabled: Boolean(teamId),
  });
  const groups = groupsData ?? [];

  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useSeededForm(creating ? 'open' : 'closed', () => ({
    name: '',
    dueAt: '',
    target: {
      targetType: 'TEAM' as AssignmentTargetType,
      targetGroupId: null,
      targetTeamMemberId: null,
    } as TargetDraft,
  }));
  const [saving, setSaving] = useState(false);

  const [renameFor, setRenameFor] = useState<TeamAssignmentListRow | null>(null);
  const [renameName, setRenameName] = useSeededForm(
    renameFor?.id ?? 'closed',
    () => renameFor?.name ?? '',
  );
  const [renaming, setRenaming] = useState(false);

  const [retargetFor, setRetargetFor] = useState<TeamAssignmentListRow | null>(null);
  const [retargetDraft, setRetargetDraft] = useSeededForm(
    retargetFor?.id ?? 'closed',
    () =>
      ({
        targetType: retargetFor?.targetType ?? 'TEAM',
        targetGroupId: retargetFor?.targetGroupId ?? null,
        targetTeamMemberId: retargetFor?.targetTeamMemberId ?? null,
      }) as TargetDraft,
  );
  const [retargeting, setRetargeting] = useState(false);

  const [deleteFor, setDeleteFor] = useState<TeamAssignmentListRow | null>(null);

  const targetIsIncomplete = (target: TargetDraft) =>
    (target.targetType === 'GROUP' && !target.targetGroupId) ||
    (target.targetType === 'MEMBER' && !target.targetTeamMemberId);

  const doCreate = async () => {
    const name = createDraft.name.trim();
    if (!name || targetIsIncomplete(createDraft.target)) return;
    setSaving(true);
    try {
      await createTeamAssignment(teamId, {
        name,
        dueAt: createDraft.dueAt ? new Date(createDraft.dueAt).toISOString() : null,
        targetType: createDraft.target.targetType,
        targetGroupId: createDraft.target.targetGroupId,
        targetTeamMemberId: createDraft.target.targetTeamMemberId,
      });
      toast.success(`Created ${name} — the audience has been emailed.`);
      setCreating(false);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not create the assignment', {
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
      await updateTeamAssignment(teamId, renameFor.id, { name });
      toast.success(`Renamed to ${name}.`);
      setRenameFor(null);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not rename the assignment', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setRenaming(false);
    }
  };

  const doRetarget = async () => {
    if (!retargetFor || targetIsIncomplete(retargetDraft)) return;
    setRetargeting(true);
    try {
      await updateTeamAssignment(teamId, retargetFor.id, {
        targetType: retargetDraft.targetType,
        targetGroupId: retargetDraft.targetGroupId,
        targetTeamMemberId: retargetDraft.targetTeamMemberId,
      });
      toast.success('Audience updated.');
      setRetargetFor(null);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not retarget the assignment', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setRetargeting(false);
    }
  };

  const doDelete = async () => {
    const assignment = deleteFor;
    setDeleteFor(null);
    if (!assignment) return;
    try {
      await deleteTeamAssignment(teamId, assignment.id);
      toast.success(`Deleted ${assignment.name}.`);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not delete the assignment', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    }
  };

  const columns = useMemo<ColumnDef<TeamAssignmentListRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Assignment',
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'audience',
        header: 'Audience',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <StatusBadge
              label={audienceLabel(row.original.targetType)}
              tone={audienceTone(row.original.targetType)}
            />
            <span className="text-sm text-foreground">{row.original.targetLabel}</span>
          </div>
        ),
      },
      {
        id: 'items',
        header: 'Items',
        meta: { align: 'right' as const },
        cell: ({ row }) => row.original.itemCount,
      },
      {
        id: 'due',
        header: 'Due',
        cell: ({ row }) => {
          const a = row.original;
          if (!a.dueAt) return '—';
          return <StatusBadge label={fmt(a.dueAt)} tone={a.isOverdue ? 'danger' : 'neutral'} />;
        },
      },
      {
        id: 'completion',
        header: 'Completion',
        cell: ({ row }) => `${row.original.doneCount} of ${row.original.audienceSize}`,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={isArchived}
                onClick={() => setRenameFor(a)}
              >
                Rename
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isArchived}
                onClick={() => setRetargetFor(a)}
              >
                Retarget
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <a href={teamManagerHref(a.id)} target="_blank" rel="noreferrer">
                  Edit items
                </a>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={isArchived}
                onClick={() => setDeleteFor(a)}
              >
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [isArchived],
  );

  const assignments = data ?? [];
  const table = useReactTable({ data: assignments, columns, getCoreRowModel: getCoreRowModel() });

  if (isLoading) return <LoadingState label="Loading assignments…" />;
  if (isError)
    return <ErrorState message="Failed to load assignments." onRetry={() => refetch()} />;

  const previewAudienceSize = audienceSizeFor(createDraft.target, groups, members);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Assignments</span>
        <Button size="sm" disabled={isArchived} onClick={() => setCreating(true)}>
          New assignment
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <DataTable table={table} mobileTitle={(row) => row.original.name} />
      </Card>
      {assignments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No assignments yet.</p>
      ) : null}

      <Dialog open={creating} onOpenChange={(next) => !next && setCreating(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New assignment</DialogTitle>
            <DialogDescription>
              Creating this assignment emails everyone in the audience right away — they are
              genuinely assigned this the moment you click Create.
            </DialogDescription>
          </DialogHeader>

          <Field label="Name" htmlFor="assignment-name" required>
            <Input
              id="assignment-name"
              value={createDraft.name}
              onChange={(event) => setCreateDraft((d) => ({ ...d, name: event.target.value }))}
            />
          </Field>

          <Field label="Due date" htmlFor="assignment-due" hint="Optional.">
            <Input
              id="assignment-due"
              type="date"
              value={createDraft.dueAt}
              onChange={(event) => setCreateDraft((d) => ({ ...d, dueAt: event.target.value }))}
            />
          </Field>

          <TargetFields
            draft={createDraft.target}
            onChange={(next) => setCreateDraft((d) => ({ ...d, target: next }))}
            groups={groups}
            members={members}
          />

          <div className="rounded-lg border border-info/40 bg-info-wash p-3 text-xs text-info">
            {previewAudienceSize !== null
              ? `This emails ${previewAudienceSize} ${previewAudienceSize === 1 ? 'person' : 'people'} right now.`
              : 'Choose an audience to see how many people this emails.'}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={doCreate}
              disabled={
                saving || !createDraft.name.trim() || targetIsIncomplete(createDraft.target)
              }
            >
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
          <Field label="Name" htmlFor="assignment-rename" required>
            <Input
              id="assignment-rename"
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

      <Dialog open={Boolean(retargetFor)} onOpenChange={(next) => !next && setRetargetFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Retarget {retargetFor?.name}</DialogTitle>
          </DialogHeader>
          <TargetFields
            draft={retargetDraft}
            onChange={setRetargetDraft}
            groups={groups}
            members={members}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetargetFor(null)} disabled={retargeting}>
              Cancel
            </Button>
            <Button
              onClick={doRetarget}
              disabled={retargeting || targetIsIncomplete(retargetDraft)}
            >
              {retargeting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={Boolean(deleteFor)}
        onCancel={() => setDeleteFor(null)}
        title={`Delete ${deleteFor?.name ?? 'this assignment'}?`}
        description="This removes the assignment and every completion tick tracked against it. It cannot be undone."
        onConfirm={doDelete}
      />
    </div>
  );
}

export default AssignmentsTab;
