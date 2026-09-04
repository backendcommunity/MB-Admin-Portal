'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
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
import { StatusBadge } from '@/components/shared/StatusBadge';
import { reviewSolution, type Solution } from '@/lib/api/projects';

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** The three things a reviewer opens. A missing one is itself information. */
function LinkRow({ label, href, missing }: { label: string; href: string; missing: string }) {
  if (!href) {
    return (
      <span
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border px-3 py-1.5 text-xs opacity-45"
        title={`They did not submit ${missing}.`}
      >
        {label}
        <span className="font-mono text-[10px] text-muted-foreground">not given</span>
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
    >
      <ExternalLink className="size-3" />
      {label}
      <span className="max-w-40 truncate font-mono text-[10px] text-muted-foreground">
        {href.replace(/^https?:\/\//, '')}
      </span>
    </a>
  );
}

/**
 * A block of the builder's own writing.
 *
 * These are prose — what was hard, what they are proud of — so they are set as
 * prose rather than dumped in a monospace box.
 */
function Prose({ title, hint, text }: { title: string; hint: string; text: string }) {
  return (
    <div className="border-b py-3.5 last:border-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      {text ? (
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      ) : (
        <p className="mt-1.5 text-sm italic text-muted-foreground">Left blank.</p>
      )}
    </div>
  );
}

export default function SolutionDialog({
  open,
  onOpenChange,
  projectId,
  solution,
  onReviewed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  solution: Solution | null;
  onReviewed: () => void;
}) {
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState('');

  if (!solution) return null;

  // Re-seed when a different solution is opened, without a cascading effect.
  if (seeded !== solution.id) {
    setSeeded(solution.id);
    setFeedback(solution.feedback);
    setScore(solution.score || 0);
  }

  const pending = solution.status === 'PENDING';

  const decide = async (status: 'APPROVED' | 'REJECTED' | 'PENDING') => {
    setBusy(true);
    try {
      await reviewSolution(projectId, solution.id, {
        status,
        ...(status === 'APPROVED' ? { score } : {}),
        feedback,
      });
      toast.success(
        status === 'APPROVED'
          ? 'Approved and published to the project page.'
          : status === 'REJECTED'
            ? 'Rejected. The builder can submit again.'
            : 'Reopened for review.',
      );
      onReviewed();
      onOpenChange(false);
    } catch (error) {
      toast.error('Could not save the review', { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Solution</DialogTitle>
          <DialogDescription>
            Submitted by {solution.name || solution.email} on {fmt(solution.submittedAt)}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 border-b pb-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{solution.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{solution.email}</span>
              <StatusBadge label={solution.isPublic ? 'public' : 'private'} tone="neutral" />
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums">
              {solution.score ? solution.score : '—'}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {solution.score ? 'out of 100' : 'unscored'}
            </p>
            <StatusBadge
              className="mt-1.5"
              label={solution.status.toLowerCase()}
              tone={
                solution.status === 'APPROVED'
                  ? 'success'
                  : solution.status === 'REJECTED'
                    ? 'danger'
                    : 'warning'
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-3.5">
          <LinkRow label="Repository" href={solution.repository} missing="the code" />
          <LinkRow label="Live" href={solution.baseURL} missing="the running thing" />
          <LinkRow label="Docs" href={solution.docsURL} missing="how they explain it" />
        </div>

        {solution.tools.length ? (
          <div className="flex flex-wrap items-center gap-2 border-b pb-3.5">
            <span className="text-xs text-muted-foreground">Built with</span>
            {solution.tools.map((tool) => (
              <StatusBadge key={tool} label={tool} tone="neutral" />
            ))}
          </div>
        ) : null}

        <Prose title="Challenges" hint="What they found hard." text={solution.challenges} />
        <Prose title="Achievements" hint="What they are proud of." text={solution.achievements} />

        {/* Visually the reviewer's, not the builder's. */}
        <div className="rounded-lg bg-accent p-3.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-accent-foreground">
            Reviewer feedback
          </h4>
          {pending ? (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Written back to the builder when you approve or reject.
              </p>
              <textarea
                value={feedback}
                rows={3}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="What was strong, and what would make it stronger…"
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
              <div className="mt-3 max-w-32 space-y-1.5">
                <Label htmlFor="sol-score">Score</Label>
                <Input
                  id="sol-score"
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(event) => setScore(Number(event.target.value) || 0)}
                />
              </div>
            </>
          ) : solution.feedback ? (
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
              {solution.feedback}
            </p>
          ) : (
            <p className="mt-1.5 text-sm italic text-muted-foreground">Decided with no note.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {pending ? (
            <>
              <Button variant="destructive" disabled={busy} onClick={() => decide('REJECTED')}>
                Reject
              </Button>
              <Button
                disabled={busy || score < 0 || score > 100}
                onClick={() => decide('APPROVED')}
              >
                {busy ? 'Saving…' : 'Approve'}
              </Button>
            </>
          ) : (
            <Button variant="outline" disabled={busy} onClick={() => decide('PENDING')}>
              Reopen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
