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
  recordManualTeamPayment,
  updateManualTeamPayment,
  compTeam,
  uncompTeam,
  isEntitlingSubscriptionStatus,
  formatCurrency,
  type TeamDetail,
  type TeamProcessor,
  type TeamAuditLogEntry,
} from '@/lib/api/teams';

/** One year from today, as `yyyy-mm-dd` for a native date input. */
function defaultExpiry(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

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
 * `modules/admin/helpers/team-shape.ts`) carries `plan`, `interval` and
 * `expiry` alongside `{id, status, seats, paidSeats, amount, currency}`.
 * Any of the three can genuinely be `null` (e.g. a subscription attached
 * without a linked `Plan` row, or one with no billing interval recorded) —
 * those render an honest em dash rather than a fabricated default. In
 * particular a null `interval` must never be guessed as "Monthly".
 */
export function BillingTab({
  teamId,
  processor,
  subscription,
  seatGap,
  comped,
  isArchived,
  onChanged,
}: {
  teamId: string;
  processor: TeamProcessor;
  subscription: Subscription | null;
  seatGap: number | null;
  comped: boolean;
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

  const isManual = processor === 'MANUAL';

  const [manualOpen, setManualOpen] = useState(false);
  const [manualDraft, setManualDraft] = useSeededForm(manualOpen ? 'open' : 'closed', () => ({
    seats: String(subscription?.paidSeats ?? ''),
    expiry: subscription?.expiry ? subscription.expiry.slice(0, 10) : defaultExpiry(),
    amount: subscription?.amount != null ? String(subscription.amount) : '',
    currency: subscription?.currency ?? '',
  }));
  const [manualSaving, setManualSaving] = useState(false);

  const [comping, setComping] = useState(false);
  const [uncompOpen, setUncompOpen] = useState(false);
  const [uncomping, setUncomping] = useState(false);

  const hasEntitlingSubscription = isEntitlingSubscriptionStatus(subscription?.status);

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

  /**
   * `POST /:id/comp` — no confirmation needed, unlike Detach/Remove comp:
   * comping only ever ADDS access, so there is nothing destructive to guard
   * against. The 409 for "already has an entitling subscription" is the
   * same reason the control is disabled below when that's true, but it is
   * still surfaced verbatim on the (rarer) race where it fires anyway.
   */
  const doComp = async () => {
    setComping(true);
    try {
      await compTeam(teamId);
      toast.success('Team comped — every active member has Pro now.');
      onChanged();
    } catch (error) {
      toast.error('Could not comp this team', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setComping(false);
    }
  };

  /**
   * Removing a comp is the destructive half — it can immediately revoke Pro
   * for every active member with no subscription to fall back on — so it
   * gets the same confirm-first treatment as Detach.
   */
  const doUncomp = async () => {
    setUncompOpen(false);
    setUncomping(true);
    try {
      await uncompTeam(teamId);
      toast.success('Comp removed.');
      onChanged();
    } catch (error) {
      toast.error('Could not remove the comp', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setUncomping(false);
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

  /**
   * Records a fresh manual (bank-transfer) payment when the team has no
   * subscription (`POST .../subscription/manual`), or extends/corrects an
   * existing one (`PATCH .../subscription/manual`) when it already has a
   * MANUAL subscription. Either 409 the API can send here — "already has a
   * subscription attached", "processor-backed", or the seats-below-usage
   * one naming the exact figure — is surfaced verbatim, never a generic
   * toast.
   */
  const doSaveManual = async () => {
    const seats = Number(manualDraft.seats);
    if (!Number.isFinite(seats) || seats < 1 || !manualDraft.expiry.trim()) return;
    setManualSaving(true);
    try {
      const payload = {
        seats,
        expiry: new Date(manualDraft.expiry).toISOString(),
        ...(manualDraft.amount.trim() ? { amount: Number(manualDraft.amount) } : {}),
        ...(manualDraft.currency.trim()
          ? { currency: manualDraft.currency.trim().toUpperCase() }
          : {}),
      };
      if (subscription) {
        await updateManualTeamPayment(teamId, payload);
        toast.success('Manual payment extended.');
      } else {
        await recordManualTeamPayment(teamId, payload);
        toast.success('Manual payment recorded. Members now have Pro access.');
      }
      setManualOpen(false);
      onChanged();
    } catch (error) {
      toast.error(
        subscription
          ? 'Could not extend the manual payment'
          : 'Could not record the manual payment',
        { description: extractErrorMessage(error, 'Unknown error') },
      );
    } finally {
      setManualSaving(false);
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

      {isManual && subscription ? (
        <Alert>
          <AlertDescription className="space-y-2">
            <p>
              Paid manually (bank transfer) — expires{' '}
              <strong>{subscription.expiry ? fmt(subscription.expiry) : '—'}</strong>. A nightly job
              revokes Pro access for the whole team, after a grace period, once this date lapses —
              extend it before then to keep the team on Pro.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isArchived}
              onClick={() => setManualOpen(true)}
            >
              Extend / renew
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Section title="Access" id="section-billing-access">
        {comped ? (
          <Alert>
            <AlertDescription className="space-y-2">
              <p>
                <strong>Comped.</strong> Every active member has Pro, granted by staff — no billing
                is attached to this team.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isArchived || uncomping}
                  onClick={() => setUncompOpen(true)}
                >
                  {uncomping ? 'Removing…' : 'Remove comp'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Removing this comp revokes Pro for every member unless a subscription is attached.
                </span>
              </div>
            </AlertDescription>
          </Alert>
        ) : hasEntitlingSubscription ? (
          <Alert>
            <AlertDescription className="space-y-2">
              <p>
                <strong>Subscription-backed.</strong> Pro access follows this team&apos;s
                subscription — see its status below.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled
                  title="This team already has an entitling subscription. Comping it would be redundant and would mask the real billing state."
                >
                  Comp this team
                </Button>
                <span className="text-xs text-muted-foreground">
                  This team already has an entitling subscription — comping it would be redundant
                  and would mask the real billing state.
                </span>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertDescription className="space-y-2">
              <p>
                <strong>No Pro access.</strong> This team has neither a comp nor an entitling
                subscription attached — nobody on this team is on Pro right now.
              </p>
              <Button size="sm" disabled={isArchived || comping} onClick={doComp}>
                {comping ? 'Comping…' : 'Comp this team'}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </Section>

      <Section title="Subscription" id="section-billing-subscription">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Plan</dt>
            <dd>{subscription?.plan ?? '—'}</dd>
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
            <dd>{isManual ? 'Paid manually (bank transfer)' : (processor ?? '—')}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Cycle</dt>
            <dd>{subscription?.interval ?? '—'}</dd>
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
            <dd>{subscription?.expiry ? fmt(subscription.expiry) : '—'}</dd>
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
            <>
              <Button size="sm" disabled={isArchived} onClick={() => setAttaching(true)}>
                Attach subscription
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isArchived}
                onClick={() => setManualOpen(true)}
              >
                Record manual payment
              </Button>
            </>
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

      <Dialog open={manualOpen} onOpenChange={(next) => !next && setManualOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {subscription ? 'Extend manual payment' : 'Record manual payment'}
            </DialogTitle>
          </DialogHeader>
          <FieldGrid>
            <Field label="Seats" htmlFor="manual-seats" required>
              <Input
                id="manual-seats"
                type="number"
                min={1}
                value={manualDraft.seats}
                onChange={(event) => setManualDraft((d) => ({ ...d, seats: event.target.value }))}
              />
            </Field>
            <Field
              label="Expiry"
              htmlFor="manual-expiry"
              required
              hint="This is what keeps the team's Pro access alive — a nightly job revokes it for the whole team, after a grace period, once this date lapses."
            >
              <Input
                id="manual-expiry"
                type="date"
                value={manualDraft.expiry}
                onChange={(event) => setManualDraft((d) => ({ ...d, expiry: event.target.value }))}
              />
            </Field>
            <Field label="Amount (optional)" htmlFor="manual-amount">
              <Input
                id="manual-amount"
                type="number"
                min={0}
                value={manualDraft.amount}
                onChange={(event) => setManualDraft((d) => ({ ...d, amount: event.target.value }))}
              />
            </Field>
            <Field
              label="Currency (optional)"
              htmlFor="manual-currency"
              hint="3-letter code, e.g. NGN."
            >
              <Input
                id="manual-currency"
                maxLength={3}
                value={manualDraft.currency}
                onChange={(event) =>
                  setManualDraft((d) => ({ ...d, currency: event.target.value.toUpperCase() }))
                }
              />
            </Field>
          </FieldGrid>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)} disabled={manualSaving}>
              Cancel
            </Button>
            <Button
              onClick={doSaveManual}
              disabled={manualSaving || !manualDraft.seats.trim() || !manualDraft.expiry.trim()}
            >
              {manualSaving ? 'Saving…' : subscription ? 'Extend' : 'Record payment'}
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

      <ConfirmDelete
        open={uncompOpen}
        confirmLabel="Yes, remove comp"
        title="Remove this team's comp?"
        description="This revokes Pro access for every active member immediately, unless a subscription is attached to cover them instead."
        onCancel={() => setUncompOpen(false)}
        onConfirm={doUncomp}
      />
    </div>
  );
}

export default BillingTab;
