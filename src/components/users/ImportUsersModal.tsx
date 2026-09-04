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
import { Checkbox } from '@/components/ui/checkbox';
import { CodeArea } from '@/components/shared/form/CodeArea';
import { createUserImport } from '@/lib/api/userImports';
import { parseUserImport } from '@/lib/users/import';
import { ACTIVATION_VIDEO_AVAILABLE } from '@/lib/constants/activation-video';

/**
 * Bulk-creates accounts from a CSV or JSON roster. Same shape as
 * `ImportProjectModal`: parsing is local and instant, nothing is written
 * until Import is pressed, and `errors` block the button while `notes`
 * explain what will be skipped without blocking anything.
 *
 * One thing this preview deliberately does NOT do: claim to know which
 * addresses already have an account. There is no endpoint that answers that
 * — the API (`POST /admin/user-imports`) skips existing accounts itself, and
 * only its own row statuses (`CREATED` / `ALREADY_REGISTERED`) know the
 * answer, after the import has actually run. Showing a guess here would read
 * as a fact it isn't. What this preview CAN know from the file alone —
 * valid, invalid, duplicate-in-file, name-derived — is what it shows; the
 * created/already-registered split is left to the import's own record.
 *
 * The activation-video checkbox only ever contributes a boolean. The video
 * URL and poster are server-side constants — never something typed into a
 * browser and forwarded into an email that also carries a working password.
 */
export default function ImportUsersModal({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (importId: string) => void;
}) {
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [includeActivationVideo, setIncludeActivationVideo] = useState(false);
  const [busy, setBusy] = useState(false);

  const result = useMemo(
    () => (text.trim() ? parseUserImport(text, filename || 'pasted.csv') : null),
    [text, filename],
  );

  const reset = () => {
    setText('');
    setFilename('');
    setIncludeActivationVideo(false);
  };

  const onFile = async (file: File) => {
    setFilename(file.name);
    setText(await file.text());
  };

  const blocked = !result || Boolean(result.errors.length) || result.rows.length === 0;

  const skipped = result ? result.counts.duplicates + result.counts.invalid : 0;
  const summary = result
    ? [
        `${result.rows.length} will be created`,
        skipped
          ? `${skipped} will be skipped (${[
              result.counts.duplicates ? `${result.counts.duplicates} duplicate` : '',
              result.counts.invalid ? `${result.counts.invalid} invalid` : '',
            ]
              .filter(Boolean)
              .join(', ')})`
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const run = async () => {
    if (!result || blocked) return;
    setBusy(true);
    try {
      const created = await createUserImport({
        filename: filename.trim() || 'import.csv',
        includeActivationVideo,
        // The server is the sole authority on name derivation
        // (`deriveNameFromEmail`) — send `name` only for a row whose name
        // actually came from the file. `result.rows` carries a locally
        // derived guess for preview purposes only (see `deriveName`'s
        // docstring in `lib/users/import.ts`); sending that guess as `name`
        // would make the server treat it as a real, non-derived name and
        // never set `nameWasDerived`/`nameIsProvisional`.
        rows: result.rows.map((row) =>
          result.derivedEmails.includes(row.email)
            ? { email: row.email }
            : { name: row.name, email: row.email },
        ),
      });
      toast.success(`${created.queued} account(s) queued for creation.`, {
        description:
          'Existing accounts are skipped automatically. Which addresses were new vs. already ' +
          'registered is recorded on the import itself once it finishes processing.',
      });
      onImported(created.id);
      onOpenChange(false);
      reset();
    } catch (error) {
      toast.error('The import failed to start', { description: (error as Error).message });
    } finally {
      setBusy(false);
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
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import users</DialogTitle>
          <DialogDescription>
            Upload or paste a CSV or JSON roster of names and emails. Each row gets a new account
            and a temporary password by email — existing addresses are skipped, not welcomed again.
            Nothing is written until you press Import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="import-file" className="text-sm font-medium">
            CSV or JSON file
          </label>
          <input
            id="import-file"
            type="file"
            accept=".csv,.json"
            className="block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary"
            onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])}
          />
        </div>

        <CodeArea
          value={text}
          onChange={setText}
          minHeight={160}
          ariaLabel="Roster CSV or JSON"
          placeholder={'email,name\nada@x.io,Ada Lovelace\n…or a JSON array of { name, email }'}
        />

        {result?.errors.length ? (
          <div className="space-y-1 rounded-lg border border-destructive bg-destructive/10 p-3 text-xs text-destructive">
            <p className="font-medium">Nothing will be written until these are fixed</p>
            {result.errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}

        {result && !result.errors.length ? (
          <div className="rounded-lg border p-3 text-xs">
            <p className="font-medium">{summary}</p>
            {result.rows.length ? (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {result.rows.map((row) => (
                  <li key={row.email} className="flex items-center gap-2">
                    <span className="truncate">
                      {row.name}
                      {result.derivedEmails.includes(row.email) ? (
                        <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] uppercase text-muted-foreground">
                          derived
                        </span>
                      ) : null}{' '}
                      <span className="text-muted-foreground">— {row.email}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {result?.notes.length ? (
          <div className="space-y-1 rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
            <p className="font-medium">Skipped rows and other notes</p>
            {result.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        ) : null}

        <label
          className="flex items-start gap-3 rounded-lg border p-3"
          title={
            ACTIVATION_VIDEO_AVAILABLE
              ? undefined
              : 'Not available yet — the three-months-free flow it unlocks is not confirmed live.'
          }
        >
          <Checkbox
            checked={includeActivationVideo}
            onCheckedChange={(next) => setIncludeActivationVideo(next === true)}
            disabled={!ACTIVATION_VIDEO_AVAILABLE}
            aria-label="Activation walkthrough video"
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium">
              Include the activation walkthrough video
            </span>
            <span className="block text-xs text-muted-foreground">
              {ACTIVATION_VIDEO_AVAILABLE
                ? 'Links the walkthrough video in the welcome email.'
                : 'Not available yet — the three-months-free flow it unlocks is not confirmed live.'}
            </span>
          </span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={reset} disabled={busy || !text}>
            Clear
          </Button>
          <Button onClick={run} disabled={busy || blocked}>
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
