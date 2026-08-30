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
import { Field } from '@/components/shared/form/Section';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import { suspendUser, type UserDetail } from '@/lib/api/users';

/**
 * Suspending asks for a reason; lifting does not.
 *
 * The reason is the only record of why somebody was locked out, and the admin
 * deciding whether to lift it later is usually not the one who imposed it.
 */
export default function SuspendDialog({
  open,
  onOpenChange,
  user,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserDetail;
  onChanged: () => void;
}) {
  const lifting = Boolean(user.suspendedAt);
  const [reason, setReason] = useSeededForm(open ? user.id : 'closed', () => '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await suspendUser(user.id, !lifting, reason.trim() || undefined);
      toast.success(lifting ? 'Suspension lifted.' : 'Account suspended.', {
        description: lifting
          ? 'They can sign in again.'
          : 'They are refused at every sign-in door, and the record stays intact.',
      });
      onChanged();
      onOpenChange(false);
    } catch (error) {
      // A 409 here is the last-admin guard.
      toast.error('Could not do that', { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{lifting ? 'Lift the suspension' : `Suspend ${user.email}`}</DialogTitle>
          <DialogDescription>
            {lifting
              ? 'They will be able to sign in again immediately.'
              : 'They stop being able to sign in. Nothing is deleted, and this can be lifted at any time.'}
          </DialogDescription>
        </DialogHeader>

        {lifting ? (
          user.security.suspendedReason ? (
            <p className="rounded-lg border p-3 text-xs text-muted-foreground">
              Suspended because: {user.security.suspendedReason}
            </p>
          ) : null
        ) : (
          <Field
            label="Reason"
            htmlFor="suspend-reason"
            hint="Shown to whoever decides later whether to lift it."
          >
            <Input
              id="suspend-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Payment dispute, abuse report, request from the learner…"
            />
          </Field>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={lifting ? 'default' : 'destructive'} onClick={submit} disabled={busy}>
            {busy ? 'Working…' : lifting ? 'Lift it' : 'Suspend'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
