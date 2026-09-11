'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  fetchTeamProgress,
  removeTeamMember,
  setTeamMemberRole,
  type TeamMemberProgress,
  type TeamMemberRole,
  type TeamMemberRow,
  type TeamProgressRow,
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
  const [progress, setProgress] = useState<TeamMemberProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const visible = useMemo(
    () => (showRemoved ? members : members.filter((m) => m.status !== 'REMOVED')),
    [members, showRemoved],
  );

  // "Courses done" and "Progress" are not on `TeamMemberRow` — they come
  // from `GET /:id/progress` (`resolveRosterProgress`), a second, INDEPENDENT
  // query keyed by the same team. It must never gate the roster itself: a
  // slow or failed roster-progress call still leaves every member visible,
  // with those two columns falling back to an em dash rather than blanking
  // the list or throwing.
  const {
    data: progressRows,
    isLoading: progressLoading,
    isError: progressError,
  } = useQuery({
    queryKey: ['admin-team-progress', teamId],
    queryFn: () => fetchTeamProgress(teamId),
    enabled: Boolean(teamId),
  });

  // Keyed by `user.id` — the join key `resolveRosterProgress` actually uses
  // (`userId` on the underlying `TeamMember` row), not either side's own
  // `id`/`memberId`.
  const progressByUserId = useMemo(() => {
    const map = new Map<string, TeamProgressRow>();
    for (const row of progressRows ?? []) {
      if (row.user?.id) map.set(row.user.id, row);
    }
    return map;
  }, [progressRows]);

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
        cell: ({ row }) => {
          if (progressLoading || progressError) return '—';
          const p = row.original.user?.id ? progressByUserId.get(row.original.user.id) : undefined;
          // No roster-progress row (e.g. joined today, never started
          // anything) renders as an em dash — a fabricated 0 would claim
          // something the join never actually confirmed.
          return p ? String(p.coursesCompleted) : '—';
        },
      },
      {
        id: 'progress',
        header: 'Progress',
        cell: ({ row }) => {
          if (progressLoading || progressError) return '—';
          const p = row.original.user?.id ? progressByUserId.get(row.original.user.id) : undefined;
          // No per-course percentage is computed anywhere in this stack
          // (see `resolveRosterProgress`) — "N of M courses" is the honest
          // label, not an implied percentage.
          return p ? `${p.coursesCompleted} of ${p.coursesStarted} courses` : '—';
        },
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
    [isArchived, progressByUserId, progressLoading, progressError],
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
          ) : progress ? (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Points</dt>
                  <dd className="font-medium">{progress.stats.points}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Level</dt>
                  <dd className="font-medium">{progress.stats.level}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Current streak</dt>
                  <dd className="font-medium">{progress.stats.currentStreak}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Longest streak</dt>
                  <dd className="font-medium">{progress.stats.longestStreak}</dd>
                </div>
              </dl>

              <div>
                <p className="mb-1 font-semibold text-foreground">Courses</p>
                {progress.courses.length === 0 ? (
                  <p className="text-muted-foreground">No courses started.</p>
                ) : (
                  <ul className="space-y-1">
                    {progress.courses.map((course) => (
                      <li key={course.id} className="flex justify-between gap-3">
                        <span>{course.title}</span>
                        <span className="text-muted-foreground">
                          {course.isCompleted ? 'Completed' : `${course.percent}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-1 font-semibold text-foreground">Paths</p>
                {progress.paths.length === 0 ? (
                  <p className="text-muted-foreground">Not enrolled in any paths.</p>
                ) : (
                  <ul className="space-y-1">
                    {progress.paths.map((path) => (
                      <li key={path.id} className="flex justify-between gap-3">
                        <span>{path.title}</span>
                        <span className="text-muted-foreground">
                          {path.completedItems} of {path.totalItems} items
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
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
