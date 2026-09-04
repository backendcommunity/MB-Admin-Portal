'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { parsePathImport, importSample, type ImportResult } from '@/lib/paths/import';
import { resolveImportItems, resolvedId, type Resolution } from '@/lib/paths/resolve';
import {
  attachItem,
  createPath,
  createTopic,
  kindIsCreatable,
  reorderItems,
  searchLibrary,
  setPathStatus,
  updatePath,
  updateTopic,
  type ItemKind,
} from '@/lib/api/paths';

export default function ImportPathModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (pathId: string) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  const result: ImportResult | null = useMemo(
    () => (text.trim() ? parsePathImport(text) : null),
    [text],
  );

  // Checked before anything is written, so the plan can say what will actually
  // attach rather than the import discovering it halfway through.
  const wanted = useMemo(
    () =>
      (result?.doc?.topics ?? []).flatMap((topic) =>
        topic.items.map((item) => `${item.kind}:${item.title}`),
      ),
    [result],
  );
  const { data: resolution, isFetching: resolving } = useQuery({
    queryKey: ['import-resolve', wanted],
    queryFn: () => resolveImportItems(result!.doc!.topics),
    enabled: Boolean(result?.ok && wanted.length),
  });

  /**
   * Every one of the twelve kinds is a join table, so an import can only ever
   * LINK content that already exists — it cannot create a course. Items are
   * matched by title, and anything with no match is reported rather than
   * silently dropped.
   */
  const run = async () => {
    if (!result?.ok || !result.doc) return;
    setBusy(true);
    const missing: string[] = [];
    let createdItems = 0;

    try {
      const { path, topics, publish } = result.doc;
      const created = await createPath({
        title: String(path.title),
        ...(path.slug ? { slug: String(path.slug) } : {}),
        ...(path.summary ? { summary: String(path.summary) } : {}),
      });

      // The create endpoint takes only the three identity fields; everything
      // else lands in one update.
      const rest: Record<string, unknown> = { ...path };
      delete rest.title;
      delete rest.slug;
      delete rest.summary;
      await updatePath(created.id, rest);

      for (const topic of topics) {
        const madeTopic = await createTopic(created.id, {
          title: topic.title,
          summary: topic.summary,
        });
        await updateTopic(created.id, madeTopic.id, {
          description: topic.description,
          banner: topic.banner,
          level: topic.level,
          duration: topic.duration,
          outcomes: topic.outcomes,
          recommendation: topic.recommendation,
          reference: topic.reference,
          isPremium: topic.isPremium,
        });

        // Attached in array order, so the sequence a payload is written in is
        // the sequence a learner walks — unless an item names its own position.
        const attached: Array<{ kind: string; id: string; order?: number }> = [];
        for (const item of topic.items) {
          // Already resolved before the first write — see the plan panel.
          const hitId = resolution ? resolvedId(resolution, item.kind, item.title) : null;

          // A resource with a link is made here rather than skipped: it has no
          // required fields, so nothing is invented. Every other kind still
          // skips, because a title cannot supply what they need.
          const willCreate = !hitId && kindIsCreatable(item.kind) && Boolean(item.link);
          if (!hitId && !willCreate) {
            missing.push(`${item.kind} “${item.title}”`);
            continue;
          }

          const response = await attachItem(created.id, madeTopic.id, {
            kind: item.kind as ItemKind,
            ...(hitId
              ? { id: hitId }
              : { create: { title: item.title, link: item.link as string } }),
            ...(item.isOptional !== undefined ? { isOptional: item.isOptional } : {}),
            ...(item.order !== undefined ? { order: item.order } : {}),
            ...(item.type !== undefined ? { type: item.type } : {}),
          });
          if (willCreate) createdItems += 1;

          // A created row's id comes back on the join it just made.
          const linkedId = hitId ?? (response?.resourceId as string | undefined);
          if (linkedId) attached.push({ kind: item.kind, id: linkedId, order: item.order });
        }

        // An explicit `order` on any item means the payload is describing the
        // sequence itself, so renumber the whole topic in one write rather than
        // leaving a mix of authored and appended positions.
        if (attached.some((row) => row.order !== undefined) && attached.length > 1) {
          const ordered = [...attached].sort(
            (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
          );
          await reorderItems(
            created.id,
            madeTopic.id,
            ordered.map((row) => ({ kind: row.kind, id: row.id })),
          );
        }
      }

      if (publish) {
        try {
          await setPathStatus(created.id, 'publish');
          toast.success('Imported and published.');
        } catch {
          toast.message('Imported as a draft', {
            description: 'The readiness checks were not met, so it was not published.',
          });
        }
      } else {
        toast.success('Imported as a draft.');
      }

      if (createdItems) {
        toast.message(`${createdItems} resource(s) created`, {
          description: 'They were not in the library, so the import made them from their links.',
        });
      }

      if (missing.length) {
        toast.message(`${missing.length} item(s) could not be attached`, {
          description: `${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''} — create them first, then attach.`,
        });
      }

      setText('');
      onImported(created.id);
    } catch (error) {
      const body = (error as { response?: { data?: { message?: string } } }).response?.data;
      toast.error('Import stopped', { description: body?.message ?? (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Import a path from JSON</DialogTitle>
          <DialogDescription>
            The payload is checked before anything is written. Problems block the import; anything
            recoverable is imported with a note.
          </DialogDescription>
        </DialogHeader>

        <CodeArea
          value={text}
          onChange={setText}
          ariaLabel="JSON payload"
          minHeight={220}
          placeholder={'{ "title": "…", "topics": [ … ] }'}
        />

        {result ? (
          <ImportReport result={result} resolution={resolution} resolving={resolving} />
        ) : null}

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <span className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy || loadingSample}
              onClick={async () => {
                setLoadingSample(true);
                try {
                  // Filled from real library rows so the sample actually
                  // imports — an import links existing content, it cannot
                  // create it, so invented titles would attach nothing.
                  const [course, article, project, mock] = await Promise.all([
                    searchLibrary('course', ''),
                    searchLibrary('article', ''),
                    searchLibrary('project', ''),
                    searchLibrary('mock', ''),
                  ]);
                  setText(
                    importSample({
                      course: course[0]?.title,
                      article: article[0]?.title,
                      project: project[0]?.title,
                      mock: mock[0]?.title,
                    }),
                  );
                } catch {
                  setText(importSample());
                } finally {
                  setLoadingSample(false);
                }
              }}
            >
              {loadingSample ? 'Loading…' : 'Load sample'}
            </Button>
            <Button variant="outline" onClick={() => setText('')} disabled={busy}>
              Clear
            </Button>
          </span>
          <span className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={run} disabled={busy || !result?.ok}>
              {busy ? 'Importing…' : 'Import path'}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportReport({
  result,
  resolution,
  resolving,
}: {
  result: ImportResult;
  resolution?: Resolution;
  resolving: boolean;
}) {
  const { counts, errors, notes, doc } = result;

  return (
    <div className="space-y-2.5 text-sm">
      {errors.length ? (
        <div className="rounded-lg border border-danger bg-danger-wash p-3 text-danger">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide">
            {errors.length} problem{errors.length === 1 ? '' : 's'} — nothing will be imported
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
            What this will create
          </p>
          <p className="font-mono tabular-nums text-foreground">
            {counts.topics} topics · {counts.items} attachments
          </p>
          {counts.skipped ? (
            <p className="mt-1 text-muted-foreground">
              {counts.skipped} item(s) skipped — see the notes.
            </p>
          ) : null}

          {/*
            An import can only LINK content that already exists, so this is the
            difference between what the payload asks for and what is here.
          */}
          {counts.items ? (
            resolving ? (
              <p className="mt-1 text-muted-foreground">Checking the library…</p>
            ) : resolution ? (
              <p className="mt-1 text-muted-foreground">
                <span className="font-mono tabular-nums text-foreground">{resolution.found}</span>{' '}
                of {counts.items} attachments found in the library
                {resolution.creatable.length ? (
                  <>
                    , and{' '}
                    <span className="font-mono tabular-nums text-foreground">
                      {resolution.creatable.length}
                    </span>{' '}
                    will be created
                  </>
                ) : null}
                .
              </p>
            ) : null
          ) : null}
          {counts.emptyTopics ? (
            <p className="mt-1 text-muted-foreground">
              {counts.emptyTopics} topic(s) will import with no content.
            </p>
          ) : null}
          <p className="mt-1 text-muted-foreground">
            {doc?.publish
              ? 'It will be published.'
              : 'It will be imported as a draft, and published from the editor.'}
          </p>
        </div>
      )}

      {resolution?.creatable.length ? (
        <div className="rounded-lg border border-border bg-muted p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
            {resolution.creatable.length} resource(s) will be created
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {resolution.creatable.map((row) => (
              <li key={`${row.kind}:${row.title}`}>{row.title}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-muted-foreground">
            A resource is a title and a link, so nothing is invented. Every other kind must exist
            first.
          </p>
        </div>
      ) : null}

      {resolution?.missing.length ? (
        <div className="rounded-lg border border-warning bg-warning-wash p-3 text-warning">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide">
            {resolution.missing.length} not in the library — they will be skipped
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {resolution.missing.map((row) => (
              <li key={`${row.kind}:${row.title}`}>
                {row.kind} “{row.title}”
              </li>
            ))}
          </ul>
          <p className="mt-1.5">
            An import links existing content; it cannot create it. Create these first, or remove
            them from the payload.
          </p>
        </div>
      ) : null}

      {notes.length ? (
        <div className="rounded-lg border border-warning bg-warning-wash p-3 text-warning">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide">
            {notes.length} note{notes.length === 1 ? '' : 's'}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
