'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagInput } from '@/components/shared/form/TagInput';
import { LanguageMultiSelect } from '@/components/shared/form/LanguageMultiSelect';
import { RichTextField } from '@/components/shared/form/RichTextField';
import { CodeArea } from '@/components/shared/form/CodeArea';
import {
  GraderConfigEditor,
  pruneGraderConfig,
  type GraderConfig,
} from '@/components/courses/GraderConfigEditor';
import { STATIC_LANGUAGES, toDisplayName, toExecutorCode } from '@/lib/courses/exercise-languages';
import { axiosInstance } from '@/lib/api/axios';
import {
  addCapstoneMedia,
  attachExercise,
  attachQuiz,
  copyChapter,
  copyItem,
  createArticle,
  createChapter,
  createVideo,
  fetchExerciseDetail,
  fetchQuizDetail,
  updateArticle,
  updateChapter,
  updateExerciseLibrary,
  updateQuizLibrary,
  updateVideo,
  type Chapter,
  type ChapterItem,
  type ChapterType,
} from '@/lib/api/courses';
import { BlockEditor } from '@/components/courses/BlockEditor';
import { blocksToContent, parseBlocks, type ArticleBlock } from '@/lib/courses/blocks';
import { toast } from 'sonner';
import { PayloadDialog } from '@/components/shared/PayloadDialog';
import { LibraryPicker } from '@/components/courses/LibraryPicker';
import {
  fromApiQuestions,
  questionGaps,
  toApiQuestions,
  type DraftQuestion,
} from '@/lib/courses/quiz';
import { ITEM_LABELS, ITEM_OWNED, missingFor, type ItemKind } from '@/lib/courses/items';
import { JsonFillPanel } from '@/components/courses/JsonFillPanel';
import { cn } from '@/lib/utils';

export type DrawerTarget =
  | { kind: 'chapter'; chapter?: Chapter }
  | { kind: 'video' | 'article' | 'quiz' | 'exercise'; chapterId: string; item?: ChapterItem }
  /** Course-level media: the same form, saved to the capstone instead of a chapter. */
  | { kind: 'video' | 'article'; capstone: true; item?: ChapterItem };

const CHAPTER_TYPES: ChapterType[] = ['MIXED', 'VIDEO', 'QUIZ', 'PLAYGROUND', 'EXERCISE'];
const DIFFICULTY = ['Easy', 'Medium', 'Hard'];
// Exported so tests can pin the picker's options without opening the Radix
// Select popup — doing so hangs jsdom in this repo (no ResizeObserver
// polyfill; see BlockEditor.test.tsx).
export const GRADERS = ['OUTPUT_MATCH', 'FUNCTION_CALL', 'TEST_CASES'];
const ARTICLE_TYPES = ['ARTICLE', 'EXERCISE', 'ACTIVITY', 'PROJECT'];

type State = Record<string, unknown>;

/**
 * One drawer for everything inside a chapter, because the two classes of item
 * need different flows:
 *   video, article — owned by the chapter (required chapterId), created in place
 *   quiz, exercise — library rows joined to the chapter, created once and reused
 */
export default function ItemDrawer({
  open,
  target,
  courseId,
  onClose,
  onSaved,
}: {
  open: boolean;
  target: DrawerTarget | null;
  courseId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState<State>({});
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [loadedFor, setLoadedFor] = useState('');
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // Keyed by what the drawer is editing, so re-opening on a different item resets
  // the form without an effect and without clobbering in-progress typing.
  const signature = target
    ? `${target.kind}:${'chapter' in target ? (target.chapter?.id ?? 'new') : ''}:${'item' in target ? (target.item?.id ?? 'new') : ''}:${'chapterId' in target ? target.chapterId : ''}:${'capstone' in target ? 'capstone' : ''}`
    : '';

  if (open && target && signature !== loadedFor) {
    setLoadedFor(signature);
    setAdvanced(false);
    // Set here (during render) rather than inside the fetch effect below: the
    // effect only ever flips this back to `false` from within its promise
    // callbacks, never calls it synchronously from the effect body itself.
    setLibraryLoading(
      (target.kind === 'quiz' || target.kind === 'exercise') && Boolean(target.item?.refId),
    );
    // Editing an existing row goes straight to the form; adding a new one opens on
    // "Use existing", because reusing authored content is usually the better move.
    const isEditing =
      ('item' in target && Boolean(target.item)) ||
      ('chapter' in target && Boolean(target.chapter));
    setMode(isEditing ? 'new' : 'existing');
    if (target.kind === 'chapter') {
      setState({
        title: target.chapter?.title ?? '',
        summary: target.chapter?.summary ?? '',
        description: target.chapter?.description ?? '',
        type: target.chapter?.type ?? 'MIXED',
        isPremium: target.chapter?.isPremium ?? true,
        slug: target.chapter?.slug ?? '',
        banner: target.chapter?.banner ?? '',
      });
    } else if (target.kind === 'video') {
      setState({
        title: target.item?.title ?? '',
        video: target.item?.video ?? '',
        duration: Number(target.item?.duration ?? 0),
        summary: target.item?.summary ?? '',
        description: target.item?.description ?? '',
        isPremium: target.item?.isPremium ?? true,
        slug: target.item?.slug ?? '',
        difficulty: target.item?.difficulty ?? 'Beginner',
        day: target.item?.day ?? 1,
        mb: target.item?.mb ?? 5,
        technologies: target.item?.technologies ?? [],
      });
    } else if (target.kind === 'article') {
      const existing = parseBlocks(target.item?.blocks);
      setState({
        title: target.item?.title ?? '',
        // An article written before blocks existed opens as one prose block, so
        // editing it does not silently discard its body.
        blocks:
          existing.length || !target.item?.content
            ? existing
            : ([{ type: 'html', html: target.item.content }] as ArticleBlock[]),
        content: target.item?.content ?? '',
        excerpt: target.item?.excerpt ?? '',
        readingTime: target.item?.readingTime ?? 5,
        isPremium: target.item?.isPremium ?? true,
        slug: target.item?.slug ?? '',
        tags: target.item?.tags ?? [],
        categories: target.item?.categories ?? [],
        featured_image: target.item?.featured_image ?? '',
        image: (target.item as { image?: string } | undefined)?.image ?? '',
        color: target.item?.color ?? '',
        type: target.item?.type ?? 'ARTICLE',
        is_public: target.item?.is_public ?? false,
        is_locked: target.item?.is_locked ?? false,
      });
    } else if (target.kind === 'quiz') {
      setState({
        // Editing an attachment: seed the title from the chapter's item summary
        // so the drawer isn't blank while the full library row loads below.
        title: target.item?.title ?? '',
        description: '',
        passingScore: 60,
        timeLimit: 15,
        maxAttempts: 5,
        difficulty: 'Easy',
        questions: [{ prompt: '', options: ['', '', '', ''], answer: -1 }],
        existingId: '',
      });
    } else if (target.kind === 'exercise') {
      setState({
        title: target.item?.title ?? '',
        description: '',
        instructions: '',
        solution: '',
        starterCode: '',
        hint: '',
        languages: [],
        graderType: 'OUTPUT_MATCH',
        graderConfig: {},
        testCases: [{ input: '', expectedOutput: '' }],
        points: 10,
        passMark: 60,
        difficulty: 'Easy',
        existingId: '',
      });
    }
  }

  // A chapter's item list only carries a quiz/exercise's title/meta summary —
  // editing needs the full shared library row, fetched by `refId` (the
  // quiz/exercise's own id). Never `item.id` here: that's the QuizCourse /
  // ExerciseCourse join row id, which is what reorder/attach/detach use, and
  // fetching/updating the library row with it would 404 (or silently touch
  // the wrong row if some other join happened to share that id).
  useEffect(() => {
    if (!open || !target) return;
    if (target.kind !== 'quiz' && target.kind !== 'exercise') return;
    if (!('item' in target) || !target.item) return;
    const kind = target.kind;
    const refId = target.item.refId;
    if (!refId) return;

    // `libraryLoading` is already `true` here — set during render, above,
    // the moment the drawer opened on this target.
    let cancelled = false;
    const request = kind === 'quiz' ? fetchQuizDetail(refId) : fetchExerciseDetail(refId);
    request
      .then((row: Record<string, unknown>) => {
        if (cancelled) return;
        if (kind === 'quiz') {
          setState((current) => ({
            ...current,
            title: String(row.title ?? current.title ?? ''),
            description: String(row.description ?? ''),
            passingScore: Number(row.passingScore ?? 60),
            timeLimit: Number(row.timeLimit ?? 15),
            maxAttempts: Number(row.maxAttempts ?? 5),
            difficulty: row.difficulty ?? 'Easy',
            questions: fromApiQuestions((row.questions as never) ?? []),
          }));
        } else {
          setState((current) => ({
            ...current,
            title: String(row.title ?? current.title ?? ''),
            description: String(row.description ?? ''),
            instructions: String(row.instructions ?? ''),
            solution: String(row.solution ?? ''),
            starterCode: String(row.starterCode ?? ''),
            hint: String(row.hint ?? ''),
            // Stored as executor codes ("java"); the picker and its checkbox
            // labels are display names ("Java") — mapped back here, the one
            // place the exercise payload/load path crosses that boundary.
            languages: ((row.languages as string[]) ?? []).map(toDisplayName),
            graderType: row.graderType ?? 'OUTPUT_MATCH',
            graderConfig: (row.graderConfig as GraderConfig) ?? {},
            testCases: (row.testCases as never) ?? [{ input: '', expectedOutput: '' }],
            points: Number(row.points ?? 10),
            passMark: Number(row.passMark ?? 60),
            difficulty: row.difficulty ?? 'Easy',
          }));
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (error as Error).message;
        toast.error('Could not load the shared item', { description: message });
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-runs only when the drawer opens on a different target — `signature`
    // already captures the item id, so it stands in for `target` itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signature]);

  if (!target) return null;

  const patch = (next: State) => setState((current) => ({ ...current, ...next }));
  const str = (key: string) => String(state[key] ?? '');
  const num = (key: string) => Number(state[key] ?? 0);

  const missing = (): string[] => {
    if (target.kind === 'chapter') return str('title') ? [] : ['title'];
    if (target.kind === 'video') {
      const gaps: string[] = [];
      if (!str('title')) gaps.push('title');
      if (!str('video')) gaps.push('video source');
      if (!(num('duration') > 0)) gaps.push('duration');
      return gaps;
    }
    if (target.kind === 'article') return missingFor('article', state);
    if (target.kind === 'quiz') {
      if (state.existingId) return [];
      const gaps: string[] = [];
      if (!str('title')) gaps.push('title');
      if (!str('description')) gaps.push('description');
      const questionGap = questionGaps((state.questions as DraftQuestion[]) ?? []);
      if (questionGap) gaps.push(questionGap);
      return gaps;
    }
    if (state.existingId) return [];
    const testCases = (state.testCases as TestCaseDraft[]) ?? [];
    const gaps: string[] = [];
    if (!str('title')) gaps.push('title');
    if (!str('description')) gaps.push('description');
    if (!str('instructions')) gaps.push('instructions');
    const languages = ((state.languages as string[]) ?? []).map(toExecutorCode);
    if (!languages.length) gaps.push('a language');
    if (!testCases.some((testCase) => testCase.expectedOutput)) {
      gaps.push('one test case with output');
    }
    if (!str('solution')) gaps.push('reference solution');
    const graderConfig = (state.graderConfig as GraderConfig) ?? {};
    if (state.graderType === 'FUNCTION_CALL') {
      if (!graderConfig.entry) gaps.push('a function name');
      if (
        languages.some((language) => STATIC_LANGUAGES.includes(language)) &&
        !graderConfig.signature
      ) {
        gaps.push('a typed signature');
      }
      // A case left over from switching grader types without ever
      // committing an edit would otherwise carry no `args` key at all —
      // `undefined !== []`, so this is not the same gap as "empty args".
      if (testCases.some((testCase) => !('args' in testCase) || testCase.args === undefined)) {
        gaps.push('arguments on every test case');
      }
    }
    if (state.graderType === 'TEST_CASES' && !graderConfig.testFile) gaps.push('a test file');
    // Set by `CaseEditor`'s `onInvalidChange` while the author has unparseable
    // JSON typed into an Arguments field — the draft is kept on-screen (and
    // the prior committed `args` left untouched) rather than silently
    // replaced, so this is the only way the drawer itself can see it.
    if (Boolean(state.testCasesInvalid)) gaps.push('valid JSON arguments');
    return gaps;
  };

  /** Picking from the library: attach the row, or copy it, per its `reuse` flag. */
  const reuse = async (row: { id: string; title: string; reuse: 'attach' | 'copy' }) => {
    setBusy(true);
    try {
      if (target.kind === 'chapter') {
        const created = await copyChapter(courseId, row.id, true);
        toast.success(`Copied “${row.title}”`, {
          description: `${created.copiedItems} item(s) duplicated into this course.`,
        });
      } else if (target.kind === 'quiz') {
        await attachQuiz(courseId, {
          quizId: row.id,
          chapterId: (target as { chapterId: string }).chapterId,
        });
        toast.success(`Attached “${row.title}” — the library copy is untouched.`);
      } else if (target.kind === 'exercise') {
        await attachExercise(courseId, {
          exerciseId: row.id,
          chapterId: (target as { chapterId: string }).chapterId,
        });
        toast.success(`Attached “${row.title}” — the library copy is untouched.`);
      } else if (capstone) {
        await addCapstoneMedia(courseId, kind as 'video' | 'article', { id: row.id });
        toast.success(`Attached “${row.title}” to the capstone.`);
      } else {
        await copyItem(courseId, chapterId, kind as 'video' | 'article', row.id);
        toast.success(`Copied “${row.title}” into this chapter.`);
      }
      onSaved();
      onClose();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (error as Error).message;
      toast.error('Could not reuse that', { description: message });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (target.kind === 'chapter') {
        if (!str('title')) throw new Error('A chapter needs a title.');
        const payload = {
          title: str('title'),
          summary: str('summary'),
          description: str('description'),
          type: state.type as ChapterType,
          isPremium: Boolean(state.isPremium),
          banner: str('banner') || null,
          ...(str('slug') ? { slug: str('slug') } : {}),
        };
        if (target.chapter) await updateChapter(courseId, target.chapter.id, payload);
        else await createChapter(courseId, payload);
      } else if (target.kind === 'video') {
        const payload = {
          title: str('title'),
          video: str('video'),
          duration: num('duration'),
          summary: str('summary'),
          description: str('description'),
          isPremium: Boolean(state.isPremium),
          difficulty: state.difficulty as 'Beginner' | 'Intermediate' | 'Advanced',
          day: num('day'),
          mb: num('mb'),
          technologies: (state.technologies as string[]) ?? [],
          ...(str('slug') ? { slug: str('slug') } : {}),
        };
        if (capstone) await addCapstoneMedia(courseId, 'video', { create: payload });
        else if (target.item) await updateVideo(courseId, chapterId, target.item.id, payload);
        else await createVideo(courseId, chapterId, payload);
      } else if (target.kind === 'article') {
        const blocks = (state.blocks as ArticleBlock[]) ?? [];
        const payload = {
          title: str('title'),
          ...(blocks.length
            ? { blocks, content: blocksToContent(blocks) }
            : { content: str('content') }),
          excerpt: str('excerpt'),
          readingTime: num('readingTime'),
          isPremium: Boolean(state.isPremium),
          tags: (state.tags as string[]) ?? [],
          categories: (state.categories as string[]) ?? [],
          featured_image: str('featured_image') || null,
          image: str('image') || null,
          color: str('color') || null,
          type: str('type') || 'ARTICLE',
          is_public: Boolean(state.is_public),
          is_locked: Boolean(state.is_locked),
          ...(str('slug') ? { slug: str('slug') } : {}),
        };
        if (capstone) await addCapstoneMedia(courseId, 'article', { create: payload });
        else if (target.item) await updateArticle(courseId, chapterId, target.item.id, payload);
        else await createArticle(courseId, chapterId, payload);
      } else if (target.kind === 'quiz') {
        if (target.item) {
          // Editing an attachment updates the shared library row itself, by
          // its OWN id (`refId`) — never `target.item.id`, which is the
          // QuizCourse join row this chapter attaches through. This reaches
          // every course/chapter the quiz is attached to, not just this one.
          const quizId = target.item.refId;
          if (!quizId) throw new Error('Missing the shared quiz id.');
          await updateQuizLibrary(quizId, {
            title: str('title'),
            description: str('description'),
            passingScore: num('passingScore'),
            timeLimit: num('timeLimit'),
            maxAttempts: num('maxAttempts'),
            difficulty: state.difficulty,
            questions: toApiQuestions(state.questions as DraftQuestion[]),
          });
        } else {
          let quizId = str('existingId');
          if (!quizId) {
            const { data } = await axiosInstance.post('/quizzes', {
              title: str('title'),
              description: str('description'),
              passingScore: num('passingScore'),
              timeLimit: num('timeLimit'),
              maxAttempts: num('maxAttempts'),
              difficulty: state.difficulty,
              // The editor holds indexes; the API stores the correct option as text.
              questions: toApiQuestions(state.questions as DraftQuestion[]),
            });
            quizId = data?.data?.id ?? data?.id;
          }
          if (!quizId) throw new Error('The quiz was not created.');
          await attachQuiz(courseId, { quizId, chapterId });
        }
      } else {
        if (target.item) {
          // Same rule as quizzes above: PUT by `refId` (the Exercise row's own
          // id), not `target.item.id` (the ExerciseCourse join row).
          const exerciseId = target.item.refId;
          if (!exerciseId) throw new Error('Missing the shared exercise id.');
          await updateExerciseLibrary(exerciseId, {
            title: str('title'),
            description: str('description'),
            instructions: str('instructions'),
            solution: str('solution'),
            starterCode: str('starterCode'),
            hint: str('hint') || 'No hint provided.',
            // The API stores/grades against executor codes ("java"), not the
            // picker's display names ("Java").
            languages: ((state.languages as string[]) ?? []).map(toExecutorCode),
            graderType: state.graderType,
            graderConfig: state.graderConfig,
            testCases: state.testCases,
            points: num('points'),
            passMark: num('passMark'),
            difficulty: state.difficulty,
          });
        } else {
          let exerciseId = str('existingId');
          if (!exerciseId) {
            const { data } = await axiosInstance.post('/exercises', {
              title: str('title'),
              description: str('description'),
              instructions: str('instructions'),
              solution: str('solution'),
              starterCode: str('starterCode'),
              hint: str('hint') || 'No hint provided.',
              languages: ((state.languages as string[]) ?? []).map(toExecutorCode),
              graderType: state.graderType,
              graderConfig: state.graderConfig,
              testCases: state.testCases,
              points: num('points'),
              passMark: num('passMark'),
              difficulty: state.difficulty,
            });
            exerciseId = data?.data?.id ?? data?.id;
          }
          if (!exerciseId) throw new Error('The exercise was not created.');
          await attachExercise(courseId, { exerciseId, chapterId });
        }
      }

      toast.success('Saved.');
      onSaved();
      onClose();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (error as Error).message;
      toast.error('Could not save', { description: message });
    } finally {
      setBusy(false);
    }
  };

  const kind = target.kind as ItemKind;
  const capstone = 'capstone' in target && target.capstone === true;
  const chapterId = 'chapterId' in target ? target.chapterId : '';
  const owned = ITEM_OWNED[kind] ?? true;
  // Chapters count too. Without them, opening Edit on a chapter still offered
  // "Use existing", which would copy another chapter in rather than edit this one.
  // Kept in step with the isEditing check that picks the opening tab above.
  const editing =
    ('item' in target && Boolean(target.item)) || ('chapter' in target && Boolean(target.chapter));
  const gaps = missing();
  const heading =
    target.kind === 'chapter'
      ? target.chapter
        ? 'Edit chapter'
        : 'New chapter'
      : `${'item' in target && target.item ? 'Edit' : 'New'} ${target.kind}`;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle className="capitalize">{heading}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!editing ? (
            <div className="flex gap-1 border-b border-border">
              {(['existing', 'new'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setMode(option);
                    if (option === 'new') patch({ existingId: '' });
                  }}
                  className={cn(
                    'border-b-2 px-3 py-2 text-sm transition-colors',
                    mode === option
                      ? 'border-primary font-semibold text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option === 'existing' ? 'Use existing' : 'Create new'}
                </button>
              ))}
            </div>
          ) : null}

          {editing || mode === 'new' ? (
            <p className="text-xs text-muted-foreground">
              {target.kind === 'chapter'
                ? 'Chapters belong to one course.'
                : capstone
                  ? `Authored for the course, not a chapter — learners meet it after the last one.`
                  : owned
                    ? `Saved straight into this chapter — ${ITEM_LABELS[kind].toLowerCase()}s cannot exist without one.`
                    : `Created in the ${kind} library, then attached here. Detaching later leaves it in the library.`}
            </p>
          ) : null}

          {editing && !owned ? (
            <p className="rounded-md bg-warning-wash px-3 py-2 text-xs text-warning">
              <strong>Editing shared content.</strong> This is the library {kind}, not a copy —
              saving changes it in every course and chapter it is attached to, not just this one.
            </p>
          ) : null}

          {!editing && mode === 'existing' ? (
            <LibraryPicker
              kind={target.kind === 'chapter' ? 'chapter' : kind}
              excludeCourseId={target.kind === 'chapter' || capstone ? courseId : undefined}
              // Into a chapter this copies; into the capstone it attaches, because
              // the row keeps living where it already does.
              reuseAs={capstone ? 'attach' : undefined}
              busy={busy}
              onPick={reuse}
            />
          ) : null}

          {editing || mode === 'new' ? (
            <>
              {/* Items only. A chapter is four short fields — a JSON box would
                  cost more to read than the form it fills. `patch` merges, so
                  the panel's partial patch leaves every other field alone. */}
              {target.kind !== 'chapter' ? (
                <JsonFillPanel kind={kind} onFill={patch} disabled={busy} />
              ) : null}

              <Field label="Title" required>
                <Input value={str('title')} onChange={(e) => patch({ title: e.target.value })} />
              </Field>

              {target.kind === 'chapter' ? (
                <>
                  <Field label="Summary">
                    <Input
                      value={str('summary')}
                      onChange={(e) => patch({ summary: e.target.value })}
                    />
                  </Field>
                  <Field label="Chapter type">
                    <Select value={str('type')} onValueChange={(value) => patch({ type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHAPTER_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Toggle
                    label="Locked (premium)"
                    hint="Off makes the whole chapter a free preview."
                    checked={Boolean(state.isPremium)}
                    onChange={(isPremium) => patch({ isPremium })}
                  />
                  <RichTextField
                    label="Description"
                    value={str('description')}
                    onChange={(description) => patch({ description })}
                  />
                </>
              ) : null}

              {target.kind === 'video' ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Video source" required>
                      <Input
                        value={str('video')}
                        placeholder="Vimeo ID or URL"
                        onChange={(e) => patch({ video: e.target.value })}
                      />
                    </Field>
                    <Field label="Duration (seconds)" required>
                      <Input
                        type="number"
                        min={0}
                        value={num('duration')}
                        onChange={(e) => patch({ duration: Number(e.target.value) })}
                      />
                    </Field>
                  </div>
                  <Field label="Summary">
                    <Input
                      value={str('summary')}
                      onChange={(e) => patch({ summary: e.target.value })}
                    />
                  </Field>
                  <Toggle
                    label="Locked (premium)"
                    checked={Boolean(state.isPremium)}
                    onChange={(isPremium) => patch({ isPremium })}
                  />
                  <RichTextField
                    label="Description"
                    value={str('description')}
                    onChange={(description) => patch({ description })}
                  />
                </>
              ) : null}

              {target.kind === 'article' ? (
                <>
                  <BlockEditor
                    blocks={(state.blocks as ArticleBlock[]) ?? []}
                    onChange={(blocks) =>
                      // The prose fallback is derived, never typed — it cannot
                      // drift from the blocks that replaced it.
                      patch({ blocks, content: blocksToContent(blocks) })
                    }
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Excerpt">
                      <Input
                        value={str('excerpt')}
                        onChange={(e) => patch({ excerpt: e.target.value })}
                      />
                    </Field>
                    <Field label="Reading time (min)">
                      <Input
                        type="number"
                        min={0}
                        value={num('readingTime')}
                        onChange={(e) => patch({ readingTime: Number(e.target.value) })}
                      />
                    </Field>
                  </div>
                  <Toggle
                    label="Locked (premium)"
                    checked={Boolean(state.isPremium)}
                    onChange={(isPremium) => patch({ isPremium })}
                  />
                </>
              ) : null}

              {target.kind === 'quiz' ? (
                <>
                  <Field label="Description" required>
                    <Input
                      value={str('description')}
                      onChange={(e) => patch({ description: e.target.value })}
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Pass score (%)">
                      <Input
                        type="number"
                        value={num('passingScore')}
                        onChange={(e) => patch({ passingScore: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Time limit (min)">
                      <Input
                        type="number"
                        value={num('timeLimit')}
                        onChange={(e) => patch({ timeLimit: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Difficulty">
                      <Select
                        value={str('difficulty')}
                        onValueChange={(value) => patch({ difficulty: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIFFICULTY.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <QuestionBuilder
                    questions={
                      (state.questions as Array<{
                        prompt: string;
                        options: string[];
                        answer: number;
                      }>) ?? []
                    }
                    onChange={(questions) => patch({ questions })}
                  />
                </>
              ) : null}

              {target.kind === 'exercise' ? (
                <>
                  <Field label="Description" required>
                    <Input
                      value={str('description')}
                      onChange={(e) => patch({ description: e.target.value })}
                    />
                  </Field>
                  <RichTextField
                    label="Instructions"
                    required
                    value={str('instructions')}
                    onChange={(instructions) => patch({ instructions })}
                  />
                  <Field label="Languages" required>
                    <LanguageMultiSelect
                      value={(state.languages as string[]) ?? []}
                      onChange={(languages) => patch({ languages })}
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Grader">
                      <Select
                        value={str('graderType')}
                        onValueChange={(graderType) =>
                          // A grader switch changes what shape a test case
                          // needs (FUNCTION_CALL grades args/expectedOutput,
                          // everything else grades input/expectedOutput) and
                          // what graderConfig keys are even valid — migrate
                          // both in the same patch so the drawer is never
                          // showing a config for one grader while state holds
                          // fields for another.
                          patch({
                            graderType,
                            testCases: migrateTestCases(
                              (state.testCases as TestCaseDraft[]) ?? [],
                              graderType,
                            ),
                            graderConfig: pruneGraderConfig(
                              (state.graderConfig as GraderConfig) ?? {},
                              graderType,
                            ),
                            testCasesInvalid: false,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GRADERS.map((grader) => (
                            <SelectItem key={grader} value={grader}>
                              {grader}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <GraderConfigEditor
                    graderType={str('graderType')}
                    languages={((state.languages as string[]) ?? []).map(toExecutorCode)}
                    value={(state.graderConfig as GraderConfig) ?? {}}
                    onChange={(graderConfig) => patch({ graderConfig })}
                  />
                  <CaseEditor
                    mode={str('graderType') === 'FUNCTION_CALL' ? 'args' : 'stdin'}
                    cases={(state.testCases as TestCaseDraft[]) ?? []}
                    onChange={(testCases) => patch({ testCases })}
                    onInvalidChange={(testCasesInvalid) => patch({ testCasesInvalid })}
                  />
                  <Field label="Reference solution" required>
                    <CodeArea
                      value={str('solution')}
                      ariaLabel="Reference solution"
                      onChange={(solution) => patch({ solution })}
                    />
                  </Field>
                  <Field label="Starter code">
                    <CodeArea
                      value={str('starterCode')}
                      ariaLabel="Starter code"
                      minHeight={100}
                      placeholder="What the learner opens with"
                      onChange={(starterCode) => patch({ starterCode })}
                    />
                  </Field>
                </>
              ) : null}

              <details
                open={advanced}
                onToggle={(event) => setAdvanced((event.target as HTMLDetailsElement).open)}
                className="rounded-md border border-border bg-muted/40 p-3"
              >
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                  Advanced fields
                </summary>
                <div className="mt-3 space-y-3">
                  <Field label="Slug">
                    <Input
                      value={str('slug')}
                      placeholder="auto from title"
                      onChange={(e) => patch({ slug: e.target.value })}
                    />
                  </Field>
                  {target.kind === 'video' ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Day">
                        <Input
                          type="number"
                          value={num('day')}
                          onChange={(e) => patch({ day: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label="Points (mb)">
                        <Input
                          type="number"
                          value={num('mb')}
                          onChange={(e) => patch({ mb: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label="Technologies">
                        <TagInput
                          value={(state.technologies as string[]) ?? []}
                          onChange={(technologies) => patch({ technologies })}
                        />
                      </Field>
                    </div>
                  ) : null}
                  {target.kind === 'article' ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Article type">
                          <Select
                            value={str('type') || 'ARTICLE'}
                            onValueChange={(value) => patch({ type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ARTICLE_TYPES.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Accent colour">
                          <div className="flex gap-2">
                            <Input
                              value={str('color')}
                              placeholder="#13aece"
                              // Stored as a bare six-digit triplet — the column is
                              // char(6), so the API strips the hash and adds it back.
                              onChange={(e) => patch({ color: e.target.value })}
                            />
                            <input
                              type="color"
                              aria-label="Pick accent colour"
                              value={
                                /^#[0-9a-fA-F]{6}$/.test(str('color')) ? str('color') : '#13aece'
                              }
                              onChange={(e) => patch({ color: e.target.value })}
                              className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                            />
                          </div>
                        </Field>
                      </div>

                      <Field label="Featured image">
                        <Input
                          value={str('featured_image')}
                          placeholder="https://cdn.masteringbackend.com/…"
                          onChange={(e) => patch({ featured_image: e.target.value })}
                        />
                      </Field>
                      <Field label="Inline image">
                        <Input
                          value={str('image')}
                          placeholder="Shown inside the article header"
                          onChange={(e) => patch({ image: e.target.value })}
                        />
                      </Field>

                      <Field label="Tags">
                        <TagInput
                          value={(state.tags as string[]) ?? []}
                          onChange={(tags) => patch({ tags })}
                        />
                      </Field>
                      <Field label="Categories">
                        <TagInput
                          value={(state.categories as string[]) ?? []}
                          onChange={(categories) => patch({ categories })}
                        />
                      </Field>

                      <Toggle
                        label="Readable outside the course"
                        hint="Publishes the article on its own URL as well as in the chapter."
                        checked={Boolean(state.is_public)}
                        onChange={(is_public) => patch({ is_public })}
                      />
                      <Toggle
                        label="Locked until the previous step"
                        hint="Learners must finish what comes before it."
                        checked={Boolean(state.is_locked)}
                        onChange={(is_locked) => patch({ is_locked })}
                      />
                    </div>
                  ) : null}

                  {target.kind === 'exercise' ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Points">
                        <Input
                          type="number"
                          value={num('points')}
                          onChange={(e) => patch({ points: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label="Pass mark (%)">
                        <Input
                          type="number"
                          value={num('passMark')}
                          onChange={(e) => patch({ passMark: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label="Hint">
                        <Input
                          value={str('hint')}
                          onChange={(e) => patch({ hint: e.target.value })}
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
              </details>
            </>
          ) : null}

          {(editing || mode === 'new') && gaps.length ? (
            <p className="rounded-md bg-warning-wash px-3 py-2 text-xs text-warning">
              <strong>Incomplete.</strong> Still needs: {gaps.join(', ')}. It saves either way — the
              course will not publish until it is complete.
            </p>
          ) : editing || mode === 'new' ? (
            <p className="rounded-md bg-success-wash px-3 py-2 text-xs text-success">
              <strong>Complete.</strong> This item is ready.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {editing || mode === 'new' ? (
            <Button variant="outline" onClick={() => setPayloadOpen(true)} disabled={busy}>
              Payload
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {editing || mode === 'new' ? (
            <Button onClick={save} disabled={busy || libraryLoading}>
              {busy
                ? 'Saving…'
                : libraryLoading
                  ? 'Loading…'
                  : target.kind === 'chapter'
                    ? 'Save chapter'
                    : editing
                      ? 'Save item'
                      : capstone
                        ? 'Add to capstone'
                        : 'Add to chapter'}
            </Button>
          ) : null}
        </DialogFooter>

        <PayloadDialog
          open={payloadOpen}
          onClose={() => setPayloadOpen(false)}
          method={editing ? 'PUT' : 'POST'}
          path={
            target.kind === 'chapter'
              ? `/admin/courses/${courseId}/chapters${target.chapter ? `/${target.chapter.id}` : ''}`
              : capstone
                ? `/admin/courses/${courseId}/capstone/${kind}s`
                : owned
                  ? `/admin/courses/${courseId}/chapters/${chapterId}/${kind}s`
                  : `/admin/${kind}s`
          }
          body={state}
        />
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function QuestionBuilder({
  questions,
  onChange,
}: {
  questions: Array<{ prompt: string; options: string[]; answer: number }>;
  onChange: (next: Array<{ prompt: string; options: string[]; answer: number }>) => void;
}) {
  const update = (
    index: number,
    next: Partial<{ prompt: string; options: string[]; answer: number }>,
  ) =>
    onChange(questions.map((question, i) => (i === index ? { ...question, ...next } : question)));

  return (
    <div className="space-y-2">
      <Label>
        Questions <span className="text-destructive">*</span>
      </Label>
      <p className="text-xs text-muted-foreground">
        Mark the correct option on every question. It is saved as that option&apos;s text, which is
        what the learner side grades against.
      </p>
      {questions.map((question, index) => (
        <div key={index} className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <strong>Q{index + 1}</strong>
            <button
              type="button"
              className="hover:text-destructive"
              onClick={() => onChange(questions.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
          <Input
            value={question.prompt}
            placeholder="Question prompt"
            onChange={(event) => update(index, { prompt: event.target.value })}
          />
          {question.options.map((option, optionIndex) => (
            <label key={optionIndex} className="flex items-center gap-2">
              <input
                type="radio"
                name={`answer-${index}`}
                checked={question.answer === optionIndex}
                onChange={() => update(index, { answer: optionIndex })}
                aria-label={`Mark option ${optionIndex + 1} correct`}
              />
              <Input
                value={option}
                placeholder={`Option ${optionIndex + 1}`}
                onChange={(event) =>
                  update(index, {
                    options: question.options.map((existing, i) =>
                      i === optionIndex ? event.target.value : existing,
                    ),
                  })
                }
              />
            </label>
          ))}
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          onChange([...questions, { prompt: '', options: ['', '', '', ''], answer: -1 }])
        }
      >
        + Add question
      </Button>
    </div>
  );
}

export type TestCaseDraft = {
  input?: string;
  args?: unknown[];
  expectedOutput?: unknown;
  description?: string;
  hidden?: boolean;
  weight?: number;
};

/**
 * Switching grader type mid-edit must carry every test case along to the
 * shape the new grader needs: FUNCTION_CALL grades `args`/`expectedOutput`,
 * every other grader grades `input`/`expectedOutput`. Without this, a stdin
 * case switched to FUNCTION_CALL still renders "[]" for Arguments (nothing
 * looks wrong) while state holds no `args` key at all — the gap check would
 * miss it and the API would reject the save.
 */
export function migrateTestCases(cases: TestCaseDraft[], nextGraderType: string): TestCaseDraft[] {
  const toFunctionCall = nextGraderType === 'FUNCTION_CALL';
  return cases.map((testCase) => {
    const shared: Pick<TestCaseDraft, 'description' | 'hidden' | 'weight'> = {};
    if (testCase.description !== undefined) shared.description = testCase.description;
    if (testCase.hidden !== undefined) shared.hidden = testCase.hidden;
    if (testCase.weight !== undefined) shared.weight = testCase.weight;

    if (toFunctionCall) {
      return {
        ...shared,
        args: Array.isArray(testCase.args) ? testCase.args : [],
        expectedOutput: testCase.expectedOutput ?? '',
      };
    }
    return {
      ...shared,
      input: typeof testCase.input === 'string' ? testCase.input : '',
      expectedOutput: testCase.expectedOutput ?? '',
    };
  });
}

/** Parses JSON for the "Arguments (JSON array)" field — must be an array specifically. */
function parseJsonArray(text: string): unknown[] | undefined {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Parses JSON for "Expected (JSON)" — any JSON value, or the raw text if it isn't valid JSON. */
function parseJsonOrRaw(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function CaseEditor({
  cases,
  onChange,
  mode = 'stdin',
  onInvalidChange,
}: {
  cases: TestCaseDraft[];
  onChange: (next: TestCaseDraft[]) => void;
  mode?: 'stdin' | 'args';
  /** Fires whenever any row's Arguments field currently holds unparseable JSON. */
  onInvalidChange?: (invalid: boolean) => void;
}) {
  // Holds what the author is currently typing into the args/expected fields,
  // keyed by row, field AND mode, so an in-progress (possibly invalid) JSON
  // edit isn't clobbered by the committed value re-rendering underneath it.
  // Cleared once a field's text parses and is committed via onChange. Keying
  // by mode too means a round trip through another grader type (this
  // component instance stays mounted across the switch) never resurfaces a
  // stale draft — the freshly migrated `cases` render clean the moment
  // `mode` flips back, because that mode's key never had a draft yet.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const argsKey = (index: number) => `${mode}-args-${index}`;
  const expectedKey = (index: number) => `${mode}-expected-${index}`;
  const setDraft = (key: string, value: string) =>
    setDrafts((current) => ({ ...current, [key]: value }));
  const clearDraft = (key: string) =>
    setDrafts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  const hasInvalidArgs =
    mode === 'args' &&
    cases.some((testCase, index) => {
      const argsText = drafts[argsKey(index)] ?? JSON.stringify(testCase.args ?? []);
      return parseJsonArray(argsText) === undefined;
    });

  useEffect(() => {
    onInvalidChange?.(hasInvalidArgs);
    // Only `hasInvalidArgs` in the deps — `onInvalidChange` is a fresh
    // closure every render (it patches parent state), so depending on it
    // too would refire this on every render the parent re-renders for, not
    // just when the invalid set actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInvalidArgs]);

  return (
    <div className="space-y-2">
      <Label>
        Test cases <span className="text-destructive">*</span>
      </Label>
      <p className="text-xs text-muted-foreground">
        {mode === 'args'
          ? 'Arguments are passed to the function; its return value is compared to Expected.'
          : 'stdin is fed to the entrypoint; stdout is compared to the expected output.'}
      </p>
      {cases.map((testCase, index) => {
        const argsText = drafts[argsKey(index)] ?? JSON.stringify(testCase.args ?? []);
        const expectedText =
          drafts[expectedKey(index)] ??
          (typeof testCase.expectedOutput === 'string'
            ? testCase.expectedOutput
            : JSON.stringify(testCase.expectedOutput ?? ''));
        const argsInvalid = mode === 'args' && parseJsonArray(argsText) === undefined;

        return (
          <div key={index} className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <strong>Case {index + 1}</strong>
              <button
                type="button"
                className="hover:text-destructive"
                onClick={() => onChange(cases.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
            {mode === 'args' ? (
              <>
                <Input
                  value={argsText}
                  placeholder="Arguments (JSON array)"
                  aria-label="Arguments (JSON array)"
                  onChange={(event) => setDraft(argsKey(index), event.target.value)}
                  onBlur={(event) => {
                    const parsed = parseJsonArray(event.target.value);
                    // Invalid JSON commits nothing — the draft (and its red
                    // note) stays on screen, and whatever `args` was
                    // previously committed is left exactly as it was, rather
                    // than being silently overwritten with `[]`.
                    if (parsed === undefined) return;
                    onChange(
                      cases.map((existing, i) =>
                        i === index ? { ...existing, args: parsed } : existing,
                      ),
                    );
                    clearDraft(argsKey(index));
                  }}
                />
                {argsInvalid ? <p className="text-xs text-destructive">Invalid JSON</p> : null}
                <Input
                  value={expectedText}
                  placeholder="Expected (JSON)"
                  aria-label="Expected (JSON)"
                  onChange={(event) => setDraft(expectedKey(index), event.target.value)}
                  onBlur={(event) => {
                    const parsed = parseJsonOrRaw(event.target.value);
                    onChange(
                      cases.map((existing, i) =>
                        i === index ? { ...existing, expectedOutput: parsed } : existing,
                      ),
                    );
                    clearDraft(expectedKey(index));
                  }}
                />
              </>
            ) : (
              <>
                <Input
                  value={testCase.input ?? ''}
                  placeholder="Input (stdin)"
                  onChange={(event) =>
                    onChange(
                      cases.map((existing, i) =>
                        i === index ? { ...existing, input: event.target.value } : existing,
                      ),
                    )
                  }
                />
                <Input
                  value={typeof testCase.expectedOutput === 'string' ? testCase.expectedOutput : ''}
                  placeholder="Expected output"
                  onChange={(event) =>
                    onChange(
                      cases.map((existing, i) =>
                        i === index
                          ? { ...existing, expectedOutput: event.target.value }
                          : existing,
                      ),
                    )
                  }
                />
              </>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          onChange([
            ...cases,
            mode === 'args' ? { args: [], expectedOutput: '' } : { input: '', expectedOutput: '' },
          ])
        }
      >
        + Add test case
      </Button>
    </div>
  );
}
