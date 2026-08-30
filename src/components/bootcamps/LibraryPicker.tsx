'use client';

import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchLibrary, type LibraryKind, type LibraryRow } from '@/lib/api/bootcamps';

/**
 * Search one library and pick a row from it.
 *
 * The chosen id is what gets stored, but the label has to survive a page that
 * only knows the id — so the caller keeps both, and this shows the stored title
 * until a new search replaces it.
 */
export default function LibraryPicker({
  kind,
  label,
  value,
  valueTitle,
  onPick,
  hint,
}: {
  /** Which library to search — one endpoint serves them all. */
  kind: LibraryKind;
  label: string;
  value: string;
  valueTitle: string;
  onPick: (row: { id: string; title: string } | null) => void;
  hint?: string;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  // Keyboard users never move a mouse, so a pointer leaving must not close a
  // list they are typing into.
  const typing = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchLibrary(kind, q.trim());
        if (!cancelled) {
          setRows(found);
          setFailed(false);
        }
      } catch {
        // A failed request and an empty library look identical otherwise, and
        // that is what made a wrong endpoint read as "nothing matches".
        if (!cancelled) {
          setRows([]);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, kind, open]);

  return (
    <div
      className="space-y-1.5"
      // Three of these stack in the task dialog, and three open result lists
      // bury the fields underneath them.
      onMouseLeave={() => {
        if (!typing.current) setOpen(false);
      }}
    >
      <Label>{label}</Label>

      {value ? (
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm">{valueTitle || value}</span>
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => {
              onPick(null);
              setOpen(true);
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <Input
            value={q}
            onFocus={() => {
              typing.current = true;
              setOpen(true);
            }}
            onBlur={() => {
              typing.current = false;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                typing.current = false;
                setOpen(false);
                event.currentTarget.blur();
              }
            }}
            onChange={(event) => {
              setQ(event.target.value);
              setOpen(true);
            }}
            placeholder="Search the library…"
            aria-label={label}
          />
          {open ? (
            <div className="max-h-48 overflow-y-auto rounded-lg border">
              {loading ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
              ) : failed ? (
                <p className="px-3 py-2 text-xs text-danger">
                  The library search failed. Try again in a moment.
                </p>
              ) : rows.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {q.trim() ? `No ${kind} matches “${q.trim()}”.` : `No ${kind}s yet.`}
                </p>
              ) : (
                rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      onPick(row);
                      typing.current = false;
                      setOpen(false);
                      setQ('');
                    }}
                  >
                    <span className="block truncate text-sm">{row.title}</span>
                    {/* Two videos can share a name; the meta and where it
                        already lives are what tell them apart. */}
                    {row.meta || row.context ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {[row.meta, row.context].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </>
      )}

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
