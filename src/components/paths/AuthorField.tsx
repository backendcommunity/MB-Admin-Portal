'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { axiosInstance } from '@/lib/api/axios';
import type { PathAuthor } from '@/lib/api/paths';

type UserRow = { id: string; name: string; email: string };

/**
 * Who authored the path.
 *
 * Stored as a user id, which is why this is a search rather than a text box:
 * nobody knows a uuid, and typing one wrong used to be a foreign key violation
 * surfacing as a 500. The current author is shown as a person, and clearing is
 * an explicit action so it cannot happen by half-deleting a field.
 */
export function AuthorField({
  author,
  value,
  onChange,
}: {
  /** Resolved from the server — what is currently saved. */
  author: PathAuthor | null;
  /** The draft's createdById, which may already differ from `author`. */
  value: string;
  onChange: (id: string) => void;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picking, setPicking] = useState(false);
  // A pick writes to the draft, and the draft is not saved yet — so the server
  // author still says the old name. Remember the row that was chosen and show
  // that instead, or the field looks like the click did nothing.
  const [pending, setPending] = useState<UserRow | null>(null);

  // Whichever describes the id the draft is actually carrying.
  const shown: PathAuthor | UserRow | null =
    value && pending?.id === value
      ? pending
      : value && author?.id === value
        ? author
        : value
          ? null
          : null;
  const unsaved = value !== (author?.id ?? '');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ['author-search', debounced],
    queryFn: async () => {
      const search = new URLSearchParams({ limit: '8' });
      if (debounced) search.set('q', debounced);
      const response = await axiosInstance.get(`/admin/users?${search.toString()}`);
      return (response.data?.data ?? []) as UserRow[];
    },
    enabled: picking,
  });

  if (!picking) {
    return (
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Author</Label>
        {shown ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">{shown.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{shown.email}</span>
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
              Change
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => {
                setPending(null);
                onChange('');
              }}
              aria-label="Clear author"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2">
            <span className="flex-1 text-sm text-muted-foreground">No author set.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
              Set author
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Shown on the path and used to scope instructor-owned content.
          {unsaved ? ' Not saved yet — press Save.' : ''}
        </p>
      </div>
    );
  }

  const rows = data ?? [];

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label htmlFor="author-search">Author</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="author-search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search by name or email…"
          className="pl-9"
          autoFocus
        />
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto">
        {isFetching && !rows.length ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">Searching…</p>
        ) : rows.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            {debounced ? `Nobody matches “${debounced}”.` : 'Type to search.'}
          </p>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setPending(row);
                onChange(row.id);
                setPicking(false);
                setTerm('');
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-accent"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">{row.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{row.email}</span>
              </span>
              {value === row.id ? (
                <span className="shrink-0 text-xs text-muted-foreground">Current</span>
              ) : null}
            </button>
          ))
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setPicking(false);
          setTerm('');
        }}
      >
        Cancel
      </Button>
    </div>
  );
}
