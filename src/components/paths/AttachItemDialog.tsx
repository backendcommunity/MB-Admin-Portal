'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import {
  attachItem,
  kindLabel,
  kindTakesOptional,
  searchLibrary,
  type ItemKind,
} from '@/lib/api/paths';

/**
 * Attaching links an existing row to the topic. Every one of the twelve kinds
 * is a join table, so nothing here is ever copied and detaching later leaves
 * the object in place.
 */
export default function AttachItemDialog({
  open,
  kind,
  pathId,
  topicId,
  onClose,
  onAttached,
}: {
  open: boolean;
  kind: ItemKind | null;
  pathId: string;
  topicId: string;
  onClose: () => void;
  onAttached: () => void;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [busy, setBusy] = useState(false);
  const [optional, setOptional] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  // Reset when the dialog opens by adjusting state during render rather than in
  // an effect — no cascading render, and the search box is empty on first paint.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      if (term) {
        setTerm('');
        setDebounced('');
      }
      // Required is the default: attaching something to a topic normally means
      // the learner has to do it.
      if (optional) setOptional(false);
    }
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['path-library', kind, debounced],
    queryFn: () => searchLibrary(kind as string, debounced),
    enabled: open && Boolean(kind),
  });

  if (!kind) return null;

  const label = kindLabel(kind).toLowerCase();
  const rows = data ?? [];

  const attach = async (id: string, title: string) => {
    setBusy(true);
    try {
      await attachItem(pathId, topicId, {
        kind,
        id,
        // Only sent where the join can store it — the API refuses it elsewhere
        // rather than dropping it silently.
        ...(kindTakesOptional(kind) ? { isOptional: optional } : {}),
      });
      toast.success(`Attached “${title}”.`);
      onAttached();
      onClose();
    } catch (error) {
      const body = (error as { response?: { data?: { message?: string } } }).response?.data;
      toast.error('Could not attach that', {
        description: body?.message ?? (error as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>
            Attach {label === 'mock interview' ? 'a mock interview' : `a ${label}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={`Search ${label}s…`}
              aria-label={`Search ${label}s`}
              className="pl-9"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Attaching reuses the same {label}. Editing it later changes it everywhere it is
            attached; detaching leaves it in place.
          </p>

          {kindTakesOptional(kind) ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div>
                <label htmlFor="attach-optional" className="text-sm font-medium text-foreground">
                  Optional
                </label>
                <p className="text-xs text-muted-foreground">
                  The learner can skip it and still finish the topic. You can change this afterwards
                  with the same switch in the list.
                </p>
              </div>
              <Switch
                id="attach-optional"
                checked={optional}
                onCheckedChange={setOptional}
                aria-label="Optional"
              />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              A {label} is always required — its link has no optional column to store anything else.
            </p>
          )}

          {isLoading ? (
            <LoadingState label="Searching…" />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {debounced ? `Nothing matches “${debounced}”.` : `No ${label}s to attach yet.`}
            </p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => attach(row.id, row.title)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">{row.title}</span>
                      {row.meta ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.meta}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-primary">Attach</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
