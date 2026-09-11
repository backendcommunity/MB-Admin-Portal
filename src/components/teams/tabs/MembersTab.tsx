'use client';

import { useMemo, useState } from 'react';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import {
  fetchTeamMemberProgress,
  removeTeamMember,
  setTeamMemberRole,
  type TeamMemberRole,
  type TeamMemberRow,
} from '@/lib/api/teams';

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

function memberStatusTone(status: string): Tone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'REMOVED') return 'neutral';
  return 'info';
}

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

const ROLES: TeamMemberRole[] = ['ADMIN', 'MEMBER'];

/**
 * Completes slice 1's read-only roster: change role, remove, and per-member
 * progress. Both writes are `requireStrictAdmin` on the API — this whole
 * page is already gated to ADMIN/SUPER_ADMIN by `ProtectedPage`, so neither
 * needs its own `SuperAdminOnly` wrapper. Remove is still behind a confirm
 * that names the person, because it revokes their entitlement immediately.
 *
 * `members` and `isArchived` are handed down from `TeamDetailClient`'s own
 * `fetchTeam` query rather than re-fetched here — there is no dedicated
 * members endpoint, the roster only ever existed embedded in team detail.
 * `onChanged` is that same query's `invalidate` (admin-teams list +
 * refetch), reused as-is so every write here keeps the shell's stats in
 * sync too.
 */
export function MembersTab({
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
  const [showRemoved, setShowRemoved] = useState(false);
  const [roleFor, setRoleFor] = useState<TeamMemberRow | null>(null);
  const [nextRole, setNextRole] = useState<TeamMemberRole>('MEMBER');
  const [savingRole, setSavingRole] = useState(false);
  const [removeFor, setRemoveFor] = useState<TeamMemberRow | null>(null);
  const [progressFor, setProgressFor] = useState<TeamMemberRow | null>(null);
  const [progress, setProgress] = useState<Record<string, unknown> | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const visible = useMemo(
    () => (showRemoved ? members : members.filter((m) => m.status !== 'REMOVED')),
    [members, showRemoved],
  );

  const openRole = (member: TeamMemberRow) => {
    setNextRole(member.role === 'ADMIN' ? 'ADMIN' : 'MEMBER');
    setRoleFor(member);
  };

  const openProgress = async (member: TeamMemberRow) => {
    setProgressFor(member);
    setProgress(null);
    setLoadingProgress(true);
    try {
      const result = await fetchTeamMemberProgress(teamId, member.id);
      setProgress(result);
    } catch (error) {
      toast.error('Could not load their progress', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
      setProgressFor(null);
    } finally {
      setLoadingProgress(false);
    }
  };

  const saveRole = async () => {
    if (!roleFor) return;
    setSavingRole(true);
    try {
      await setTeamMemberRole(teamId, roleFor.id, nextRole);
      toast.success(`${roleFor.user?.name ?? 'Member'} is now ${nextRole}.`);
      setRoleFor(null);
      onChanged();
    } catch (error) {
      toast.error('Could not change their role', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setSavingRole(false);
    }
  };

  const doRemove = async () => {
    const member = removeFor;
    setRemoveFor(null);
    if (!member) return;
    try {
      await removeTeamMember(teamId, member.id);
      toast.success(`Removed ${member.user?.name ?? 'them'} from the team.`);
      onChanged();
    } catch (error) {
      toast.error('Could not remove them', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    }
  };

  const columns = useMemo<ColumnDef<TeamMemberRow>[]>(
    () => [
      {
        id: 'person',
        header: 'Person',
        cell: ({ row }) => (
          <span>
            <span className="block font-medium">{row.original.user?.name ?? '—'}</span>
            <span className="block text-xs text-muted-foreground">
              {row.original.user?.email ?? '—'}
            </span>
          </span>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.role}
            tone={row.original.role === 'OWNER' ? 'info' : 'neutral'}
          />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge label={row.original.status} tone={memberStatusTone(row.original.status)} />
        ),
      },
      {
        id: 'joined',
        header: 'Joined',
        cell: ({ row }) => fmt(row.original.joinedAt),
      },
      {
        id: 'coursesDone',
        header: 'Courses done',
        meta: { align: 'right' as const },
        // `TeamMemberRow` carries no per-member course or progress figures —
        // those only exist per member, on demand, behind
        // `fetchTeamMemberProgress` ("Progress" action below). Rendering a
        // number here would be fabricated; an em dash is the honest state
        // until the API grows a batched figure for the roster.
        cell: () => '—',
      },
      {
        id: 'progress',
        header: 'Progress',
        cell: () => '—',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const member = row.original;
          if (member.status !== 'ACTIVE') return null;
          // Neither role change nor removal is offered for the OWNER row.
          // The API 409s both ("a team is never ownerless") — ownership
          // moves only through Transfer, on the Overview tab. The static
          // prototype shows a "Role" button here regardless of role; that
          // button would only ever end in a 409, so it is not carried over.
          if (member.role === 'OWNER') {
            return (
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => openProgress(member)}>
                  Progress
                </Button>
              </div>
            );
          }
          return (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => openProgress(member)}>
                Progress
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openRole(member)}
                disabled={isArchived}
              >
                Role
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setRemoveFor(member)}
                disabled={isArchived}
              >
                Remove
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isArchived],
  );

  const table = useReactTable({ data: visible, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Members</span>
        <label
          htmlFor="show-removed"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <input
            id="show-removed"
            type="checkbox"
            checked={showRemoved}
            onChange={(event) => setShowRemoved(event.target.checked)}
          />
          Show removed
        </label>
      </div>

      <Card className="overflow-hidden p-0">
        <DataTable
          table={table}
          mobileTitle={(row) => row.original.user?.name ?? row.original.user?.email ?? '—'}
        />
      </Card>
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No members found.</p>
      ) : null}

      <Dialog open={Boolean(roleFor)} onOpenChange={(next) => !next && setRoleFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change {roleFor?.user?.name ?? 'their'} role</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            {ROLES.map((r) => (
              <Button
                key={r}
                type="button"
                variant={nextRole === r ? 'default' : 'outline'}
                onClick={() => setNextRole(r)}
              >
                {r}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleFor(null)} disabled={savingRole}>
              Cancel
            </Button>
            <Button onClick={saveRole} disabled={savingRole}>
              {savingRole ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(progressFor)} onOpenChange={(next) => !next && setProgressFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{progressFor?.user?.name ?? 'Member'} — progress</DialogTitle>
          </DialogHeader>
          {loadingProgress ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : progress && Object.keys(progress).length > 0 ? (
            <dl className="space-y-1 text-sm">
              {Object.entries(progress).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="text-right font-medium">{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={Boolean(removeFor)}
        onCancel={() => setRemoveFor(null)}
        title={`Remove ${removeFor?.user?.name ?? 'this member'} from the team?`}
        description="They lose team entitlement immediately. Their progress is not deleted, and the seat they held is freed for reuse."
        onConfirm={doRemove}
      />
    </div>
  );
}

export default MembersTab;
