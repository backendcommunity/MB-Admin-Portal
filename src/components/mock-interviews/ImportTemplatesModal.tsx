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
import { useAuthStore } from '@/store/authStore';
import { createTemplate } from '@/lib/api/mockInterviews';
import { parseTemplateImport } from '@/lib/mockInterviews/import';
import { templateSample } from '@/lib/mockInterviews/sample';

/**
 * One row per template. There is no bulk endpoint, so this replays the same
 * `createTemplate` call the New Template form makes, once per row — one
 * validation path, and a partial failure is visible at the row that failed
 * rather than hidden inside a transaction nobody can see.
 */
export default function ImportTemplatesModal({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (templateId: string) => void;
}) {
  const role = useAuthStore((s) => s.userRole);
  const authResolved = useAuthStore((s) => s.authResolved);
  // Fail closed: until the session check lands, treat the caller as unable
  // to publish rather than trusting a possibly-stale cached role.
  const canPublish = authResolved && (role === 'ADMIN' || role === 'SUPER_ADMIN');

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  const result = useMemo(() => parseTemplateImport(text, { canPublish }), [text, canPublish]);
  const blocked = result.errors.length > 0 || result.docs.length === 0;

  const reset = () => {
    setText('');
    setStep('');
    setFailure(null);
  };

  const run = async () => {
    setBusy(true);
    setFailure(null);
    const created: string[] = [];
    try {
      for (const [index, doc] of result.docs.entries()) {
        setStep(`Creating ${index + 1} of ${result.docs.length}…`);
        const row = await createTemplate(doc);
        created.push(row.id);
      }
      toast.success(`Imported ${created.length} template${created.length === 1 ? '' : 's'}.`);
      onImported(created[0]);
      onOpenChange(false);
      reset();
    } catch (error) {
      // Whatever was written before this point stays. Saying how far it got
      // is what makes a half-finished import fixable by hand.
      //
      // There's no resume logic here — pressing Import again replays from
      // row 1, so the rows that already succeeded would be created a second
      // time. The message has to say so explicitly, not just where it
      // stopped, or a retry silently duplicates whatever this run already
      // wrote.
      const already = created.length;
      const dupeWarning =
        already > 0
          ? ` ${already === 1 ? 'Row 1 was' : `Rows 1–${already} were`} already created — remove ${
              already === 1 ? 'it' : 'them'
            } from the JSON before retrying, or Import will create ${
              already === 1 ? 'a duplicate' : 'duplicates'
            }.`
          : '';
      setFailure(
        `The import stopped after ${created.length} of ${result.docs.length}: ` +
          ((error as { response?: { data?: { message?: string } } }).response?.data?.message ??
            (error as Error).message) +
          dupeWarning,
      );
    } finally {
      setBusy(false);
      setStep('');
    }
  };

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
          <DialogTitle>Import templates</DialogTitle>
          <DialogDescription>
            One document per row, or an array of them. Each row is created with the same call the
            New Template form makes. Nothing is written until you press Import.
          </DialogDescription>
        </DialogHeader>

        <CodeArea
          value={text}
          onChange={setText}
          minHeight={240}
          ariaLabel="Template JSON"
          placeholder='[ { "name": "…", "duration": 30, … } ]'
        />

        {result.errors.length ? (
          <div className="space-y-1 rounded-lg border border-destructive bg-destructive/10 p-3 text-xs text-destructive">
            <p className="font-medium">Nothing will be written until these are fixed</p>
            {result.errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}

        {failure ? (
          <div className="space-y-1 rounded-lg border border-destructive bg-destructive/10 p-3 text-xs text-destructive">
            <p className="font-medium">{failure}</p>
          </div>
        ) : null}

        {result.notes.length ? (
          <div className="space-y-1 rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
            <p className="font-medium">Imported anyway, with these changes</p>
            {result.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        ) : null}

        {result.docs.length ? (
          <div className="rounded-lg border p-3 text-xs">
            <p className="text-muted-foreground">
              {[
                [result.counts.total, 'template'],
                [result.counts.withTopics, 'with topics'],
                [result.counts.withRubric, 'with a rubric'],
                [result.counts.published, 'published'],
              ]
                .map(([n, word]) => `${n} ${word}${word === 'template' && n !== 1 ? 's' : ''}`)
                .join(' · ')}
            </p>
          </div>
        ) : null}

        {busy && step ? <p className="text-xs text-muted-foreground">{step}</p> : null}

        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setText(templateSample)} disabled={busy}>
              Load sample
            </Button>
            <Button variant="outline" onClick={reset} disabled={busy || !text}>
              Clear
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
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
