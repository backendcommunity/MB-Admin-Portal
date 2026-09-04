'use client';

import { useMemo, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldGrid } from '@/components/shared/form/Section';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import { ROLES, createUser, type Role } from '@/lib/api/users';

const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

export default function AddUserModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useSeededForm(open ? 'open' : 'closed', () => ({
    name: '',
    email: '',
    role: 'USER' as Role,
    emailConfirmed: false,
  }));
  const [saving, setSaving] = useState(false);

  const problems = useMemo(() => {
    const out: string[] = [];
    if (form.email.trim() && !EMAIL.test(form.email.trim())) {
      out.push('That is not an email address.');
    }
    if (form.emailConfirmed) {
      out.push(
        'Confirming by hand skips verification — do it only if you trust the address another way.',
      );
    }
    if (form.role === 'ADMIN') {
      out.push('An admin can reach every screen in this console, including this one.');
    }
    return out;
  }, [form]);

  const blocking = form.email.trim() && !EMAIL.test(form.email.trim());

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || blocking) return;
    setSaving(true);
    try {
      const created = await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        emailConfirmed: form.emailConfirmed,
      });
      toast.success('Account created.', {
        description: 'It has no password — they sign in through a reset or a social account.',
      });
      onOpenChange(false);
      onCreated(created.id);
    } catch (error) {
      toast.error('Could not create the account', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            Creates the account directly. It has no password, so they sign in through a reset link
            or a social account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Name" htmlFor="new-name" required>
            <Input
              id="new-name"
              value={form.name}
              onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
            />
          </Field>

          <FieldGrid>
            <Field
              label="Email"
              htmlFor="new-email"
              required
              hint="The one unique column on a user."
            >
              <Input
                id="new-email"
                value={form.email}
                onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
              />
            </Field>

            <Field label="Role" htmlFor="new-role" required>
              <Select
                value={form.role}
                onValueChange={(value) => setForm((f) => ({ ...f, role: value as Role }))}
              >
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGrid>

          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">Mark the email confirmed</span>
              <span className="block text-xs text-muted-foreground">
                Off by default. An address nobody has proven should not start out trusted.
              </span>
            </span>
            <Switch
              checked={form.emailConfirmed}
              onCheckedChange={(next) => setForm((f) => ({ ...f, emailConfirmed: next }))}
              aria-label="Mark the email confirmed"
            />
          </label>

          {problems.length ? (
            <div className="space-y-1 rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
              {problems.map((problem) => (
                <p key={problem}>{problem}</p>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !form.name.trim() || !form.email.trim() || Boolean(blocking)}
          >
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
