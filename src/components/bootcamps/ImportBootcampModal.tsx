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
import { CodeArea } from '@/components/shared/form/CodeArea';
import {
  addMembers,
  createBonus,
  createBootcamp,
  createCohort,
  createEvent,
  createLesson,
  createWeek,
  updateBootcamp,
  BONUS_SOURCE,
  LESSON_ITEM_KIND,
} from '@/lib/api/bootcamps';
import { parseBootcampImport } from '@/lib/bootcamps/import';
import { resolveBootcampRefs, resolvedId, type Resolved } from '@/lib/bootcamps/resolve';
import { bootcampSample } from '@/lib/bootcamps/sample';
import { useAuthStore } from '@/store/authStore';
import { stripPricingFields } from '@/lib/pricing-fields';

/**
 * One document builds a whole bootcamp: the record, its topics, every cohort,
 * their weeks and lessons, the schedule, the bonuses and the roster.
 *
 * It is replayed as the same calls the forms make — there is no bulk endpoint,
 * so there is one validation path, and a partial failure is visible at the call
 * that failed rather than hidden inside a transaction nobody can see.
 */
export default function ImportBootcampModal({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (bootcampId: string) => void;
}) {
  const role = useAuthStore((s) => s.userRole);
  const authResolved = useAuthStore((s) => s.authResolved);
  // Fail closed: until the session check lands, treat the caller as non-staff
  // rather than trusting a possibly-stale cached role (see SuperAdminOnly).
  const isStaff = authResolved && (role === 'ADMIN' || role === 'SUPER_ADMIN');

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [resolution, setResolution] = useState<Resolved | null>(null);
  const [checking, setChecking] = useState(false);

  const result = useMemo(() => (text.trim() ? parseBootcampImport(text) : null), [text]);
  const doc = result?.doc ?? null;

  const reset = () => {
    setText('');
    setResolution(null);
    setStep('');
  };

  // Resolving is separate from importing on purpose: it is the only way to see
  // what will be linked and what will be skipped before anything is written.
  const check = async () => {
    if (!doc) return;
    setChecking(true);
    try {
      setResolution(await resolveBootcampRefs(doc));
    } finally {
      setChecking(false);
    }
  };

  const run = async () => {
    if (!doc) return;
    const refs = resolution ?? (await resolveBootcampRefs(doc));
    setResolution(refs);
    setBusy(true);

    try {
      setStep('Creating the bootcamp…');
      const bootcamp = await createBootcamp({
        title: doc.title,
        slug: doc.slug,
        summary: doc.summary,
        banner: doc.banner,
        level: doc.level,
      });

      // Topics go in a second call: create takes them, but sending them
      // separately means a rejected topic cannot lose the whole bootcamp.
      if (doc.topics.length) {
        setStep('Adding topics…');
        await updateBootcamp(bootcamp.id, { topics: doc.topics });
      }

      for (const cohortDoc of doc.cohorts) {
        setStep(`Creating “${cohortDoc.name}”…`);
        const cohortPayload = {
          name: cohortDoc.name,
          startsAt: new Date(cohortDoc.startsAt).toISOString(),
          endsAt: cohortDoc.endsAt ? new Date(cohortDoc.endsAt).toISOString() : null,
          duration: cohortDoc.duration,
          amount: cohortDoc.amount,
          maxStudent: cohortDoc.maxStudent,
          status: cohortDoc.status,
          completed: cohortDoc.completed,
          studyGroupLink: cohortDoc.studyGroupLink,
          paddle_price_id: cohortDoc.paddle_price_id,
          asyncpay_plan_id: cohortDoc.asyncpay_plan_id,
          allowsSubscription: cohortDoc.allowsSubscription,
        };
        const cohort = await createCohort(
          bootcamp.id,
          isStaff ? cohortPayload : stripPricingFields(cohortPayload),
        );

        // Weeks land in payload order because each create appends to the end.
        const weekIds: string[] = [];
        const lessonIds: Array<Record<string, string>> = [];

        for (const [index, weekDoc] of cohortDoc.weeks.entries()) {
          setStep(`${cohortDoc.name}: week ${index + 1} of ${cohortDoc.weeks.length}…`);
          const week = await createWeek(cohort.id, {
            title: weekDoc.title,
            summary: weekDoc.summary,
          });
          weekIds.push(week.id);

          const byTitle: Record<string, string> = {};
          for (const lessonDoc of weekDoc.lessons) {
            const kind = LESSON_ITEM_KIND[lessonDoc.type];
            const itemId = lessonDoc.item && kind ? resolvedId(refs, kind, lessonDoc.item) : null;

            const lesson = await createLesson(cohort.id, week.id, {
              title: lessonDoc.title,
              summary: lessonDoc.summary,
              description: lessonDoc.description,
              type: lessonDoc.type,
              mb: lessonDoc.mb,
              // An unresolved reference imports the lesson unlinked rather than
              // failing it — the miss is already reported above.
              itemId: itemId ?? '',
            });
            byTitle[lessonDoc.title] = lesson.id;
          }
          lessonIds.push(byTitle);
        }

        for (const eventDoc of cohortDoc.events) {
          setStep(`${cohortDoc.name}: scheduling “${eventDoc.title}”…`);
          const weekId = weekIds[eventDoc.week - 1];
          const lessonId = eventDoc.lesson
            ? (lessonIds[eventDoc.week - 1]?.[eventDoc.lesson] ?? null)
            : null;

          await createEvent(cohort.id, {
            weekId,
            lessonId,
            title: eventDoc.title,
            description: eventDoc.description,
            eventType: eventDoc.eventType,
            status: eventDoc.status,
            eventDate: `${eventDoc.date}T00:00:00.000Z`,
            startTime: `${eventDoc.date}T${eventDoc.start}:00.000Z`,
            endTime: `${eventDoc.date}T${eventDoc.end}:00.000Z`,
            timezone: eventDoc.timezone,
            location: eventDoc.location,
            meetingUrl: eventDoc.meetingUrl,
            recordingUrl: eventDoc.recordingUrl,
          });
        }

        for (const bonusDoc of cohortDoc.bonuses) {
          const itemId = resolvedId(refs, BONUS_SOURCE[bonusDoc.kind], bonusDoc.item);
          // A bonus with no item is a row pointing at nothing, so it is skipped
          // rather than written empty.
          if (!itemId) continue;
          setStep(`${cohortDoc.name}: adding a bonus…`);
          await createBonus(cohort.id, {
            kind: bonusDoc.kind,
            itemId,
            topic: bonusDoc.topic,
            summary: bonusDoc.summary,
          });
        }

        if (cohortDoc.students.length) {
          setStep(`${cohortDoc.name}: enrolling ${cohortDoc.students.length} learner(s)…`);
          const outcome = await addMembers(cohort.id, cohortDoc.students);
          if (outcome.skipped.length) {
            toast.warning(`${outcome.skipped.length} learner(s) were not enrolled`, {
              description: outcome.skipped
                .slice(0, 3)
                .map((row) => `${row.email} — ${row.reason}`)
                .join('; '),
            });
          }
        }
      }

      toast.success(`Imported “${doc.title}”.`);
      onImported(bootcamp.id);
      onOpenChange(false);
      reset();
    } catch (error) {
      // Whatever was written before this point stays. Saying where it stopped
      // is what makes the half-built bootcamp fixable by hand.
      toast.error('The import stopped', {
        description: `${step} ${(error as Error).message}`,
      });
    } finally {
      setBusy(false);
      setStep('');
    }
  };

  const blocked = Boolean(result?.errors.length) || !doc;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import a bootcamp</DialogTitle>
          <DialogDescription>
            One document builds the whole thing — the bootcamp, its topics, every cohort, their
            weeks and lessons, the schedule, the bonuses and the roster. Nothing is written until
            you press Import.
          </DialogDescription>
        </DialogHeader>

        <CodeArea
          value={text}
          onChange={(next) => {
            setText(next);
            setResolution(null);
          }}
          minHeight={240}
          ariaLabel="Bootcamp JSON"
          placeholder='{ "title": "…", "cohorts": [ … ] }'
        />

        {result?.errors.length ? (
          <div className="space-y-1 rounded-lg border border-destructive bg-destructive/10 p-3 text-xs text-destructive">
            <p className="font-medium">Nothing will be written until these are fixed</p>
            {result.errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}

        {result?.notes.length ? (
          <div className="space-y-1 rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
            <p className="font-medium">Imported anyway, with these changes</p>
            {result.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        ) : null}

        {doc ? (
          <div className="rounded-lg border p-3 text-xs">
            <p className="mb-1.5 font-medium">
              “{doc.title}” — {doc.level}
            </p>
            <p className="text-muted-foreground">
              {[
                [result?.counts.topics, 'topic'],
                [result?.counts.cohorts, 'cohort'],
                [result?.counts.weeks, 'week'],
                [result?.counts.lessons, 'lesson'],
                [result?.counts.events, 'event'],
                [result?.counts.bonuses, 'bonus'],
                [result?.counts.students, 'learner'],
              ]
                .map(([n, word]) => `${n} ${word}${n === 1 ? '' : 's'}`)
                .join(' · ')}
            </p>
          </div>
        ) : null}

        {resolution ? (
          <div className="space-y-1 rounded-lg border p-3 text-xs">
            <p className="font-medium">
              {resolution.found.length} reference(s) matched
              {resolution.missing.length ? `, ${resolution.missing.length} not found` : ''}
            </p>
            {resolution.missing.map((row) => (
              <p key={`${row.kind}:${row.title}`} className="text-warning">
                No {row.kind} called “{row.title}” — {row.where} imports without it.
              </p>
            ))}
            {resolution.missing.length === 0 && resolution.found.length === 0 ? (
              <p className="text-muted-foreground">Nothing in this payload links a library row.</p>
            ) : null}
          </div>
        ) : null}

        {busy && step ? <p className="text-xs text-muted-foreground">{step}</p> : null}

        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setText(bootcampSample)} disabled={busy}>
              Load sample
            </Button>
            <Button variant="outline" onClick={reset} disabled={busy || !text}>
              Clear
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={check} disabled={busy || blocked || checking}>
              {checking ? 'Checking…' : 'Check references'}
            </Button>
            <Button onClick={run} disabled={busy || blocked}>
              {busy ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
