'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { submitForReview, type SubmittableType } from '@/lib/api/instructor';

export type LifecycleState = 'draft' | 'in_review' | 'changes_requested' | 'published';

/**
 * One flag (`isWaiting`) means "submitted" on every kind, but it cannot by
 * itself distinguish a fresh submission from changes an admin sent back —
 * there is no third value (see the approval-workflow report's own
 * follow-up note). The best signal available client-side is the reviewer
 * note (`waitingLink`): a submission the instructor just made either carries
 * their own notes or none, while a rejection/request-changes always leaves
 * the admin's feedback there. Treating "isWaiting + a note" as "changes
 * requested" is a heuristic, not a certainty — flagged here rather than
 * presented as more precise than the data actually is.
 */
export function deriveLifecycle({
  isWaiting,
  waitingLink,
  isLive,
}: {
  isWaiting: boolean;
  waitingLink?: string | null;
  isLive: boolean;
}): LifecycleState {
  if (isLive) return 'published';
  if (isWaiting) return waitingLink && waitingLink.trim() ? 'changes_requested' : 'in_review';
  return 'draft';
}

const LABEL: Record<LifecycleState, string> = {
  draft: 'Draft',
  in_review: 'In review',
  changes_requested: 'Changes requested',
  published: 'Published',
};

const TONE: Record<LifecycleState, 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
  draft: 'neutral',
  in_review: 'info',
  changes_requested: 'danger',
  published: 'success',
};

/** The lifecycle badge alone, for a spot that just needs the label. */
export function LifecycleBadge({
  state,
  className,
}: {
  state: LifecycleState;
  className?: string;
}) {
  return <StatusBadge label={LABEL[state]} tone={TONE[state]} className={className} />;
}

/**
 * The badge plus, when there is somewhere left to go, a "Submit for review"
 * (or "Resubmit") button that hits the instructor endpoint. An instructor
 * cannot publish directly — the API 403s that — so this is the only forward
 * action offered from draft or changes-requested; "in review" and
 * "published" have nothing left to press.
 */
export function SubmitForReviewControl({
  type,
  id,
  state,
  note,
  onSubmitted,
}: {
  type: SubmittableType;
  id: string;
  state: LifecycleState;
  /** The reviewer's note — shown only alongside `changes_requested`. */
  note?: string | null;
  /** Anything awaitable (e.g. a refetch), or a plain void callback. */
  onSubmitted: () => unknown;
}) {
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await submitForReview(type, id);
      toast.success('Submitted for review.');
      await onSubmitted();
    } catch (error) {
      toast.error('Could not submit', {
        description:
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (error as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = state === 'draft' || state === 'changes_requested';

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <LifecycleBadge state={state} />
        {canSubmit ? (
          <Button size="sm" onClick={submit} disabled={submitting}>
            {submitting
              ? 'Submitting…'
              : state === 'changes_requested'
                ? 'Resubmit'
                : 'Submit for review'}
          </Button>
        ) : null}
      </div>
      {state === 'changes_requested' && note ? (
        <p className="max-w-xs text-right text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}
