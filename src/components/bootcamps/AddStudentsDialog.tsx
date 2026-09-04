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
import { Label } from '@/components/ui/label';
import { addMembers, type AddMembersResult } from '@/lib/api/bootcamps';
import { useSeededForm } from '@/lib/forms/useSeededForm';

/** Split a paste on anything people actually separate addresses with. */
function parseEmails(text: string) {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

const SHAPE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

export default function AddStudentsDialog({
  open,
  onOpenChange,
  cohortId,
  seatsLeft,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohortId: string;
  /** null when the cohort has no cap. */
  seatsLeft: number | null;
  onSaved: () => void;
}) {
  // Both clear when the dialog is reopened, so a previous paste and its
  // outcome do not greet the next person to open it.
  const [text, setText] = useSeededForm(open ? 'open' : 'closed', () => '');
  const [result, setResult] = useSeededForm<AddMembersResult | null>(
    open ? 'open' : 'closed',
    () => null,
  );
  const [saving, setSaving] = useState(false);

  const emails = useMemo(() => parseEmails(text), [text]);
  const malformed = emails.filter((email) => !SHAPE.test(email));

  const submit = async () => {
    if (!emails.length || malformed.length) return;
    setSaving(true);
    try {
      const outcome = await addMembers(cohortId, emails);
      setResult(outcome);
      if (outcome.added.length) {
        toast.success(
          `Enrolled ${outcome.added.length} learner${outcome.added.length === 1 ? '' : 's'}.`,
        );
        onSaved();
      }
      // Anything skipped stays on screen, so a typo is fixable without
      // re-typing the whole list.
      if (!outcome.skipped.length) onOpenChange(false);
    } catch (error) {
      toast.error('Could not add them', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add learners</DialogTitle>
          <DialogDescription>
            One address or many — separate them with commas, spaces or new lines. Each is reported
            on individually, so one bad address does not lose the rest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="student-emails">Email addresses</Label>
            <textarea
              id="student-emails"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={5}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder={'ada@example.com\nben@example.com'}
            />
            <p className="text-xs text-muted-foreground">
              {emails.length} address{emails.length === 1 ? '' : 'es'}
              {seatsLeft !== null ? ` · ${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left` : ''}
            </p>
          </div>

          {malformed.length > 0 ? (
            <div className="rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
              Not an email address: {malformed.join(', ')}
            </div>
          ) : null}

          {seatsLeft !== null && emails.length > seatsLeft ? (
            <div className="rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
              Only {seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left — the rest will be reported as
              full rather than enrolled.
            </div>
          ) : null}

          {result && result.skipped.length > 0 ? (
            <div className="space-y-1 rounded-lg border p-3 text-xs">
              <p className="font-medium">Not added</p>
              {result.skipped.map((row) => (
                <p key={row.email} className="text-muted-foreground">
                  {row.email} — {row.reason}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          <Button onClick={submit} disabled={saving || !emails.length || malformed.length > 0}>
            {saving ? 'Adding…' : `Add ${emails.length || ''}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
