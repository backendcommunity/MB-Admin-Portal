'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { Field, FieldGrid, Section } from '@/components/shared/form/Section';
import { cn } from '@/lib/utils';
import { createTeam, recordManualTeamPayment, type CreateTeamInput } from '@/lib/api/teams';

type BillingChoice = 'none' | 'manual' | 'existing';

type TeamDraft = {
  name: string;
  ownerEmail: string;
  billing: BillingChoice;
  // "No subscription yet" only — whether to comp the team on creation.
  // Pre-ticked: the only reason staff make a subscription-less team is to
  // provision a comped one, so that is the default. See `comped` on
  // `CreateTeamInput` and `ValidateCreateTeam` (academy
  // `modules/admin/validators/teams.ts`).
  comp: boolean;
  // "Attach an existing subscription"
  subscriptionId: string;
  existingSeats: string;
  // "Already paid manually (bank transfer)"
  manualSeats: string;
  expiry: string;
  amount: string;
  currency: string;
};

/** One year from today, as `yyyy-mm-dd` for a native date input. */
function defaultExpiry(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

const emptyDraft = (): TeamDraft => ({
  name: '',
  ownerEmail: '',
  billing: 'none',
  comp: true,
  subscriptionId: '',
  existingSeats: '',
  manualSeats: '',
  expiry: defaultExpiry(),
  amount: '',
  currency: '',
});

const radioOption = (selected: boolean) =>
  cn(
    'flex items-start gap-3 rounded-lg border p-3 cursor-pointer',
    selected ? 'border-primary bg-accent/40' : 'border-border',
  );

/**
 * Full create page, same shape as `projects/new`: enough to create a team
 * immediately, then hand off to the detail page for anything else.
 *
 * Billing is a three-way choice, not a single "subscription id" field:
 * a team can start with no subscription at all (no Pro access for anyone —
 * the surprising outcome, so it is spelled out plainly), can have already
 * paid by bank transfer (staff record that directly and members get Pro
 * immediately, via `POST /:id/subscription/manual`), or can have a real
 * subscription id to attach (the original behaviour, unchanged).
 *
 * The API's `POST /admin/teams` (`ValidateCreateTeam`, academy
 * `modules/admin/validators/teams.ts`) has no manual-billing fields at all —
 * it only knows `subscriptionId`/`seats`, and `seats` is a 422 without a
 * `subscriptionId` (`.with('seats', 'subscriptionId')`). So a manual choice
 * is two calls: create the team plain, then `recordManualTeamPayment`. If
 * the second call fails the team still exists — the operator is told exactly
 * that, given the real API error, and sent to the team's page (its Billing
 * tab can record the payment again) rather than left to guess which half of
 * the operation actually happened.
 */
export default function NewTeamClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TeamDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof TeamDraft>(key: K, value: TeamDraft[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validBase = form.name.trim().length > 0 && /\S+@\S+\.\S+/.test(form.ownerEmail.trim());
  const manualSeatsNum = Number(form.manualSeats);
  const validManual =
    form.billing !== 'manual' ||
    (Number.isFinite(manualSeatsNum) && manualSeatsNum >= 1 && form.expiry.trim().length > 0);
  const valid = validBase && validManual;

  async function submit() {
    if (!valid) return;
    setSaving(true);
    try {
      const payload: CreateTeamInput = {
        name: form.name.trim(),
        ownerEmail: form.ownerEmail.trim(),
      };
      // Seats live on Subscription.paidSeats. Sending them without a
      // subscription is a 422 by design, so never include them here — and
      // only for the "existing subscription" choice, never for "manual" or
      // "none".
      if (form.billing === 'existing' && form.subscriptionId) {
        payload.subscriptionId = form.subscriptionId;
        if (form.existingSeats) payload.seats = Number(form.existingSeats);
      }
      // Comp only applies with no subscription attached — billing governs
      // on the other two branches, so `comped` is never sent there.
      if (form.billing === 'none') {
        payload.comped = form.comp;
      }

      const created = await createTeam(payload);
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });

      if (form.billing === 'manual') {
        try {
          await recordManualTeamPayment(created.id, {
            seats: manualSeatsNum,
            expiry: new Date(form.expiry).toISOString(),
            ...(form.amount.trim() ? { amount: Number(form.amount) } : {}),
            ...(form.currency.trim() ? { currency: form.currency.trim().toUpperCase() } : {}),
          });
          toast.success('Team created and manual payment recorded.');
        } catch (billingError: any) {
          toast.error('The team was created, but the manual payment was not recorded.', {
            description:
              billingError?.response?.data?.message ??
              'Unknown error. Record it from the team’s Billing tab.',
          });
          router.push(`/teams/${created.id}`);
          return;
        }
      } else {
        toast.success('Team created');
      }

      router.push(`/teams/${created.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not create the team');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm text-muted-foreground">
        <Link href="/teams" className="text-primary hover:underline">
          Teams
        </Link>{' '}
        / New
      </p>

      <PageHeader
        title={form.name || 'New team'}
        description="Enough to create it. Members, groups and paths are managed from the detail page."
        actions={
          <>
            <Button variant="ghost" onClick={() => router.push('/teams')} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || !valid}>
              {saving ? 'Creating…' : 'Create team'}
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        <Section title="Team" id="section-team">
          <Field label="Team name" htmlFor="name" required>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Kuda Engineering"
            />
          </Field>
          <Field
            label="Owner email"
            htmlFor="owner-email"
            required
            hint="Must belong to an existing user — they become the team's OWNER."
          >
            <Input
              id="owner-email"
              type="email"
              value={form.ownerEmail}
              onChange={(e) => set('ownerEmail', e.target.value)}
              placeholder="aisha@kuda.com"
            />
          </Field>
        </Section>

        <Section title="Billing" id="section-billing">
          <div className="space-y-2">
            <label className={radioOption(form.billing === 'none')}>
              <input
                type="radio"
                name="billing"
                className="mt-1"
                checked={form.billing === 'none'}
                onChange={() => set('billing', 'none')}
                aria-label="No subscription yet"
              />
              <span>
                <span className="block text-sm font-medium">No subscription yet</span>
                <span className="block text-xs text-muted-foreground">
                  No subscription is created. Whether anyone gets Pro access depends on the comp
                  option below.
                </span>
              </span>
            </label>

            {form.billing === 'none' ? (
              <label className="ml-8 flex items-start gap-3 rounded-lg border border-dashed border-border p-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.comp}
                  onChange={(e) => set('comp', e.target.checked)}
                  aria-label="Grant Pro to members now (comp the team)"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Grant Pro to members now (comp the team)
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {form.comp
                      ? 'Every member added will have Pro immediately, at no charge, until this is un-comped or a subscription is attached.'
                      : 'Members will have NO Pro access until billing is attached or the team is comped later — this team will look normal but entitle nobody.'}
                  </span>
                </span>
              </label>
            ) : null}

            <label className={radioOption(form.billing === 'manual')}>
              <input
                type="radio"
                name="billing"
                className="mt-1"
                checked={form.billing === 'manual'}
                onChange={() => set('billing', 'manual')}
                aria-label="Already paid manually (bank transfer)"
              />
              <span>
                <span className="block text-sm font-medium">
                  Already paid manually (bank transfer)
                </span>
                <span className="block text-xs text-muted-foreground">
                  The company paid directly to our bank. Members get Pro access immediately.
                </span>
              </span>
            </label>

            <label className={radioOption(form.billing === 'existing')}>
              <input
                type="radio"
                name="billing"
                className="mt-1"
                checked={form.billing === 'existing'}
                onChange={() => set('billing', 'existing')}
                aria-label="Attach an existing subscription"
              />
              <span>
                <span className="block text-sm font-medium">Attach an existing subscription</span>
                <span className="block text-xs text-muted-foreground">
                  Link a subscription id that already exists (e.g. from Paddle).
                </span>
              </span>
            </label>
          </div>

          {form.billing === 'manual' ? (
            <FieldGrid>
              <Field label="Seats" htmlFor="manual-seats" required>
                <Input
                  id="manual-seats"
                  type="number"
                  min={1}
                  value={form.manualSeats}
                  onChange={(e) => set('manualSeats', e.target.value)}
                />
              </Field>
              <Field
                label="Expiry"
                htmlFor="manual-expiry"
                required
                hint="This is what keeps the team's Pro access alive — a nightly job revokes it for everyone on the team, after a grace period, once this date lapses."
              >
                <Input
                  id="manual-expiry"
                  type="date"
                  value={form.expiry}
                  onChange={(e) => set('expiry', e.target.value)}
                />
              </Field>
              <Field label="Amount (optional)" htmlFor="manual-amount">
                <Input
                  id="manual-amount"
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                />
              </Field>
              <Field
                label="Currency (optional)"
                htmlFor="manual-currency"
                hint="3-letter code, e.g. NGN. Leave blank if unknown."
              >
                <Input
                  id="manual-currency"
                  maxLength={3}
                  value={form.currency}
                  onChange={(e) => set('currency', e.target.value.toUpperCase())}
                />
              </Field>
            </FieldGrid>
          ) : null}

          {form.billing === 'existing' ? (
            <FieldGrid>
              <Field
                label="Subscription ID"
                htmlFor="subscription-id"
                hint="Leave blank to attach later — a team without one has zero seats."
              >
                <Input
                  id="subscription-id"
                  value={form.subscriptionId}
                  onChange={(e) => set('subscriptionId', e.target.value)}
                  placeholder="Attach later"
                />
              </Field>
              <Field
                label="Paid seats"
                htmlFor="seats"
                hint="Seats live on the subscription. Attach one to set them."
              >
                <Input
                  id="seats"
                  type="number"
                  min={1}
                  disabled={!form.subscriptionId}
                  value={form.existingSeats}
                  onChange={(e) => set('existingSeats', e.target.value)}
                />
              </Field>
            </FieldGrid>
          ) : null}
        </Section>
      </div>
    </div>
  );
}
