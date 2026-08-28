'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LibraryPicker } from '@/components/courses/LibraryPicker';
import {
  attachExercise,
  attachMockInterview,
  attachProject,
  attachQuiz,
  type LibraryRow,
} from '@/lib/api/courses';
import { axiosInstance } from '@/lib/api/axios';
import { toast } from 'sonner';

export type CapstoneKind = 'project' | 'mock' | 'quiz' | 'exercise';

const TITLES: Record<CapstoneKind, string> = {
  project: 'Attach a project',
  mock: 'Attach a mock interview',
  quiz: 'Attach a quiz',
  exercise: 'Attach an exercise',
};

/**
 * Attaching at course level — no chapterId — is what places something in the
 * capstone. Quizzes and exercises use the same library search as the chapter
 * flow; projects and mock interviews are separate products, so they come from
 * their own admin lists.
 */
export default function CapstoneAttachDialog({
  open,
  kind,
  courseId,
  onClose,
  onAttached,
}: {
  open: boolean;
  kind: CapstoneKind | null;
  courseId: string;
  onClose: () => void;
  onAttached: () => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!kind) return null;

  const attach = async (id: string, title: string) => {
    setBusy(true);
    try {
      if (kind === 'quiz') await attachQuiz(courseId, { quizId: id });
      else if (kind === 'exercise') await attachExercise(courseId, { exerciseId: id });
      else if (kind === 'project') await attachProject(courseId, { projectId: id });
      else await attachMockInterview(courseId, { mockInterviewId: id, type: 'CHAT' });

      toast.success(`Attached “${title}” to the capstone.`);
      onAttached();
      onClose();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (error as Error).message;
      toast.error('Could not attach that', { description: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>{TITLES[kind]}</DialogTitle>
        </DialogHeader>

        {kind === 'quiz' || kind === 'exercise' ? (
          <LibraryPicker
            kind={kind}
            busy={busy}
            onPick={(row: LibraryRow) => attach(row.id, row.title)}
          />
        ) : (
          <ProductPicker kind={kind as 'project' | 'mock'} busy={busy} onPick={attach} />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ProductRow = {
  id: string;
  title?: string;
  name?: string;
  difficulty?: string;
  status?: string;
  updatedAt?: string;
};

/** Projects and mock interviews have their own admin lists, not the content library. */
function ProductPicker({
  kind,
  busy,
  onPick,
}: {
  kind: 'project' | 'mock';
  busy: boolean;
  onPick: (id: string, title: string) => void;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const noun = kind === 'project' ? 'projects' : 'mock interviews';

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  // Both endpoints take `q`. Searching on the server matters here: there are
  // hundreds of projects, and the old fixed limit=100 silently hid the rest
  // behind a wall of identically titled rows.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['capstone-products', kind, debounced],
    queryFn: async () => {
      const base = kind === 'project' ? '/admin/projects' : '/admin/mock-interview-templates';
      const search = new URLSearchParams({ limit: '20' });
      if (debounced) search.set('q', debounced);
      const response = await axiosInstance.get(`${base}?${search.toString()}`);
      return {
        rows: ((response.data?.data ?? []) as ProductRow[]).map((row) => ({
          id: row.id,
          title: row.title ?? row.name ?? 'Untitled',
          difficulty: row.difficulty || null,
          status: row.status || null,
          updatedAt: row.updatedAt || null,
        })),
        total: (response.data?.total ?? 0) as number,
      };
    },
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={`Search existing ${noun}…`}
          className="pl-9"
          aria-label={`Search existing ${noun}`}
        />
      </div>

      {isLoading ? (
        <LoadingState label="Searching…" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {debounced
            ? `Nothing matches “${debounced}”.`
            : `No ${noun} exist yet. They are authored in their own section.`}
        </p>
      ) : (
        <>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(row.id, row.title)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{row.title}</span>
                    {/* Without this every row reads the same. */}
                    <span className="block truncate text-xs text-muted-foreground">
                      {[
                        row.difficulty,
                        row.status,
                        row.updatedAt
                          ? `updated ${new Date(row.updatedAt).toLocaleDateString()}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || row.id}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-primary">Attach</span>
                </button>
              </li>
            ))}
          </ul>
          {data && data.total > rows.length ? (
            <p className="text-xs text-muted-foreground">
              Showing {rows.length} of {data.total}. Search to narrow it down.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
