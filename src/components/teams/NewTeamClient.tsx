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
import { createTeam, type CreateTeamInput } from '@/lib/api/teams';

type TeamDraft = {
  name: string;
  ownerEmail: string;
  subscriptionId: string;
  seats: string;
};

const emptyDraft = (): TeamDraft => ({
  name: '',
  ownerEmail: '',
  subscriptionId: '',
  seats: '',
});

/**
 * Full create page, same shape as `projects/new`: enough to create a team
 * immediately, then hand off to the detail page for anything else.
 *
 * Seats live on `Subscription.paidSeats` — a team with no subscription has
 * none — so the seat field stays disabled until a subscription id is typed,
 * and the payload omits `seats` entirely unless a `subscriptionId` is also
 * sent. The API 422s on `seats` without `subscriptionId` by design
 * (Joi `.with('seats', 'subscriptionId')`), so this is not optional polish.
 */
export default function NewTeamClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TeamDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof TeamDraft>(key: K, value: TeamDraft[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const valid = form.name.trim().length > 0 && /\S+@\S+\.\S+/.test(form.ownerEmail.trim());

  async function submit() {
    if (!valid) return;
    setSaving(true);
    try {
      const payload: CreateTeamInput = {
        name: form.name.trim(),
        ownerEmail: form.ownerEmail.trim(),
      };
      // Seats live on Subscription.paidSeats. Sending them without a
      // subscription is a 422 by design, so never include them here.
      if (form.subscriptionId) {
        payload.subscriptionId = form.subscriptionId;
        if (form.seats) payload.seats = Number(form.seats);
      }
      const created = await createTeam(payload);
      toast.success('Team created');
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
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

        <Section title="Subscription" id="section-subscription">
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
                value={form.seats}
                onChange={(e) => set('seats', e.target.value)}
              />
            </Field>
          </FieldGrid>
        </Section>
      </div>
    </div>
  );
}
