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
import { CodeArea } from '@/components/shared/form/CodeArea';
import { enrolLearners, type EnrolResult, type PathDetail } from '@/lib/api/paths';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX = 100;

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Enrolling grants full access and runs the same setup a learner gets
 * themselves — the UserRoadmap plus a UserTopic per topic, first unlocked.
 * It also overrides the premium gate, which is why a paid path says so.
 */
export default function EnrolLearnersDialog({
  open,
  path,
  onClose,
  onEnrolled,
}: {
  open: boolean;
  path: PathDetail;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EnrolResult | null>(null);

  const emails = useMemo(() => parseEmails(text), [text]);
  const invalid = emails.filter((email) => !EMAIL.test(email));
  const overLimit = emails.length > MAX;
  const canSend = emails.length > 0 && invalid.length === 0 && !overLimit;

  const run = async () => {
    setBusy(true);
    try {
      const response = await enrolLearners(path.id, emails);
      setResult(response);
      onEnrolled();

      const { enrolled, skipped, notFound, failed } = response.summary;
      const parts = [`${enrolled} enrolled`];
      if (skipped) parts.push(`${skipped} already enrolled`);
      if (notFound) parts.push(`${notFound} with no account`);
      if (failed) parts.push(`${failed} failed`);
      toast.success(parts.join(', ') + '.');
    } catch (error) {
      const body = (error as { response?: { data?: { message?: string } } }).response?.data;
      toast.error('Could not enrol', {
        description: body?.message ?? (error as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setText('');
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Enrol learners</DialogTitle>
          <DialogDescription>
            Enrolling grants full access and sets up every topic, with the first unlocked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {path.ownerTeamId ? (
            <p className="rounded-lg border border-warning bg-warning-wash p-3 text-sm text-warning">
              <strong>This path belongs to {path.ownerTeamId}.</strong> Anyone enrolled here gets
              that team&apos;s private curriculum, including people outside the team — enrolment
              does not check membership.
            </p>
          ) : null}

          {path.isPremium ? (
            <p className="rounded-lg border border-warning bg-warning-wash p-3 text-sm text-warning">
              Paid path (${path.amount}). Enrolling overrides the premium gate and grants it without
              payment.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="enrol-emails">Email addresses</Label>
            <CodeArea
              id="enrol-emails"
              value={text}
              onChange={setText}
              ariaLabel="Email addresses"
              minHeight={120}
              placeholder={'ada@acme.test, ben@acme.test\nchi@acme.test'}
            />
            <p className="text-xs text-muted-foreground">
              One per line or comma separated, up to {MAX} at a time. Anyone already enrolled is
              skipped, so re-sending a list is safe.
            </p>
          </div>

          {emails.length ? (
            <p className="text-xs">
              <span className="font-mono tabular-nums">{emails.length}</span> address
              {emails.length === 1 ? '' : 'es'}
              {invalid.length ? (
                <span className="text-destructive">
                  {' '}
                  · {invalid.length} not a valid email ({invalid.slice(0, 2).join(', ')}
                  {invalid.length > 2 ? '…' : ''})
                </span>
              ) : null}
              {overLimit ? <span className="text-destructive"> · over the {MAX} limit</span> : null}
            </p>
          ) : null}

          {result ? <EnrolReport result={result} /> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          <Button onClick={run} disabled={busy || !canSend}>
            {busy ? 'Enrolling…' : emails.length ? `Enrol ${emails.length}` : 'Enrol'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The four buckets are shown separately because the difference matters: a
 * typo'd address is `notFound`, not a failure, and folding the two together is
 * how an admin comes to believe they enrolled someone they did not.
 */
function EnrolReport({ result }: { result: EnrolResult }) {
  const { summary, details } = result;

  return (
    <div className="space-y-2 text-sm">
      <div className="rounded-lg border border-border bg-muted p-3">
        <p className="font-mono tabular-nums text-foreground">
          {summary.enrolled} enrolled · {summary.skipped} already · {summary.notFound} no account ·{' '}
          {summary.failed} failed
        </p>
      </div>

      {details.notFound.length ? (
        <div className="rounded-lg border border-warning bg-warning-wash p-3 text-warning">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide">
            No account — not invited
          </p>
          <p className="break-words">{details.notFound.join(', ')}</p>
        </div>
      ) : null}

      {details.failed.length ? (
        <div className="rounded-lg border border-danger bg-danger-wash p-3 text-danger">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Failed</p>
          <ul className="list-disc space-y-1 pl-5">
            {details.failed.map((row) => (
              <li key={row.email}>
                {row.email} — {row.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
