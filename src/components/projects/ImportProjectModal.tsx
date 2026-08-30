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
import { createProject, createProjectTask, createTask, enrolLearners } from '@/lib/api/projects';
import { parseProjectImport } from '@/lib/projects/import';
import { resolveProjectRefs, resolvedId, type Resolved } from '@/lib/projects/resolve';
import { projectSample } from '@/lib/projects/sample';

/**
 * One document builds a whole project: the brief, the playground, every
 * ProjectTask and Task with its grading contract, and the roster.
 *
 * Replayed as the same calls the forms make — there is no bulk endpoint, so
 * there is one validation path and a partial failure is visible at the call
 * that failed rather than hidden inside a transaction nobody can see.
 */
export default function ImportProjectModal({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (projectId: string) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [checking, setChecking] = useState(false);
  const [resolution, setResolution] = useState<Resolved | null>(null);

  const result = useMemo(() => (text.trim() ? parseProjectImport(text) : null), [text]);
  const doc = result?.doc ?? null;

  const reset = () => {
    setText('');
    setResolution(null);
    setStep('');
  };

  // Separate from importing on purpose: it is the only way to see what will be
  // linked and what will be skipped before anything is written.
  const check = async () => {
    if (!doc) return;
    setChecking(true);
    try {
      setResolution(await resolveProjectRefs(doc));
    } finally {
      setChecking(false);
    }
  };

  const run = async () => {
    if (!doc) return;
    const refs = resolution ?? (await resolveProjectRefs(doc));
    setResolution(refs);
    setBusy(true);

    try {
      setStep('Creating the project…');
      const project = await createProject({
        title: doc.title,
        slug: doc.slug,
        summary: doc.summary,
        description: doc.description,
        banner: doc.banner,
        level: doc.level,
        duration: doc.duration,
        skills: doc.skills,
        technologies: doc.technologies,
        prerequisites: doc.prerequisites,
        industries: doc.industries,
        languages: doc.languages,
        isPremium: doc.isPremium,
        amount: doc.amount,
        isSample: doc.isSample,
        isWaiting: doc.isWaiting,
        waitingLink: doc.waitingLink,
        baseRepository: doc.baseRepository,
        frontendURL: doc.frontendURL,
        referenceApiURL: doc.referenceApiURL,
        PRDLink: doc.PRDLink,
        playgroundConfig: {
          mode: doc.mode,
          ...(doc.mode === 'terminal'
            ? { language: doc.language, entrypoint: doc.entrypoint, terminalJail: doc.terminalJail }
            : {}),
          ...(doc.mode === 'frontend' ? { showPreviewOnLoad: doc.showPreviewOnLoad } : {}),
        },
      });

      for (const [index, ptDoc] of doc.projectTasks.entries()) {
        setStep(`ProjectTask ${index + 1} of ${doc.projectTasks.length}…`);
        // Each create appends to the end, so payload order is preserved.
        const pt = await createProjectTask(project.id, {
          title: ptDoc.title,
          slug: ptDoc.slug,
          summary: ptDoc.summary,
          banner: ptDoc.banner,
          isPremium: ptDoc.isPremium,
        });

        for (const taskDoc of ptDoc.tasks) {
          await createTask(project.id, pt.id, {
            title: taskDoc.title,
            description: taskDoc.description,
            slug: taskDoc.slug,
            type: taskDoc.type,
            required: taskDoc.required,
            isPremium: taskDoc.isPremium,
            mb: taskDoc.mb,
            answer: taskDoc.answer,
            questions: taskDoc.questions,
            // An unresolved reference imports the task unlinked rather than
            // failing it — the miss is already reported above.
            videoId: taskDoc.video ? (resolvedId(refs, 'video', taskDoc.video) ?? '') : '',
            articleId: taskDoc.article ? (resolvedId(refs, 'article', taskDoc.article) ?? '') : '',
            chapterId: taskDoc.chapter ? (resolvedId(refs, 'chapter', taskDoc.chapter) ?? '') : '',
            apiSpec: taskDoc.apiSpec,
            terminalSpec: taskDoc.terminalSpec,
          });
        }
      }

      if (doc.learners.length) {
        setStep(`Enrolling ${doc.learners.length} builder(s)…`);
        const outcome = await enrolLearners(project.id, doc.learners);
        if (outcome.skipped.length) {
          toast.warning(`${outcome.skipped.length} builder(s) were not added`, {
            description: outcome.skipped
              .slice(0, 3)
              .map((row) => `${row.email} — ${row.reason}`)
              .join('; '),
          });
        }
      }

      toast.success(`Imported “${doc.title}”.`);
      onImported(project.id);
      onOpenChange(false);
      reset();
    } catch (error) {
      // Whatever was written before this point stays. Saying where it stopped
      // is what makes the half-built project fixable by hand.
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
          <DialogTitle>Import a project</DialogTitle>
          <DialogDescription>
            One document builds the whole thing — the brief, the playground, every ProjectTask and
            Task with its grading contract, and the roster. Nothing is written until you press
            Import.
          </DialogDescription>
        </DialogHeader>

        <CodeArea
          value={text}
          onChange={(next) => {
            setText(next);
            setResolution(null);
          }}
          minHeight={240}
          ariaLabel="Project JSON"
          placeholder='{ "title": "…", "mode": "rest-api", "projectTasks": [ … ] }'
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
              “{doc.title}” — {doc.level} · {doc.mode}
            </p>
            <p className="text-muted-foreground">
              {[
                [result?.counts.projectTasks, 'ProjectTask'],
                [result?.counts.tasks, 'task'],
                [result?.counts.learners, 'builder'],
              ]
                .map(([n, word]) => `${n} ${word}${n === 1 ? '' : 's'}`)
                .join(' · ')}
              {result?.counts.tasks
                ? ` · ${result.counts.graded} of ${result.counts.tasks} gradeable`
                : ''}
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
            {!resolution.missing.length && !resolution.found.length ? (
              <p className="text-muted-foreground">Nothing in this payload links a library row.</p>
            ) : null}
          </div>
        ) : null}

        {busy && step ? <p className="text-xs text-muted-foreground">{step}</p> : null}

        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setText(projectSample)} disabled={busy}>
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
