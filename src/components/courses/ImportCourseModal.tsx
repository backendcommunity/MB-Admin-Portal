'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CodeArea } from '@/components/shared/form/CodeArea';
import { Alert } from '@/components/ui/alert';
import { axiosInstance } from '@/lib/api/axios';
import {
  attachMockInterview,
  attachProject,
  attachQuiz,
  attachExercise,
  createArticle,
  createCategory,
  createChapter,
  createCourse,
  createVideo,
  fetchCategories,
  setCourseStatus,
  type Category,
} from '@/lib/api/courses';
import {
  parseImport,
  importSample,
  type ImportCatalog,
  type ImportMode,
  type ImportResult,
} from '@/lib/courses/import';
import { toApiQuestions } from '@/lib/courses/quiz';
import { stripPricingFields } from '@/lib/pricing-fields';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

/**
 * What would 403 partway through an import for a non-staff caller, per the
 * approval-workflow report: `POST /admin/categories` (admin-only — a new
 * category named in the document), and `POST /quizzes` / `POST /exercises`
 * (both admin-only for CREATE, because Quiz and Exercise carry no ownership
 * column at all — there is no way to scope who may write them). Attaching an
 * EXISTING quiz/exercise/project is a different, already-open call
 * (`attachQuiz`/`attachExercise`/`attachProject`) and is not blocked here.
 */
function importBlockers(doc: {
  newCategory?: string;
  chapters: Array<{ items: Array<{ kind: string }> }>;
}): string[] {
  const problems: string[] = [];
  if (doc.newCategory) {
    problems.push(
      `Category "${doc.newCategory}" doesn't exist — pick an existing one, or ask an admin to add it.`,
    );
  }
  const newQuizzes = doc.chapters.reduce(
    (n, chapter) => n + chapter.items.filter((item) => item.kind === 'quiz').length,
    0,
  );
  const newExercises = doc.chapters.reduce(
    (n, chapter) => n + chapter.items.filter((item) => item.kind === 'exercise').length,
    0,
  );
  if (newQuizzes) {
    problems.push(
      `This document creates ${newQuizzes} new quiz${newQuizzes === 1 ? '' : 'zes'} — only an admin can create a quiz. Remove ${newQuizzes === 1 ? 'it' : 'them'} from the document, or ask an admin to run this import.`,
    );
  }
  if (newExercises) {
    problems.push(
      `This document creates ${newExercises} new exercise${newExercises === 1 ? '' : 's'} — only an admin can create an exercise. Remove ${newExercises === 1 ? 'it' : 'them'} from the document, or ask an admin to run this import.`,
    );
  }
  return problems;
}

/**
 * One document builds a whole course: record, category, chapters, videos,
 * articles, quizzes, exercises, capstone, publication.
 *
 * It is replayed as the same calls the forms make — no bulk endpoint, so there is
 * one validation path and a partial failure is visible at the call that failed.
 */
export default function ImportCourseModal({
  open,
  onClose,
  mode = 'course',
  courseId,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  mode?: ImportMode;
  /** Required in curriculum mode: the course the chapters are appended to. */
  courseId?: string;
  onImported: (courseId: string) => void;
}) {
  const role = useAuthStore((s) => s.userRole);
  const authResolved = useAuthStore((s) => s.authResolved);
  // Fail closed: until the session check lands, treat the caller as non-staff
  // rather than trusting a possibly-stale cached role (see SuperAdminOnly).
  const isStaff = authResolved && (role === 'ADMIN' || role === 'SUPER_ADMIN');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<ImportCatalog>({
    categories: [],
    projects: [],
    mockInterviews: [],
    takenSlugs: [],
  });

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const [categories, projects, mocks, courses] = await Promise.allSettled([
        fetchCategories(),
        axiosInstance.get('/admin/projects?limit=100'),
        axiosInstance.get('/admin/mock-interview-templates?limit=100'),
        axiosInstance.get('/admin/courses?limit=100'),
      ]);

      setCatalog({
        categories: categories.status === 'fulfilled' ? categories.value : [],
        projects:
          projects.status === 'fulfilled'
            ? (projects.value.data?.data ?? []).map((row: { id: string; title: string }) => ({
                id: row.id,
                title: row.title,
              }))
            : [],
        mockInterviews:
          mocks.status === 'fulfilled'
            ? (mocks.value.data?.data ?? []).map((row: { id: string; name: string }) => ({
                id: row.id,
                title: row.name,
              }))
            : [],
        takenSlugs:
          courses.status === 'fulfilled'
            ? (courses.value.data?.data ?? []).map((row: { slug: string }) => row.slug)
            : [],
      });
    };
    void load();
  }, [open]);

  const result: ImportResult | null = useMemo(
    () => (text.trim() ? parseImport(text, catalog, mode) : null),
    [text, catalog, mode],
  );

  const run = async () => {
    if (!result?.ok || !result.doc) return;
    const { doc } = result;

    // Refuse before writing anything — not after the API 403s partway
    // through, with chapters and videos already created. Staff hit none of
    // these guards; they're the only callers `createCategory`/`POST
    // /quizzes`/`POST /exercises` actually accept.
    if (!isStaff) {
      const blockers = importBlockers(doc);
      if (blockers.length) {
        toast.error('Cannot import this document', {
          description: blockers.join(' '),
        });
        return;
      }
    }

    setBusy(true);

    try {
      let categoryId = doc.course.categoryId ?? null;
      if (doc.newCategory) {
        const created: Category = await createCategory(doc.newCategory);
        categoryId = created.id;
      }

      // `doc.course` is posted almost verbatim — unlike a form-driven save,
      // there is no field left unset by the UI to save it here. A document
      // (including the shipped sample) is real course data and may well
      // carry amount/isPremium/paddle fields; the API refuses their mere
      // PRESENCE from a non-staff caller, so they are stripped the same way
      // every other non-staff save in this app strips them.
      const coursePayload = isStaff
        ? { ...doc.course, categoryId }
        : stripPricingFields({ ...doc.course, categoryId });

      const targetId =
        mode === 'curriculum' ? (courseId as string) : (await createCourse(coursePayload)).id;

      for (const chapter of doc.chapters) {
        const created = await createChapter(targetId, {
          title: chapter.title,
          summary: chapter.summary,
          description: chapter.description,
          slug: chapter.slug,
          type: chapter.type,
          isPremium: chapter.isPremium,
        });

        for (const item of chapter.items) {
          if (item.kind === 'video') {
            await createVideo(targetId, created.id, {
              title: item.title,
              slug: item.slug,
              video: item.video,
              duration: item.duration,
              summary: item.summary,
              description: item.description,
              isPremium: item.isPremium,
            });
          } else if (item.kind === 'article') {
            await createArticle(targetId, created.id, {
              title: item.title,
              slug: item.slug,
              ...(item.blocks.length ? { blocks: item.blocks } : {}),
              content: item.content,
              excerpt: item.excerpt,
              readingTime: item.readingTime,
              isPremium: item.isPremium,
            });
          } else if (item.kind === 'quiz') {
            // Library object: created once, then joined to this chapter.
            const { data: quiz } = await axiosInstance.post('/quizzes', {
              title: item.title,
              slug: item.slug,
              description: item.description,
              passingScore: item.passingScore,
              timeLimit: item.timeLimit,
              maxAttempts: item.maxAttempts,
              difficulty: item.difficulty,
              // A pasted payload may use either convention; both land as text.
              questions: toApiQuestions(item.questions),
            });
            const quizId = quiz?.data?.id ?? quiz?.id;
            if (quizId) await attachQuiz(targetId, { quizId, chapterId: created.id });
          } else {
            const { data: exercise } = await axiosInstance.post('/exercises', {
              title: item.title,
              slug: item.slug,
              description: item.description,
              instructions: item.instructions,
              solution: item.solution,
              starterCode: item.starterCode,
              languages: item.languages,
              graderType: item.graderType,
              testCases: item.testCases,
              points: item.points,
              passMark: item.passMark,
              difficulty: item.difficulty,
            });
            const exerciseId = exercise?.data?.id ?? exercise?.id;
            if (exerciseId) await attachExercise(targetId, { exerciseId, chapterId: created.id });
          }
        }
      }

      for (let index = 0; index < doc.capstone.length; index += 1) {
        const link = doc.capstone[index];
        if (link.kind === 'project') {
          await attachProject(targetId, {
            projectId: link.id,
            order: index,
            isOptional: link.isOptional,
          });
        } else {
          await attachMockInterview(targetId, {
            mockInterviewId: link.id,
            order: index,
            isOptional: link.isOptional,
            type: link.modality ?? 'CHAT',
          });
        }
      }

      if (doc.publish && mode === 'course') {
        try {
          await setCourseStatus(targetId, 'publish');
        } catch {
          toast.message('Imported as a draft', {
            description: 'The API refused the publish — check the readiness panel.',
          });
        }
      }

      toast.success(
        mode === 'curriculum'
          ? `Appended ${doc.chapters.length} chapters.`
          : doc.publish
            ? 'Imported and published.'
            : 'Imported as a draft.',
      );
      setText('');
      onImported(targetId);
      onClose();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (error as Error).message;
      toast.error('Import stopped', {
        description: `${message}. Anything already created is kept — fix the document and re-run the rest.`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>
            {mode === 'curriculum' ? 'Import chapters from JSON' : 'Import a course from JSON'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {mode === 'curriculum'
              ? 'Paste a chapters array, or a whole course document — only its chapters and capstone are read, and they are appended to this course.'
              : 'One JSON object describes the whole course — fields, chapters, items, capstone. It is validated before anything is written.'}
          </p>

          <CodeArea
            value={text}
            onChange={setText}
            ariaLabel="Course JSON"
            minHeight={224}
            placeholder='{ "title": "…", "chapters": [ … ] }'
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setText(importSample())}
            >
              Load sample
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setText('')}>
              Clear
            </Button>
          </div>

          {result ? <ImportReport result={result} /> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy || !result?.ok}>
            {busy ? 'Importing…' : mode === 'curriculum' ? 'Append chapters' : 'Import course'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportReport({ result }: { result: ImportResult }) {
  const { counts, doc } = result;

  return (
    <div className="space-y-3">
      {result.errors.length ? (
        <Alert className="border-destructive/40 bg-destructive/10">
          <p className="text-sm font-semibold">
            {result.errors.length} problem{result.errors.length === 1 ? '' : 's'} — nothing will be
            written.
          </p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
            {result.errors.map((error) => (
              <li key={error}>• {error}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert className="border-success/40 bg-success-wash">
          <p className="text-sm font-semibold">Ready.</p>
          <p className="mt-1 text-xs">
            {counts.chapters} chapters · {counts.video} videos · {counts.article} articles ·{' '}
            {counts.quiz} quizzes · {counts.exercise} exercises · {counts.capstone} capstone items.
            {counts.incomplete ? ` ${counts.incomplete} item(s) import incomplete.` : ''}{' '}
            {doc?.publish ? 'Publishes on import.' : 'Lands as a draft.'}
          </p>
        </Alert>
      )}

      {doc && !result.errors.length ? (
        <details open className="rounded-md border border-border bg-muted/40 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            What will be created
          </summary>
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
            {doc.newCategory ? (
              <p>
                <Chip>category</Chip> {doc.newCategory}{' '}
                <em className="text-muted-foreground">new</em>
              </p>
            ) : null}
            <p>
              <Chip>course</Chip> <strong>{doc.course.title}</strong>{' '}
              <span className="font-mono text-muted-foreground">{doc.course.slug}</span>
            </p>
            {doc.chapters.map((chapter, index) => (
              <div key={`${chapter.slug}-${index}`}>
                <p className="pl-3">
                  <Chip>chapter {index + 1}</Chip> {chapter.title}
                  {chapter.isPremium ? null : (
                    <em className="ml-1 text-muted-foreground">free preview</em>
                  )}
                </p>
                {chapter.items.map((item, itemIndex) => (
                  <p key={`${item.slug}-${itemIndex}`} className="pl-8 text-muted-foreground">
                    <Chip>{item.kind}</Chip> {item.title}
                    {item.complete ? null : (
                      <span className="ml-1 rounded bg-warning-wash px-1 text-[10px] font-semibold uppercase text-warning">
                        incomplete
                      </span>
                    )}
                  </p>
                ))}
              </div>
            ))}
            {doc.capstone.map((link) => (
              <p key={`${link.kind}-${link.id}`} className="pl-8 text-muted-foreground">
                <Chip>{link.kind}</Chip> {link.title} <em>attached</em>
              </p>
            ))}
          </div>
        </details>
      ) : null}

      {result.notes.length ? (
        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            {result.notes.length} note{result.notes.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {result.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'mr-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        className,
      )}
    >
      {children}
    </span>
  );
}
