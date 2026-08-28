'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { searchLibrary, type LibraryKind, type LibraryRow } from '@/lib/api/courses';

/**
 * Search everything already authored, of one kind.
 *
 * The list is explicit about what picking a row will do, because the two outcomes
 * are genuinely different and the schema decides which you get:
 *   attach — quizzes and exercises are library rows; the same row is reused
 *   copy   — chapters, videos and articles belong to one parent, so reuse
 *            duplicates them and the copy then diverges from the original
 */
export function LibraryPicker({
  kind,
  excludeCourseId,
  onPick,
  busy,
  /** Overrides the kind's default. A video is copied into a chapter, but attached
      to the capstone — same search, different consequence. */
  reuseAs,
}: {
  kind: LibraryKind;
  excludeCourseId?: string;
  onPick: (row: LibraryRow) => void;
  busy?: boolean;
  reuseAs?: 'attach' | 'copy';
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['library', kind, debounced, excludeCourseId],
    queryFn: () => searchLibrary({ kind, q: debounced || undefined, excludeCourseId, limit: 20 }),
  });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const reuse = reuseAs ?? (kind === 'quiz' || kind === 'exercise' ? 'attach' : 'copy');
  // "quizs" otherwise — every other kind takes a plain -s.
  const plural = kind === 'quiz' ? 'quizzes' : `${kind}s`;
  const verb = reuse === 'attach' ? 'Attach' : 'Copy';

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={`Search existing ${plural}…`}
          className="pl-9"
          aria-label={`Search existing ${plural}`}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {reuse === 'attach'
          ? `Attaching reuses the same ${kind}. Editing it later changes it everywhere it is attached; detaching leaves it in place.`
          : `A ${kind} belongs to one ${kind === 'chapter' ? 'course' : 'chapter'}, so this makes a copy. The copy is independent — later edits to the original do not reach it.`}
      </p>

      {isLoading ? (
        <LoadingState label="Searching…" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {debounced ? `Nothing matches “${debounced}”.` : `No ${plural} to reuse yet.`}
        </p>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(row)}
                className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.context ? `${row.context} · ` : ''}
                    {row.meta}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-primary">{verb}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {data && data.total > rows.length ? (
        <p className="text-xs text-muted-foreground">
          Showing {rows.length} of {data.total}. Narrow the search to see more.
        </p>
      ) : null}
    </div>
  );
}

export function LibraryPickerFooterNote({ kind }: { kind: LibraryKind }) {
  return (
    <Button variant="ghost" size="sm" disabled className="pointer-events-none opacity-70">
      {kind === 'quiz' || kind === 'exercise' ? 'Reuses one row' : 'Creates a copy'}
    </Button>
  );
}
