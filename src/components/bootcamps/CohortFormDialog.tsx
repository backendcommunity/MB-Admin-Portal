'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COHORT_STATUSES, createCohort, updateCohort, type Cohort } from '@/lib/api/bootcamps';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import { StaffOnly } from '@/components/shared/SuperAdminOnly';
import { useAuthStore } from '@/store/authStore';
import { stripPricingFields } from '@/lib/pricing-fields';

/** An ISO timestamp as the `date` input wants it. */
function dateValue(iso: string | null | undefined) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bootcampId: string;
  /** Absent when creating. */
  cohort?: Cohort | null;
  onSaved: (cohort: Cohort) => void;
};

const EMPTY = {
  name: '',
  startsAt: '',
  endsAt: '',
  duration: 0,
  amount: 0,
  maxStudent: 0,
  status: 'OPEN' as Cohort['status'],
  completed: false,
  studyGroupLink: '',
  paddle_price_id: '',
  asyncpay_plan_id: '',
  allowsSubscription: true,
};

export default function CohortFormDialog({
  open,
  onOpenChange,
  bootcampId,
  cohort,
  onSaved,
}: Props) {
  const role = useAuthStore((s) => s.userRole);
  const authResolved = useAuthStore((s) => s.authResolved);
  // Fail closed: until the session check lands, treat the caller as non-staff
  // rather than trusting a possibly-stale cached role (see SuperAdminOnly).
  const isStaff = authResolved && (role === 'ADMIN' || role === 'SUPER_ADMIN');

  const editing = Boolean(cohort);
  // Re-seeded whenever the subject changes, so a previous edit never bleeds
  // into a new cohort.
  const [form, setForm] = useSeededForm(open ? (cohort?.id ?? 'new') : 'closed', () =>
    cohort
      ? {
          name: cohort.name,
          startsAt: dateValue(cohort.startsAt),
          endsAt: dateValue(cohort.endsAt),
          duration: cohort.duration,
          amount: cohort.amount,
          maxStudent: cohort.maxStudent,
          status: cohort.status,
          completed: cohort.completed,
          studyGroupLink: cohort.studyGroupLink,
          paddle_price_id: cohort.paddle_price_id,
          asyncpay_plan_id: cohort.asyncpay_plan_id,
          allowsSubscription: cohort.allowsSubscription,
        }
      : EMPTY,
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const problems: string[] = [];
  if (form.name.trim().length && form.name.trim().length < 3) {
    problems.push('The name needs at least 3 characters.');
  }
  if (!editing && !form.startsAt) problems.push('A cohort needs a start date.');
  if (form.endsAt && form.startsAt && form.endsAt < form.startsAt) {
    problems.push('The end date cannot be before the start.');
  }

  // `assertMayPublish` 403s on ANY payload where `status === 'OPEN'` from a
  // non-staff caller — not just a change to OPEN, the mere value, even an
  // unchanged resend of an already-open cohort. So `status` is only safe to
  // send as non-staff when it isn't OPEN: never on create (nothing stored
  // yet to be "unchanged", and the API forces CLOSED anyway), and on edit
  // only once the caller has moved it off OPEN.
  const maySendStatus = isStaff || (editing && form.status !== 'OPEN');

  const submit = async () => {
    if (problems.length || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        duration: form.duration,
        amount: form.amount,
        maxStudent: form.maxStudent,
        ...(maySendStatus ? { status: form.status } : {}),
        completed: form.completed,
        studyGroupLink: form.studyGroupLink,
        paddle_price_id: form.paddle_price_id,
        asyncpay_plan_id: form.asyncpay_plan_id,
        allowsSubscription: form.allowsSubscription,
        // The API wants ISO; a `date` input gives a bare day.
        ...(form.startsAt ? { startsAt: new Date(form.startsAt).toISOString() } : {}),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };

      const outgoing = isStaff ? payload : stripPricingFields(payload);

      const saved = cohort
        ? await updateCohort(cohort.id, outgoing)
        : await createCohort(bootcampId, outgoing);

      toast.success(editing ? 'Cohort saved.' : 'Cohort created.');
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error('Could not save the cohort', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit cohort' : 'New cohort'}</DialogTitle>
          <DialogDescription>
            A cohort is one run of this bootcamp — its own dates, price, capacity and curriculum.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cohort-name">Name</Label>
            <Input
              id="cohort-name"
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Node.js Backend — Cohort 1"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cohort-starts">Starts</Label>
            <Input
              id="cohort-starts"
              type="date"
              value={form.startsAt}
              onChange={(event) => set('startsAt', event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cohort-ends">Ends</Label>
            <Input
              id="cohort-ends"
              type="date"
              value={form.endsAt}
              onChange={(event) => set('endsAt', event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Optional — leave blank for open-ended.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cohort-duration">Duration (weeks)</Label>
            <Input
              id="cohort-duration"
              type="number"
              min={0}
              value={form.duration}
              onChange={(event) => set('duration', Number(event.target.value) || 0)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cohort-capacity">Capacity</Label>
            <Input
              id="cohort-capacity"
              type="number"
              min={0}
              value={form.maxStudent}
              onChange={(event) => set('maxStudent', Number(event.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">0 means no cap.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cohort-amount">Price</Label>
            <StaffOnly reason="Only an admin can set the price (amount)">
              <Input
                id="cohort-amount"
                type="number"
                min={0}
                value={form.amount}
                onChange={(event) => set('amount', Number(event.target.value) || 0)}
              />
            </StaffOnly>
            <p className="text-xs text-muted-foreground">
              Stored as an integer. 0 makes the cohort free.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cohort-status">Status</Label>
            {!editing && !isStaff ? (
              <>
                <Input id="cohort-status" value="CLOSED" disabled />
                <p className="text-xs text-muted-foreground">
                  New cohorts start closed. Only an admin can open one for enrollment.
                </p>
              </>
            ) : (
              <>
                <Select
                  value={form.status}
                  onValueChange={(value) => set('status', value as Cohort['status'])}
                >
                  <SelectTrigger id="cohort-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COHORT_STATUSES.map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                        disabled={!isStaff && status === 'OPEN'}
                      >
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only OPEN accepts new joins on the learner side.
                  {!isStaff
                    ? ' Only an admin can open a cohort — submit this for approval instead.'
                    : ''}
                </p>
              </>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cohort-slack">Study group link</Label>
            <Input
              id="cohort-slack"
              value={form.studyGroupLink}
              onChange={(event) => set('studyGroupLink', event.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cohort-paddle">Paddle price id</Label>
            <StaffOnly reason="Only an admin can set the Paddle price id (paddle_price_id)">
              <Input
                id="cohort-paddle"
                value={form.paddle_price_id}
                onChange={(event) => set('paddle_price_id', event.target.value)}
                placeholder="pri_…"
              />
            </StaffOnly>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cohort-asyncpay">AsyncPay plan id</Label>
            <StaffOnly reason="Only an admin can set the AsyncPay plan id (asyncpay_plan_id)">
              <Input
                id="cohort-asyncpay"
                value={form.asyncpay_plan_id}
                onChange={(event) => set('asyncpay_plan_id', event.target.value)}
              />
            </StaffOnly>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
            <span>
              <span className="block text-sm font-medium">Allows subscription</span>
              <span className="block text-xs text-muted-foreground">
                Whether a subscriber can join without paying the cohort price.
              </span>
            </span>
            <StaffOnly reason="Only an admin can set the subscription-access flag (allowsSubscription)">
              <Switch
                checked={form.allowsSubscription}
                onCheckedChange={(next) => set('allowsSubscription', next)}
                aria-label="Allows subscription"
              />
            </StaffOnly>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
            <span>
              <span className="block text-sm font-medium">Completed</span>
              <span className="block text-xs text-muted-foreground">
                Marks the run finished. Learners keep their access.
              </span>
            </span>
            <Switch
              checked={form.completed}
              onCheckedChange={(next) => set('completed', next)}
              aria-label="Completed"
            />
          </label>
        </div>

        {problems.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
            {problems.map((problem) => (
              <p key={problem}>{problem}</p>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || problems.length > 0 || !form.name.trim()}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Create cohort'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
