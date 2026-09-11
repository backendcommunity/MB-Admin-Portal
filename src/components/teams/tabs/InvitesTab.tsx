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
import { Field } from '@/components/shared/form/Section';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { SuperAdminOnly } from '@/components/shared/SuperAdminOnly';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import {
  fetchTeamInvites,
  inviteTeamMember,
  resendTeamInvite,
  revokeTeamInvite,
  type TeamInviteRow,
  type TeamSeatUsage,
} from '@/lib/api/teams';

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

const EMAIL_SHAPE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

function outcomeTone(status: string): 'success' | 'neutral' | 'danger' {
  if (status === 'ACCEPTED') return 'success';
  if (status === 'EXPIRED') return 'danger';
  return 'neutral'; // REVOKED
}

/**
 * Pending invites plus history. Owns its own query against
 * `GET /:id/invites` — unlike Members, invites are not embedded in team
 * detail, so this cannot borrow the shell's `fetchTeam` cache.
 *
 * `seats` IS borrowed from the shell (`TeamDetail.seats`, already loaded
 * before any tab renders) rather than re-fetched — it is the figure the
 * invite dialog's money copy depends on, and staleness there is exactly the
 * kind of lie the seat rule warns about, so every write here also calls the
 * shell's `onChanged` to refresh it, on top of this tab's own `refetch`.
 */
export function InvitesTab({
  teamId,
  seats,
  isArchived,
  onChanged,
}: {
  teamId: string;
  seats: TeamSeatUsage;
  isArchived: boolean;
  onChanged: () => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-team-invites', teamId],
    queryFn: () => fetchTeamInvites(teamId),
    enabled: Boolean(teamId),
  });

  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const doResend = async (invite: TeamInviteRow) => {
    setBusyId(invite.id);
    try {
      await resendTeamInvite(teamId, invite.id);
      toast.success(`Resent the invite to ${invite.email}.`);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not resend it', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const doRevoke = async (invite: TeamInviteRow) => {
    setBusyId(invite.id);
    try {
      await revokeTeamInvite(teamId, invite.id);
      toast.success(`Revoked the invite to ${invite.email} — the seat is released for reuse.`);
      await refetch();
      onChanged();
    } catch (error) {
      toast.error('Could not revoke it', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const pendingColumns = useMemo<ColumnDef<TeamInviteRow>[]>(
    () => [
      { id: 'email', header: 'Email', cell: ({ row }) => row.original.email },
      {
        id: 'invitedBy',
        header: 'Invited by',
        // Only `invitedByUserId` — a raw id — comes back from the API. There
        // is no join to a staff name/email on this route, unlike
        // `fetchTeamAuditLog`'s `adminName`/`adminEmail`. Rendered as-is
        // rather than guessed at.
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.invitedByUserId}
          </span>
        ),
      },
      { id: 'sent', header: 'Sent', cell: ({ row }) => fmt(row.original.createdAt) },
      {
        id: 'expires',
        header: 'Expires',
        cell: ({ row }) => {
          const expired = new Date(row.original.expiresAt).getTime() < Date.now();
          return (
            <StatusBadge
              label={expired ? 'expired' : fmt(row.original.expiresAt)}
              tone={expired ? 'danger' : 'warning'}
            />
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const invite = row.original;
          const busy = busyId === invite.id;
          return (
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={isArchived || busy}
                onClick={() => doResend(invite)}
              >
                Resend
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={isArchived || busy}
                onClick={() => doRevoke(invite)}
              >
                Revoke
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isArchived, busyId],
  );

  const historyColumns = useMemo<ColumnDef<TeamInviteRow>[]>(
    () => [
      { id: 'email', header: 'Email', cell: ({ row }) => row.original.email },
      {
        id: 'outcome',
        header: 'Outcome',
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.status.toLowerCase()}
            tone={outcomeTone(row.original.status)}
          />
        ),
      },
      { id: 'when', header: 'When', cell: ({ row }) => fmt(row.original.createdAt) },
    ],
    [],
  );

  const pending = data?.pending ?? [];
  const history = data?.history ?? [];

  const pendingTable = useReactTable({
    data: pending,
    columns: pendingColumns,
    getCoreRowModel: getCoreRowModel(),
  });
  const historyTable = useReactTable({
    data: history,
    columns: historyColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <LoadingState label="Loading invites…" />;
  if (isError) return <ErrorState message="Failed to load invites." onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Pending invites</span>
          <Button size="sm" disabled={isArchived} onClick={() => setInviting(true)}>
            Invite member
          </Button>
        </div>

        <div className="mb-3 rounded-lg border border-info/40 bg-info-wash p-3 text-xs text-info">
          A pending invite <b>holds a seat</b>. Revoking releases the seat for reuse but never
          lowers <span className="font-mono">paidSeats</span> — the period is already funded, which
          is what makes a replacement free until renewal.
        </div>

        <Card className="overflow-hidden p-0">
          <DataTable table={pendingTable} mobileTitle={(row) => row.original.email} />
        </Card>
        {pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No pending invites.</p>
        ) : null}
      </div>

      <div>
        <div className="mb-3">
          <span className="text-sm font-semibold text-foreground">Recent invite history</span>
        </div>
        <Card className="overflow-hidden p-0">
          <DataTable table={historyTable} mobileTitle={(row) => row.original.email} />
        </Card>
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No invite history yet.</p>
        ) : null}
      </div>

      <InviteMemberDialog
        open={inviting}
        onOpenChange={setInviting}
        teamId={teamId}
        seats={seats}
        onInvited={async () => {
          await refetch();
          onChanged();
        }}
      />
    </div>
  );
}

/**
 * THE money-honest dialog. `seats.available` decides which of two mutually
 * exclusive states renders — never both, never neither:
 *
 * - `available > 0`: this invite spends a seat already paid for. Free,
 *   plainly stated, no gating.
 * - `available === 0`: sending it makes the API add a seat and charge the
 *   customer's card. Stated plainly, and the submit control is wrapped in
 *   `SuperAdminOnly` — the API itself 403s a non-super-admin here, so an
 *   ADMIN must never see an enabled button that only ends in that 403 after
 *   they've typed an email and clicked send.
 */
function InviteMemberDialog({
  open,
  onOpenChange,
  teamId,
  seats,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  seats: TeamSeatUsage;
  onInvited: () => void | Promise<void>;
}) {
  const [email, setEmail] = useSeededForm(open ? 'open' : 'closed', () => '');
  const [sending, setSending] = useState(false);
  const trimmed = email.trim();
  const valid = EMAIL_SHAPE.test(trimmed);
  const chargesCard = seats.available < 1;

  const submit = async () => {
    if (!valid) return;
    setSending(true);
    try {
      await inviteTeamMember(teamId, trimmed);
      toast.success(`Invite sent to ${trimmed}.`);
      await onInvited();
      onOpenChange(false);
    } catch (error) {
      toast.error('Could not send the invite', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setSending(false);
    }
  };

  const sendButton = (
    <Button onClick={submit} disabled={sending || !valid}>
      {sending ? 'Sending…' : 'Send invite'}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>Sends a team invite on the team&apos;s behalf.</DialogDescription>
        </DialogHeader>

        <Field label="Email" htmlFor="invite-email" required>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@kuda.com"
          />
        </Field>

        {chargesCard ? (
          <div className="rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
            This team has no spare seats. Sending this invite adds a seat and{' '}
            <b>charges the customer&apos;s card</b>. Only a super admin can do this.
          </div>
        ) : (
          <div className="rounded-lg border border-info/40 bg-info-wash p-3 text-xs text-info">
            This team has {seats.available} spare seat{seats.available === 1 ? '' : 's'}. This
            invite uses one and <b>costs nothing</b>.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          {chargesCard ? (
            <SuperAdminOnly reason="Adding a seat charges the customer's card — super admin only">
              {sendButton}
            </SuperAdminOnly>
          ) : (
            sendButton
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InvitesTab;
