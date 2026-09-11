'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Section, Field, FieldGrid } from '@/components/shared/form/Section';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SuperAdminOnly } from '@/components/shared/SuperAdminOnly';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import {
  attachTeamSubscription,
  detachTeamSubscription,
  adminSetTeamSeats,
  dismissTeamSeatGap,
  fetchTeamAuditLog,
  formatCurrency,
  type TeamDetail,
  type TeamProcessor,
  type TeamAuditLogEntry,
} from '@/lib/api/teams';

type Subscription = NonNullable<TeamDetail['subscription']>;

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { message?: string } } };
  return anyErr.response?.data?.message || fallback;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function subscriptionTone(status: string | null) {
  const s = (status ?? '').toLowerCase();
  if (s === 'active') return 'success' as const;
  if (s === 'canceled' || s === 'past_due') return 'danger' as const;
  if (s === 'paused') return 'warning' as const;
  return 'neutral' as const;
}

/**
 * Summarises what an audit-log entry changed. `before`/`after` are whatever
 * shallow diff the writing route logged (see `logAdminAction` calls in
 * `modules/admin/teams.ts`) — not a schema, so this renders whatever keys are
 * actually there rather than assuming a fixed shape.
 */
function summariseChange(entry: TeamAuditLogEntry): string {
  const after = entry.after ?? {};
  const before = entry.before ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  if (keys.length === 0) return '—';
  return keys
    .map(
      (key) =>
        `${key}: ${JSON.stringify(before[key] ?? null)} → ${JSON.stringify(after[key] ?? null)}`,
    )
    .join(', ');
}

/**
 * Subscription card (attach/detach/seat-adjust), the seat-gap alert, and
 * change history. Detach is `SuperAdminOnly` because `DELETE
 * /:id/subscription` is `requireSuperAdmin` on the API — it revokes
 * entitlement for every active member at once, the same blast radius as
 * archive/restore on `TeamDetailClient`.
 *
 * `Team.reportedSeatGap` (`seatGap` here) is HEADROOM (`seats - used`), never
 * an error — the nightly `reconcileTeamSeats` cron that writes it says so
 * itself: "This may be normal headroom the team bought — or a failed Paddle
 * release. Check before acting," and the job is "report only, nothing was
 * changed." A team showing a gap of 2 has, in the ordinary case, bought two
 * spare seats. The ONLY action here is Dismiss — clearing the alert via
 * `dismissTeamSeatGap`, which writes nothing to `Subscription` and calls no
 * processor. There is deliberately no "reconcile" control: one that pushed
 * the processor's quantity down to current usage would silently cancel
 * seats a paying customer is entitled to. See `dismissTeamSeatGap`'s own doc
 * comment in `lib/api/teams.ts`.
 *
 * `subscription` on the wire (`teamDetailRow`, academy
 * `modules/admin/helpers/team-shape.ts`) is narrowed to exactly `{id, status,
 * seats, paidSeats, amount, currency}` — the `Subscription` model also has
 * `name`, `interval` and `expiry` (plan, billing cycle, renewal date), but
 * `teamDetailRow` does not select them, so they are not on the wire today.
 * Rather than fabricate a plan name or a renewal date the API never sent,
 * those three fields render an honest em dash — the same non-gating
 * convention `PathsTab`'s "Items"/"Started" columns use for data no backend
 * route yet exposes.
 */
export function BillingTab({
  teamId,
  processor,
  subscription,
  seatGap,
  isArchived,
  onChanged,
}: {
  teamId: string;
  processor: TeamProcessor;
  subscription: Subscription | null;
  seatGap: number | null;
  isArchived: boolean;
  onChanged: () => void;
}) {
  const {
    data: auditLog,
    isLoading: auditLoading,
    isError: auditError,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ['admin-team-audit-log', teamId],
    queryFn: () => fetchTeamAuditLog(teamId),
    enabled: Boolean(teamId),
  });

  const [dismissing, setDismissing] = useState(false);

  const [attaching, setAttaching] = useState(false);
  const [attachDraft, setAttachDraft] = useSeededForm(attaching ? 'open' : 'closed', () => ({
    subscriptionId: '',
    seats: '',
  }));
  const [attachSaving, setAttachSaving] = useState(false);

  const [detachOpen, setDetachOpen] = useState(false);
  const [detaching, setDetaching] = useState(false);

  const [seatsOpen, setSeatsOpen] = useState(false);
  const [seatsDraft, setSeatsDraft] = useSeededForm(seatsOpen ? 'open' : 'closed', () =>
    String(subscription?.paidSeats ?? ''),
  );
  const [seatsSaving, setSeatsSaving] = useState(false);

  const doDismiss = async () => {
    setDismissing(true);
    try {
      await dismissTeamSeatGap(teamId);
      toast.success('Alert dismissed. No seats were changed.');
      onChanged();
    } catch (error) {
      toast.error('Could not dismiss the alert', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setDismissing(false);
    }
  };

  const doAttach = async () => {
    const subscriptionId = attachDraft.subscriptionId.trim();
    const seats = Number(attachDraft.seats);
    if (!subscriptionId || !Number.isFinite(seats) || seats < 1) return;
    setAttachSaving(true);
    try {
      await attachTeamSubscription(teamId, subscriptionId, seats);
      toast.success('Subscription attached.');
      setAttaching(false);
      onChanged();
    } catch (error) {
      toast.error('Could not attach the subscription', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setAttachSaving(false);
    }
  };

  const doDetach = async () => {
    setDetachOpen(false);
    setDetaching(true);
    try {
      await detachTeamSubscription(teamId);
      toast.success('Subscription detached.');
      onChanged();
    } catch (error) {
      toast.error('Could not detach the subscription', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setDetaching(false);
    }
  };

  const doSetSeats = async () => {
    const seats = Number(seatsDraft);
    if (!Number.isFinite(seats) || seats < 0) return;
    setSeatsSaving(true);
    try {
      await adminSetTeamSeats(teamId, seats);
      toast.success('Seats updated.');
      setSeatsOpen(false);
      onChanged();
    } catch (error) {
      // The 409 the API sends here names the exact usage figure ("That team
      // already has N seats in use...") — surfaced verbatim, never swapped
      // for a generic failure toast.
      toast.error('Could not adjust seats', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setSeatsSaving(false);
    }
  };

  const entries = auditLog?.data ?? [];
  const columns = useMemo<ColumnDef<TeamAuditLogEntry>[]>(
    () => [
      { id: 'when', header: 'When', cell: ({ row }) => fmt(row.original.createdAt) },
      { id: 'admin', header: 'Admin', cell: ({ row }) => row.original.adminName },
      { id: 'action', header: 'Action', cell: ({ row }) => row.original.action },
      { id: 'change', header: 'Change', cell: ({ row }) => summariseChange(row.original) },
    ],
    [],
  );
  const table = useReactTable({ data: entries, columns, getCoreRowModel: getCoreRowModel() });

  const totalAmount =
    subscription?.amount != null && subscription.paidSeats != null
      ? subscription.amount * subscription.paidSeats
      : null;

  return (
    <div className="space-y-4">
      {seatGap !== null ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>
              Gap: {seatGap} unused seat{seatGap === 1 ? '' : 's'}. This may be normal headroom the
              team bought — or a failed Paddle release. Check before acting.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={doDismiss} disabled={dismissing}>
                {dismissing ? 'Dismissing…' : 'Dismiss alert'}
              </Button>
              <span className="text-xs">
                Dismissing clears this alert only — it changes no seats and calls no payment
                processor.
              </span>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Section title="Subscription" id="section-billing-subscription">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Plan</dt>
            {/* Not on the wire — see this file's module doc. */}
            <dd>—</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              {subscription?.status ? (
                <StatusBadge
                  label={subscription.status}
                  tone={subscriptionTone(subscription.status)}
                />
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Processor</dt>
            <dd>{processor ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Cycle</dt>
            {/* Not on the wire — see this file's module doc. */}
            <dd>—</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Per-seat price</dt>
            <dd>{formatCurrency(subscription?.amount ?? null, subscription?.currency ?? null)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Billed seats</dt>
            <dd>{subscription ? subscription.paidSeats : '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Total</dt>
            <dd>{formatCurrency(totalAmount, subscription?.currency ?? null)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Renews</dt>
            {/* Not on the wire — see this file's module doc. */}
            <dd>—</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Subscription ID</dt>
            <dd className="font-mono text-xs">{subscription?.id ?? '—'}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 pt-2">
          {subscription ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={isArchived}
                onClick={() => setSeatsOpen(true)}
              >
                Adjust seats
              </Button>
              <SuperAdminOnly reason="Forbidden: super admin access required">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isArchived || detaching}
                  onClick={() => setDetachOpen(true)}
                >
                  {detaching ? 'Detaching…' : 'Detach'}
                </Button>
              </SuperAdminOnly>
            </>
          ) : (
            <Button size="sm" disabled={isArchived} onClick={() => setAttaching(true)}>
              Attach subscription
            </Button>
          )}
        </div>
      </Section>

      <Section title="Change history" id="section-billing-history">
        {auditLoading ? (
          <LoadingState label="Loading change history…" />
        ) : auditError ? (
          <ErrorState message="Failed to load change history." onRetry={() => refetchAudit()} />
        ) : entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <Card className="overflow-hidden p-0">
            <DataTable table={table} mobileTitle={(row) => row.original.action} />
          </Card>
        )}
      </Section>

      <Dialog open={attaching} onOpenChange={(next) => !next && setAttaching(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach subscription</DialogTitle>
          </DialogHeader>
          <FieldGrid>
            <Field label="Subscription ID" htmlFor="attach-subscription-id" required>
              <Input
                id="attach-subscription-id"
                value={attachDraft.subscriptionId}
                onChange={(event) =>
                  setAttachDraft((d) => ({ ...d, subscriptionId: event.target.value }))
                }
              />
            </Field>
            <Field label="Seats" htmlFor="attach-seats" required>
              <Input
                id="attach-seats"
                type="number"
                min={1}
                value={attachDraft.seats}
                onChange={(event) => setAttachDraft((d) => ({ ...d, seats: event.target.value }))}
              />
            </Field>
          </FieldGrid>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttaching(false)} disabled={attachSaving}>
              Cancel
            </Button>
            <Button
              onClick={doAttach}
              disabled={
                attachSaving || !attachDraft.subscriptionId.trim() || !attachDraft.seats.trim()
              }
            >
              {attachSaving ? 'Attaching…' : 'Attach'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={seatsOpen} onOpenChange={(next) => !next && setSeatsOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust seats</DialogTitle>
          </DialogHeader>
          <Field
            label="Seats"
            htmlFor="adjust-seats"
            required
            hint="Cannot drop below active members plus pending invites — the API refuses and names the exact figure in use."
          >
            <Input
              id="adjust-seats"
              type="number"
              min={0}
              value={seatsDraft}
              onChange={(event) => setSeatsDraft(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeatsOpen(false)} disabled={seatsSaving}>
              Cancel
            </Button>
            <Button onClick={doSetSeats} disabled={seatsSaving || !seatsDraft.trim()}>
              {seatsSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={detachOpen}
        confirmLabel="Yes, detach"
        title="Detach this subscription?"
        description="This revokes entitlement for every active member immediately. The subscription itself is not cancelled — it is only unlinked from this team, and can be re-attached later."
        onCancel={() => setDetachOpen(false)}
        onConfirm={doDetach}
      />
    </div>
  );
}

export default BillingTab;
