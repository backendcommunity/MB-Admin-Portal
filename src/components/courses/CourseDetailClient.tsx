'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Pencil, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { Stat, StatRow } from '@/components/shared/Stat';
import { TabBar } from '@/components/shared/TabBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ReadinessPanel } from '@/components/shared/form/ReadinessPanel';
import {
  AccessSection,
  ClassificationSection,
  IdentitySection,
  MediaSection,
  type CourseDraft,
} from '@/components/courses/CourseFormSections';
import ItemDrawer, { type DrawerTarget } from '@/components/courses/ItemDrawer';
import ImportCourseModal from '@/components/courses/ImportCourseModal';
import CapstoneAttachDialog, { type CapstoneKind } from '@/components/courses/CapstoneAttachDialog';
import { PayloadDialog } from '@/components/shared/PayloadDialog';
import { Input } from '@/components/ui/input';
import { itemComplete, itemMissing } from '@/lib/courses/items';
import { useDragReorder, moved } from '@/lib/courses/useDragReorder';
import { GripVertical } from 'lucide-react';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import {
  addCapstoneMedia,
  attachExercise,
  attachQuiz,
  deleteArticle,
  deleteChapter,
  deleteCourse,
  deleteVideo,
  detachExercise,
  detachMockInterview,
  detachProject,
  detachQuiz,
  fetchCategories,
  fetchCourse,
  fetchLearners,
  reorderCapstone,
  reorderChapterItems,
  reorderChapters,
  removeCapstoneMedia,
  setCourseStatus,
  updateCourse,
  updateArticle,
  updateChapter,
  updateMockLink,
  updateProjectLink,
  updateVideo,
  type Category,
  type Chapter,
  type ChapterItem,
  type CourseDetail,
  type Modality,
} from '@/lib/api/courses';
import { evaluateReadiness } from '@/lib/courses/readiness';
import { toast } from 'sonner';

const TABS = [
  ['overview', 'Overview'],
  ['curriculum', 'Curriculum'],
  ['access', 'Access & pricing'],
  ['learners', 'Learners'],
] as const;

type TabId = (typeof TABS)[number][0];

function toDraft(course: CourseDetail): CourseDraft {
  return {
    title: course.title,
    slug: course.slug,
    summary: course.summary ?? '',
    description: course.description ?? '',
    type: course.type,
    categoryId: course.categoryId,
    level: course.level,
    tags: course.tags,
    languages: course.languages,
    isPremium: course.isPremium,
    amount: course.amount,
    paddle_price_id: course.paddle_price_id,
    paddlePlanCode: course.paddlePlanCode,
    banner: course.banner ?? '',
    preview: course.preview,
    vimeoFolderId: course.vimeoFolderId,
    isWaiting: course.isWaiting,
    waitingLink: course.waitingLink,
  };
}

function runtime(seconds: number): string {
  if (!seconds) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function chapterRuntime(chapter: Chapter): number {
  return chapter.items.reduce(
    (total, item) => total + (item.kind === 'video' ? Number(item.duration ?? 0) : 0),
    0,
  );
}

function itemMeta(item: ChapterItem): string {
  if (item.kind === 'video') {
    const seconds = Number(item.duration ?? 0);
    return seconds ? runtime(seconds) : 'no duration';
  }
  if (item.kind === 'article') return `${item.readingTime ?? 0} min read`;
  return item.meta ?? '';
}

export default function CourseDetailClient() {
  const router = useRouter();
  const params = useParams();
  const courseId = String(params?.id ?? '');
  const [tab, setTab] = useState<TabId>('overview');
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirming, setConfirming] = useState<null | {
    kind: 'course' | 'chapter' | 'item';
    id?: string;
    chapterId?: string;
    itemKind?: string;
    label: string;
  }>(null);
  const [saving, setSaving] = useState(false);
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [attaching, setAttaching] = useState<CapstoneKind | null>(null);

  const {
    data: course,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-course', courseId],
    queryFn: () => fetchCourse(courseId),
  });

  // Chapters and each chapter's items are separate ordered lists; the scope string
  // is what stops a drag crossing between them. Declared after the query so it
  // closes over the current render's data.
  const drag = useDragReorder({
    onReorder: async (from, to, scope) => {
      if (!course) return;
      if (scope === 'chapters') {
        const next = moved(course.chapters, from, to);
        await reorderChapters(
          courseId,
          next.map((chapter) => chapter.id),
        );
      } else {
        const chapter = course.chapters.find((row) => row.id === scope);
        if (!chapter) return;
        const owned = chapter.items.filter(
          (item) => item.kind === 'video' || item.kind === 'article',
        );
        const next = moved(owned, from, to);
        await reorderChapterItems(
          courseId,
          chapter.id,
          next.map((item) => item.id),
        );
      }
      await refetch();
    },
  });

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Adjusting state during render (rather than in an effect) is the pattern React
  // recommends for "reset local state when the row changes": no cascading render,
  // and edits in progress survive a background refetch of the same course.
  const [draftFor, setDraftFor] = useState<string | null>(null);
  if (course && draftFor !== course.id) {
    setDraftFor(course.id);
    setDraft(toDraft(course));
  }

  const rules = useMemo(
    () => (course && draft ? evaluateReadiness({ ...draft, chapters: course.chapters }) : []),
    [course, draft],
  );
  const ready = rules.every((rule) => rule.ok);

  if (isLoading) return <LoadingState label="Loading course…" />;
  if (isError || !course || !draft) return <ErrorState onRetry={() => refetch()} />;

  const patch = (next: Partial<CourseDraft>) =>
    setDraft((current) => (current ? { ...current, ...next } : current));

  const save = async () => {
    setSaving(true);
    try {
      await updateCourse(course.id, { ...draft });
      await refetch();
      toast.success('Saved.');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (error as Error).message;
      toast.error('Could not save', { description: message });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (action: 'publish' | 'unpublish' | 'archive' | 'restore') => {
    try {
      await setCourseStatus(course.id, action);
      await refetch();
      toast.success(`${action.charAt(0).toUpperCase()}${action.slice(1)}ed.`);
    } catch (error) {
      const failures = (error as { failures?: Array<{ message: string }> }).failures;
      toast.error('Not ready to publish', {
        description:
          failures?.map((failure) => failure.message).join(' · ') ?? (error as Error).message,
      });
    }
  };

  const moveChapter = async (index: number, direction: -1 | 1) => {
    const next = [...course.chapters];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await reorderChapters(
      course.id,
      next.map((chapter) => chapter.id),
    );
    await refetch();
  };

  const moveItem = async (chapter: Chapter, index: number, direction: -1 | 1) => {
    // Only owned items carry an order column; attached quizzes and exercises
    // render after them and are not part of the sequence.
    const owned = chapter.items.filter((item) => item.kind === 'video' || item.kind === 'article');
    const target = index + direction;
    if (target < 0 || target >= owned.length) return;
    const next = [...owned];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await reorderChapterItems(
      course.id,
      chapter.id,
      next.map((item) => item.id),
    );
    await refetch();
  };

  const capstone = [
    ...course.capstone.projects.map((row) => ({ ...row, kind: 'project' as const })),
    ...course.capstone.mockInterviews.map((row) => ({ ...row, kind: 'mock' as const })),
    ...(course.capstone.quizzes ?? []).map((row) => ({ ...row, kind: 'quiz' as const })),
    ...(course.capstone.exercises ?? []).map((row) => ({ ...row, kind: 'exercise' as const })),
    ...(course.capstone.videos ?? []).map((row) => ({ ...row, kind: 'video' as const })),
    ...(course.capstone.articles ?? []).map((row) => ({ ...row, kind: 'article' as const })),
  ].sort((a, b) => a.order - b.order);

  const sectionProps = {
    draft,
    patch,
    categories,
    courseId: course.id,
    slugLocked: course.isPublic,
    onCategoryCreated: (category: Category) => setCategories((all) => [...all, category]),
  };

  return (
    <div>
      <p className="mb-1 text-sm text-muted-foreground">
        <Link href="/courses" className="text-primary hover:underline">
          Courses
        </Link>{' '}
        / {course.title}
      </p>

      <PageHeader
        title={course.title}
        description={`${course.slug} · updated ${new Date(course.updatedAt).toLocaleDateString()}`}
        actions={
          <>
            <StatusBadge
              label={course.status}
              tone={
                course.status === 'PUBLISHED'
                  ? 'success'
                  : course.status === 'DRAFT'
                    ? 'neutral'
                    : 'warning'
              }
            />
            {course.archivedAt ? (
              <Button variant="outline" onClick={() => changeStatus('restore')}>
                Restore
              </Button>
            ) : course.isPublic ? (
              <Button variant="outline" onClick={() => changeStatus('unpublish')}>
                Unpublish
              </Button>
            ) : (
              <Button onClick={() => changeStatus('publish')} disabled={!ready}>
                Publish
              </Button>
            )}
            <Button variant="outline" onClick={() => changeStatus('archive')}>
              Archive
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirming({ kind: 'course', label: course.title })}
            >
              Delete
            </Button>
          </>
        }
      />

      <StatRow>
        <Stat label="enrolled" value={course.stats.enrolled.toLocaleString()} />
        <Stat label="completion" value={`${course.stats.completionRate}%`} />
        <Stat label="chapters" value={String(course.counts.chapters)} />
        <Stat label="items" value={String(course.counts.items)} />
        <Stat label="runtime" value={runtime(course.totalDuration)} />
      </StatRow>

      <TabBar tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <IdentitySection {...sectionProps} />
            <ClassificationSection {...sectionProps} />
            <MediaSection {...sectionProps} />
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <ReadinessPanel rules={rules} />
          </aside>
        </div>
      ) : null}

      {tab === 'access' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <AccessSection {...sectionProps} />
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <ReadinessPanel rules={rules} />
          </aside>
        </div>
      ) : null}

      {tab === 'curriculum' ? (
        <div className="space-y-3">
          {course.chapters.length === 0 ? (
            <EmptyState
              title="No chapters yet"
              description="A course needs one chapter with a video or article before it can publish."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setDrawer({ kind: 'chapter' })}>
                    + Add the first chapter
                  </Button>
                  <Button variant="outline" onClick={() => setImportOpen(true)}>
                    Import chapters JSON
                  </Button>
                </div>
              }
            />
          ) : (
            course.chapters.map((chapter, chapterIndex) => {
              const owned = chapter.items.filter(
                (item) => item.kind === 'video' || item.kind === 'article',
              );
              return (
                <Card
                  key={chapter.id}
                  {...drag.handlers(chapterIndex, 'chapters')}
                  className="overflow-hidden p-0 data-[dragging=true]:opacity-50 data-[dragover=true]:border-primary data-[dragover=true]:ring-2 data-[dragover=true]:ring-primary/30"
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                    <GripVertical
                      className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                      aria-hidden
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Chapter {chapterIndex + 1}
                    </span>
                    <Input
                      // Inline rename for the common edit; everything else lives
                      // behind Edit. Committing on blur keeps it a single request.
                      defaultValue={chapter.title}
                      aria-label="Chapter title"
                      className="h-8 flex-1 border-transparent bg-transparent px-1.5 text-sm font-semibold shadow-none hover:border-border focus:border-ring"
                      onBlur={async (event) => {
                        const next = event.target.value.trim();
                        if (!next || next === chapter.title) return;
                        await updateChapter(course.id, chapter.id, { title: next });
                        await refetch();
                      }}
                      // Enter is the natural way to finish a rename; without this
                      // it does nothing and the edit is lost on the next click.
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          event.currentTarget.blur();
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          event.currentTarget.value = chapter.title;
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {chapter.items.length} items · {runtime(chapterRuntime(chapter))}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch
                        checked={!chapter.isPremium}
                        onCheckedChange={async (free) => {
                          await import('@/lib/api/courses').then(({ updateChapter }) =>
                            updateChapter(course.id, chapter.id, { isPremium: !free }),
                          );
                          await refetch();
                        }}
                        aria-label="Free preview chapter"
                      />
                      free
                    </label>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Move chapter up"
                      disabled={chapterIndex === 0}
                      onClick={() => moveChapter(chapterIndex, -1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Move chapter down"
                      disabled={chapterIndex === course.chapters.length - 1}
                      onClick={() => moveChapter(chapterIndex, 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDrawer({ kind: 'chapter', chapter })}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete chapter"
                      onClick={() =>
                        setConfirming({ kind: 'chapter', id: chapter.id, label: chapter.title })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1.5 px-3 py-3">
                    {chapter.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Empty chapter — add a video or article.
                      </p>
                    ) : (
                      chapter.items.map((item) => {
                        const ownedIndex = owned.findIndex((candidate) => candidate.id === item.id);
                        const isOwned = ownedIndex !== -1;
                        return (
                          <div
                            key={item.id}
                            {...(isOwned ? drag.handlers(ownedIndex, chapter.id) : {})}
                            className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm data-[dragging=true]:opacity-50 data-[dragover=true]:border-primary"
                          >
                            {isOwned ? (
                              <GripVertical
                                className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                                aria-hidden
                              />
                            ) : null}
                            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {item.kind}
                            </span>
                            {isOwned ? (
                              <Input
                                defaultValue={item.title}
                                aria-label="Item title"
                                className="h-7 flex-1 border-transparent bg-transparent px-1.5 text-sm shadow-none hover:border-border focus:border-ring"
                                onBlur={async (event) => {
                                  const next = event.target.value.trim();
                                  if (!next || next === item.title) return;
                                  if (item.kind === 'video') {
                                    await updateVideo(course.id, chapter.id, item.id, {
                                      title: next,
                                    });
                                  } else {
                                    await updateArticle(course.id, chapter.id, item.id, {
                                      title: next,
                                    });
                                  }
                                  await refetch();
                                }}
                                // Committing on blur alone silently loses the edit
                                // for anyone who types a name and presses Enter.
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    event.currentTarget.blur();
                                  } else if (event.key === 'Escape') {
                                    event.preventDefault();
                                    event.currentTarget.value = item.title;
                                    event.currentTarget.blur();
                                  }
                                }}
                              />
                            ) : (
                              <span className="min-w-0 flex-1 truncate">{item.title}</span>
                            )}
                            {itemComplete(item) ? null : (
                              <span
                                title={`Missing: ${itemMissing(item).join(', ')}`}
                                className="rounded bg-warning-wash px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning"
                              >
                                incomplete
                              </span>
                            )}
                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                              {itemMeta(item)}
                            </span>
                            {isOwned ? (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Move item up"
                                  disabled={ownedIndex === 0}
                                  onClick={() => moveItem(chapter, ownedIndex, -1)}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Move item down"
                                  disabled={ownedIndex === owned.length - 1}
                                  onClick={() => moveItem(chapter, ownedIndex, 1)}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setDrawer({
                                      kind: item.kind as 'video' | 'article',
                                      chapterId: chapter.id,
                                      item,
                                    })
                                  }
                                >
                                  Edit
                                </Button>
                              </>
                            ) : null}
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Remove ${item.title}`}
                              onClick={() =>
                                setConfirming({
                                  kind: 'item',
                                  id: item.refId ?? item.id,
                                  chapterId: chapter.id,
                                  itemKind: item.kind,
                                  label: item.title,
                                })
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {(['video', 'article', 'quiz', 'exercise'] as const).map((kind) => (
                        <Button
                          key={kind}
                          size="sm"
                          variant="outline"
                          onClick={() => setDrawer({ kind, chapterId: chapter.id })}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          {kind}
                        </Button>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })
          )}

          {course.chapters.length ? (
            <Card className="space-y-2 border-dashed p-4">
              <div className="flex items-center gap-2">
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  capstone
                </span>
                <strong className="text-sm">After the last chapter</strong>
              </div>
              <p className="text-xs text-muted-foreground">
                What learners meet once the chapters are done — projects, mock interviews, quizzes
                and exercises attached to the whole course rather than to one chapter. They appear
                in the order below.
              </p>
              {capstone.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nothing yet — a course can ship without a capstone.
                </p>
              ) : (
                capstone.map((link, index) => (
                  <div
                    key={`${link.kind}-${link.id}`}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm"
                  >
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {link.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {link.title}
                      {'meta' in link && link.meta ? (
                        <span className="ml-2 text-xs text-muted-foreground">{link.meta}</span>
                      ) : null}
                    </span>
                    {link.kind === 'mock' ? (
                      <Select
                        value={(link as { type: Modality }).type}
                        onValueChange={async (value) => {
                          await updateMockLink(course.id, link.id, { type: value as Modality });
                          await refetch();
                        }}
                      >
                        <SelectTrigger className="h-8 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(['CHAT', 'AUDIO', 'VIDEO'] as Modality[]).map((modality) => (
                            <SelectItem key={modality} value={modality}>
                              {modality.toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch
                        checked={link.isOptional}
                        aria-label="Optional step"
                        onCheckedChange={async (isOptional) => {
                          if (link.kind === 'project') {
                            await updateProjectLink(course.id, link.id, { isOptional });
                          } else if (link.kind === 'mock') {
                            await updateMockLink(course.id, link.id, { isOptional });
                          } else if (link.kind === 'video' || link.kind === 'article') {
                            await addCapstoneMedia(course.id, link.kind, {
                              id: link.id,
                              isOptional,
                            });
                          } else {
                            // The quiz/exercise join stores `required`, so the
                            // capstone's "optional" is its inverse.
                            const attach = link.kind === 'quiz' ? attachQuiz : attachExercise;
                            await attach(course.id, {
                              ...(link.kind === 'quiz'
                                ? { quizId: link.id }
                                : { exerciseId: link.id }),
                              required: !isOptional,
                              order: link.order,
                            } as never);
                          }
                          await refetch();
                        }}
                      />
                      optional
                    </label>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={async () => {
                        const next = [...capstone];
                        const [moved] = next.splice(index, 1);
                        next.splice(index - 1, 0, moved);
                        await reorderCapstone(
                          course.id,
                          next.map((entry, position) => ({
                            kind: entry.kind,
                            id: entry.id,
                            order: position,
                          })),
                        );
                        await refetch();
                      }}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Detach"
                      onClick={async () => {
                        if (link.kind === 'project') await detachProject(course.id, link.id);
                        else if (link.kind === 'mock')
                          await detachMockInterview(course.id, link.id);
                        // scope=course: if the same quiz is also attached to a
                        // chapter, that link stays put.
                        else if (link.kind === 'quiz')
                          await detachQuiz(course.id, link.id, 'course');
                        else if (link.kind === 'exercise')
                          await detachExercise(course.id, link.id, 'course');
                        else await removeCapstoneMedia(course.id, link.kind, link.id);
                        await refetch();
                        toast.success('Detached — the original is untouched.');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {(
                  [
                    ['project', '+ Attach project'],
                    ['mock', '+ Attach mock interview'],
                    ['quiz', '+ Attach quiz'],
                    ['exercise', '+ Attach exercise'],
                    ['video', '+ Video'],
                    ['article', '+ Article'],
                  ] as Array<[CapstoneKind | 'video' | 'article', string]>
                ).map(([kind, label]) => (
                  <Button
                    key={kind}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      // Media uses the same drawer a chapter does — one form, two
                      // destinations — so authoring is identical wherever you are.
                      kind === 'video' || kind === 'article'
                        ? setDrawer({ kind, capstone: true })
                        : setAttaching(kind as CapstoneKind)
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDrawer({ kind: 'chapter' })}>+ Add chapter</Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Import chapters JSON
            </Button>
            <Button variant="outline" onClick={() => setPayloadOpen(true)}>
              Inspect payload
            </Button>
          </div>
        </div>
      ) : null}

      {tab === 'learners' ? <LearnersTab courseId={course.id} /> : null}

      <ItemDrawer
        open={Boolean(drawer)}
        target={drawer}
        courseId={course.id}
        onClose={() => setDrawer(null)}
        onSaved={() => refetch()}
      />

      <PayloadDialog
        open={payloadOpen}
        onClose={() => setPayloadOpen(false)}
        method="PUT"
        path={`/admin/courses/${course.id}`}
        body={draft}
      />

      <CapstoneAttachDialog
        open={Boolean(attaching)}
        kind={attaching}
        courseId={course.id}
        onClose={() => setAttaching(null)}
        onAttached={() => refetch()}
      />

      <ImportCourseModal
        open={importOpen}
        mode="curriculum"
        courseId={course.id}
        onClose={() => setImportOpen(false)}
        onImported={() => refetch()}
      />

      <ConfirmDelete
        open={Boolean(confirming)}
        title={
          confirming?.kind === 'course'
            ? course.stats.enrolled
              ? 'Cannot delete'
              : 'Delete course'
            : `Remove ${confirming?.kind === 'chapter' ? 'chapter' : confirming?.itemKind}`
        }
        description={
          confirming?.kind === 'course'
            ? course.stats.enrolled
              ? `“${course.title}” has ${course.stats.enrolled.toLocaleString()} enrolments, so the API refuses. Archive it instead.`
              : `Delete “${course.title}”? Nobody is enrolled, so this is permanent.`
            : confirming?.itemKind === 'quiz' || confirming?.itemKind === 'exercise'
              ? `Detach “${confirming?.label}”? The ${confirming?.itemKind} itself stays in the library.`
              : `Delete “${confirming?.label}”? This cannot be undone.`
        }
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          if (!confirming) return;
          try {
            if (confirming.kind === 'course') {
              await deleteCourse(course.id);
              toast.success('Deleted.');
              router.push('/courses');
              return;
            }
            if (confirming.kind === 'chapter' && confirming.id) {
              await deleteChapter(course.id, confirming.id);
            }
            if (confirming.kind === 'item' && confirming.id && confirming.chapterId) {
              if (confirming.itemKind === 'video') {
                await deleteVideo(course.id, confirming.chapterId, confirming.id);
              } else if (confirming.itemKind === 'article') {
                await deleteArticle(course.id, confirming.chapterId, confirming.id);
              } else if (confirming.itemKind === 'quiz') {
                await detachQuiz(course.id, confirming.id);
              } else {
                await detachExercise(course.id, confirming.id);
              }
            }
            await refetch();
            toast.success('Removed.');
          } catch (error) {
            const message =
              (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
              (error as Error).message;
            toast.error('Could not remove', { description: message });
          } finally {
            setConfirming(null);
          }
        }}
      />
    </div>
  );
}

function LearnersTab({ courseId }: { courseId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['course-learners', courseId, page],
    queryFn: () => fetchLearners(courseId, page),
  });

  if (isLoading) return <LoadingState label="Loading learners…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!data?.data.length) {
    return (
      <EmptyState
        title="No learners yet"
        description="Enrolments appear here once the course is live."
      />
    );
  }

  const pages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div className="space-y-3">
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Learner</th>
              <th className="px-4 py-2.5 text-left font-semibold">Email</th>
              <th className="px-4 py-2.5 text-left font-semibold">Items done</th>
              <th className="px-4 py-2.5 text-left font-semibold">State</th>
              <th className="px-4 py-2.5 text-left font-semibold">Started</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((learner) => (
              <tr key={learner.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5">{learner.user?.name ?? '—'}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {learner.user?.email ?? '—'}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{learner.completedItems}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge
                    label={learner.isCompleted ? 'Completed' : 'In progress'}
                    tone={learner.isCompleted ? 'success' : 'neutral'}
                  />
                </td>
                <td className="px-4 py-2.5">{new Date(learner.startedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of{' '}
          {data.total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Prev
          </Button>
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
