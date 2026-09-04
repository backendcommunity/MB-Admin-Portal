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
import { useSeededForm } from '@/lib/forms/useSeededForm';
import { enrolLearners, type EnrolResult } from '@/lib/api/projects';

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

export default function EnrolLearnersDialog({
  open,
  onOpenChange,
  projectId,
  onEnrolled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onEnrolled: () => void;
}) {
  const [text, setText] = useSeededForm(open ? 'open' : 'closed', () => '');
  const [result, setResult] = useSeededForm<EnrolResult | null>(
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
      const outcome = await enrolLearners(projectId, emails);
      setResult(outcome);
      if (outcome.added.length) {
        toast.success(
          `Started the project for ${outcome.added.length} builder${outcome.added.length === 1 ? '' : 's'}.`,
        );
        onEnrolled();
      }
      // Anything skipped stays on screen, so a typo is fixable without
      // retyping the whole list.
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
          <DialogTitle>Add builders</DialogTitle>
          <DialogDescription>
            Starts the project on their behalf. They must already have an account — this does not
            create one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="enrol-emails">Email addresses</Label>
            <textarea
              id="enrol-emails"
              value={text}
              rows={5}
              onChange={(event) => setText(event.target.value)}
              placeholder={'ada@example.com\nben@example.com'}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {emails.length} address{emails.length === 1 ? '' : 'es'} — separate them with commas,
              spaces or new lines.
            </p>
          </div>

          {malformed.length ? (
            <div className="rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
              Not an email address: {malformed.join(', ')}
            </div>
          ) : null}

          {result ? (
            <div className="space-y-1 rounded-lg border p-3 text-xs">
              {result.taskTotal === 0 ? (
                <p className="text-warning">
                  This project has no tasks yet, so there is nothing for them to do.
                </p>
              ) : null}
              {result.skipped.length ? (
                <>
                  <p className="font-medium">Not added</p>
                  {result.skipped.map((row) => (
                    <p key={row.email} className="text-muted-foreground">
                      {row.email} — {row.reason}
                    </p>
                  ))}
                </>
              ) : null}
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
