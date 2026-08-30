'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { GripVertical, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { ReadinessPanel } from '@/components/shared/form/ReadinessPanel';
import { SlugField } from '@/components/shared/form/SlugField';
import { TagInput } from '@/components/shared/form/TagInput';
import { MediaField } from '@/components/shared/form/MediaField';
import { RichTextField } from '@/components/shared/form/RichTextField';
import { useDragReorder, moved } from '@/lib/courses/useDragReorder';
import { evaluatePathReadiness, isReady } from '@/lib/paths/readiness';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import TopicDrawer from '@/components/paths/TopicDrawer';
import AttachItemDialog from '@/components/paths/AttachItemDialog';
import EnrolLearnersDialog from '@/components/paths/EnrolLearnersDialog';
import { AuthorField } from '@/components/paths/AuthorField';
import {
  ATTACHABLE_KINDS,
  checkPathSlug,
  createTopic,
  deleteTopic,
  detachItem,
  fetchLearners,
  fetchPath,
  kindLabel,
  kindTakesOptional,
  removeLearner,
  reorderItems,
  reorderTopics,
  updateItem,
  setLearnerAccess,
  setPathStatus,
  updatePath,
  updateTopic,
  type ItemKind,
  type PathDetail,
  type PathInput,
  type PathStatus,
  type Topic,
} from '@/lib/api/paths';

const TABS = [
  ['overview', 'Overview'],
  ['curriculum', 'Curriculum'],
  ['access', 'Access & pricing'],
  ['visibility', 'Visibility'],
  ['learners', 'Learners'],
] as const;

type TabId = (typeof TABS)[number][0];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Beginner to Advanced'];

function tone(status: PathStatus): 'success' | 'neutral' | 'warning' | 'info' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'DRAFT') return 'neutral';
  if (status === 'TEAM') return 'info';
  return 'warning';
}

function toDraft(path: PathDetail): PathInput {
  return {
    title: path.title,
    slug: path.slug,
    summary: path.summary,
    description: path.description,
    banner: path.banner ?? '',
    preview: path.preview,
    level: path.level,
    difficulty: path.difficulty,
    timeframe: path.timeframe,
    instructor: path.instructor,
    prerequisites: path.prerequisites,
    skills: path.skills,
    languages: path.languages,
    estimatedWeeks: path.estimatedWeeks,
    hoursPerWeek: path.hoursPerWeek,
    isPremium: path.isPremium,
    amount: path.amount,
    paddlePlanCode: path.paddlePlanCode,
    paddle_price_id: path.paddle_price_id,
    isWaiting: path.isWaiting,
    waitingLink: path.waitingLink,
  };
}

export default function PathDetailClient() {
  const router = useRouter();
  const params = useParams();
  const pathId = String(params?.id ?? '');

  const [tab, setTab] = useState<TabId>('overview');
  const [draft, setDraft] = useState<PathInput | null>(null);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [attaching, setAttaching] = useState<ItemKind | null>(null);
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [confirming, setConfirming] = useState<{ kind: 'topic'; id: string; label: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [learnerPage, setLearnerPage] = useState(1);
  const [learnerQ, setLearnerQ] = useState('');
  const [learnerQDebounced, setLearnerQDebounced] = useState('');
  const [accessFilter, setAccessFilter] = useState<'all' | 'full' | 'preview'>('all');

  const {
    data: path,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-path', pathId],
    queryFn: () => fetchPath(pathId),
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLearnerQDebounced(learnerQ.trim());
      setLearnerPage(1); // a new search starts at the first page, not page 4
    }, 250);
    return () => window.clearTimeout(timer);
  }, [learnerQ]);

  const LEARNERS_PER_PAGE = 20;
  const { data: learners, refetch: refetchLearners } = useQuery({
    queryKey: ['admin-path-learners', pathId, learnerPage, learnerQDebounced, accessFilter],
    queryFn: () =>
      fetchLearners(pathId, {
        page: learnerPage,
        limit: LEARNERS_PER_PAGE,
        ...(learnerQDebounced ? { q: learnerQDebounced } : {}),
        ...(accessFilter !== 'all' ? { access: accessFilter } : {}),
      }),
    enabled: tab === 'learners',
    placeholderData: (previous) => previous,
  });

  // Declared after the query so it closes over the current render's data.
  const topicDrag = useDragReorder({
    onReorder: async (from, to) => {
      if (!path) return;
      const next = moved(path.topics, from, to);
      await reorderTopics(
        pathId,
        next.map((topic) => topic.id),
      );
      await refetch();
    },
  });

  const itemDrag = useDragReorder({
    onReorder: async (from, to, scope) => {
      if (!path) return;
      const topic = path.topics.find((row) => row.id === scope);
      if (!topic) return;
      // One sequence, every kind included — resources are no longer pinned.
      const next = moved(topic.items, from, to);
      await reorderItems(
        pathId,
        topic.id,
        next.map((item) => ({ kind: item.kind, id: item.id })),
      );
      await refetch();
    },
  });

  // Adjusting state during render is React's recommended shape for "reset local
  // state when the row changes": no cascading render, and an edit in progress
  // survives a background refetch of the same path.
  if (path && draftFor !== path.id) {
    setDraftFor(path.id);
    setDraft(toDraft(path));
    setSelected(path.topics[0]?.id ?? null);
  }

  const rules = useMemo(
    () =>
      path && draft
        ? evaluatePathReadiness(
            {
              title: draft.title ?? '',
              slug: draft.slug ?? '',
              summary: draft.summary ?? '',
              estimatedWeeks: draft.estimatedWeeks ?? 0,
              isPremium: Boolean(draft.isPremium),
              amount: draft.amount ?? 0,
            },
            path.topics,
          )
        : [],
    [path, draft],
  );

  if (isLoading) return <LoadingState label="Loading path…" />;
  if (isError || !path || !draft) return <ErrorState onRetry={() => refetch()} />;

  const isTeamPath = Boolean(path.ownerTeamId);
  const topic = path.topics.find((row) => row.id === selected) ?? null;
  const patch = (next: PathInput) => setDraft((current) => ({ ...(current ?? {}), ...next }));

  const save = async () => {
    setSaving(true);
    try {
      await updatePath(path.id, draft);
      await refetch();
      toast.success('Saved.');
    } catch (error) {
      const body = (error as { response?: { data?: { message?: string } } }).response?.data;
      toast.error('Could not save', { description: body?.message ?? (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (action: 'publish' | 'unpublish' | 'archive' | 'restore') => {
    try {
      await setPathStatus(path.id, action);
      await refetch();
      toast.success(
        action === 'publish'
          ? 'Published.'
          : action === 'unpublish'
            ? 'Unpublished. Learners keep their progress.'
            : action === 'archive'
              ? 'Archived. It leaves the catalogue but keeps its learners.'
              : 'Restored.',
      );
    } catch (error) {
      const failures = (error as { failures?: Array<{ message: string }> }).failures;
      toast.error('Could not change the status', {
        description: failures?.map((f) => f.message).join(' · ') ?? (error as Error).message,
      });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={path.title || 'Untitled path'}
        description={`/${path.slug} · ${path.topics.length} topics · ${path.counts.items ?? 0} items`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone(path.status)} label={path.status} />
            <Button variant="outline" onClick={() => router.push('/paths')}>
              Back
            </Button>
            <Button
              variant="outline"
              onClick={() => changeStatus(path.archivedAt ? 'restore' : 'archive')}
            >
              {path.archivedAt ? 'Restore' : 'Archive'}
            </Button>
            <Button onClick={save} disabled={saving} variant="outline">
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {/* A team path is never published to the catalogue. */}
            {isTeamPath ? null : (
              <Button
                onClick={() => changeStatus(path.isPublic ? 'unpublish' : 'publish')}
                disabled={!path.isPublic && !isReady(rules)}
              >
                {path.isPublic ? 'Unpublish' : 'Publish'}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === id
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="space-y-4">
          <Section title="Identity" blurb="How the path is named and described in the catalogue.">
            <Field label="Title" required htmlFor="path-title">
              <Input
                id="path-title"
                value={draft.title ?? ''}
                onChange={(event) => patch({ title: event.target.value })}
                maxLength={100}
              />
            </Field>
            <SlugField
              id="path-slug"
              noun="path"
              value={draft.slug ?? ''}
              onChange={(next) => patch({ slug: next })}
              title={draft.title ?? ''}
              courseId={path.id}
              check={(slug, excludeId) => checkPathSlug(slug, 'path', excludeId)}
            />
            <Field label="Summary" required htmlFor="path-summary" wide>
              <Input
                id="path-summary"
                value={draft.summary ?? ''}
                onChange={(event) => patch({ summary: event.target.value })}
                placeholder="Shown on the catalogue card."
              />
            </Field>
            <div className="sm:col-span-2">
              <RichTextField
                id="path-description"
                label="Description"
                value={draft.description ?? ''}
                onChange={(next) => patch({ description: next })}
              />
            </div>
          </Section>

          <Section
            title="Classification"
            blurb="How learners find it and what they should already know."
          >
            <Field label="Level" htmlFor="path-level">
              <Select
                value={draft.level || 'none'}
                onValueChange={(value) => patch({ level: value === 'none' ? '' : value })}
              >
                <SelectTrigger id="path-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Difficulty" htmlFor="path-difficulty">
              <Input
                id="path-difficulty"
                value={draft.difficulty ?? ''}
                onChange={(event) => patch({ difficulty: event.target.value })}
              />
            </Field>
            <Field label="Timeframe" htmlFor="path-timeframe">
              <Input
                id="path-timeframe"
                value={draft.timeframe ?? ''}
                onChange={(event) => patch({ timeframe: event.target.value })}
                placeholder="3 months"
              />
            </Field>
            <Field label="Skills" htmlFor="path-skills" wide>
              <TagInput
                id="path-skills"
                value={draft.skills ?? []}
                onChange={(next) => patch({ skills: next })}
                placeholder="What the learner can do at the end"
              />
            </Field>
            <Field label="Prerequisites" htmlFor="path-prereqs" wide>
              <TagInput
                id="path-prereqs"
                value={draft.prerequisites ?? []}
                onChange={(next) => patch({ prerequisites: next })}
                placeholder="What they need before starting"
              />
            </Field>
            <Field label="Languages" htmlFor="path-languages" wide>
              <TagInput
                id="path-languages"
                value={draft.languages ?? []}
                onChange={(next) => patch({ languages: next })}
              />
            </Field>
          </Section>

          <Section title="Commitment" blurb="What the path asks of a learner, and who teaches it.">
            <Field label="Estimated weeks" htmlFor="path-weeks">
              <Input
                id="path-weeks"
                type="number"
                min={0}
                value={draft.estimatedWeeks ?? 0}
                onChange={(event) => patch({ estimatedWeeks: Number(event.target.value) || 0 })}
              />
            </Field>
            <Field label="Hours per week" htmlFor="path-hours">
              <Input
                id="path-hours"
                type="number"
                min={0}
                value={draft.hoursPerWeek ?? 0}
                onChange={(event) => patch({ hoursPerWeek: Number(event.target.value) || 0 })}
              />
            </Field>
            <Field label="Instructor" htmlFor="path-instructor">
              <Input
                id="path-instructor"
                value={draft.instructor ?? ''}
                onChange={(event) => patch({ instructor: event.target.value })}
                maxLength={200}
              />
            </Field>
          </Section>

          <Section title="Media" blurb="Artwork for the catalogue card and the path header.">
            <div className="sm:col-span-2">
              <MediaField
                label="Banner"
                scope="path-banner"
                ownerId={path.id}
                value={draft.banner ?? ''}
                onChange={(next) => patch({ banner: next })}
              />
            </div>
            <Field label="Preview" htmlFor="path-preview" wide>
              <Input
                id="path-preview"
                value={draft.preview ?? ''}
                onChange={(event) => patch({ preview: event.target.value })}
                maxLength={100}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Short — the column caps at 100 characters.
              </p>
            </Field>
          </Section>
        </div>
      ) : null}

      {tab === 'curriculum' ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Path spine
                </h2>
                <span className="text-xs text-muted-foreground">drag to reorder</span>
              </div>
              <div className="flex flex-col gap-0.5 p-2">
                {path.topics.map((row, index) => (
                  <button
                    key={row.id}
                    type="button"
                    {...topicDrag.handlers(index, 'topics')}
                    aria-current={row.id === selected ? 'true' : undefined}
                    data-selected={row.id === selected}
                    onClick={() => setSelected(row.id)}
                    className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-transparent p-2 text-left transition-colors hover:bg-muted data-[selected=true]:border-primary data-[selected=true]:bg-accent data-[dragging=true]:opacity-40 data-[dragover=true]:border-dashed data-[dragover=true]:border-primary"
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted font-mono text-[11px] font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {row.title || 'Untitled topic'}
                      </span>
                      <span className="flex flex-wrap gap-2 text-[11.5px] text-muted-foreground">
                        <span className="font-mono tabular-nums">{row.duration}h</span>
                        <span>{row.level || 'no level'}</span>
                        <span className="font-mono tabular-nums">
                          {row.items.length} item{row.items.length === 1 ? '' : 's'}
                        </span>
                      </span>
                    </span>
                  </button>
                ))}
                {path.topics.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    No topics yet. A path needs at least one to publish.
                  </p>
                ) : null}
              </div>
              <div className="border-t border-border p-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const made = await createTopic(path.id, { title: 'Untitled topic' });
                    await refetch();
                    setSelected(made.id);
                    toast.success('Topic added. Give it a title and some content.');
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add topic
                </Button>
              </div>
            </Card>

            <Card>
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ready to publish
                </h2>
              </div>
              <div className="p-3">
                <ReadinessPanel
                  rules={rules.map((rule) => ({
                    field: rule.id,
                    label: rule.label,
                    ok: rule.ok,
                    hint: rule.detail,
                  }))}
                />
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Topic
              </h2>
              {topic ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingTopic(topic)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit all fields
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      setConfirming({
                        kind: 'topic',
                        id: topic.id,
                        label: topic.title || 'Untitled topic',
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="p-4">
              {!topic ? (
                <p className="text-sm text-muted-foreground">Select a topic, or add one.</p>
              ) : (
                <TopicPane
                  pathId={path.id}
                  topic={topic}
                  drag={itemDrag}
                  onChanged={refetch}
                  onAttach={setAttaching}
                  onEdit={() => setEditingTopic(topic)}
                />
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'access' ? (
        <div className="space-y-4">
          <Section title="Pricing" blurb="Whether the path is paid, and how it bills.">
            <div className="flex items-start justify-between gap-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium text-foreground">Premium</p>
                <p className="text-xs text-muted-foreground">
                  Free paths are open to every signed-in learner.
                </p>
              </div>
              <Switch
                checked={Boolean(draft.isPremium)}
                onCheckedChange={(next) => patch({ isPremium: next })}
                aria-label="Premium"
              />
            </div>
            <Field label="Amount" htmlFor="path-amount">
              <Input
                id="path-amount"
                type="number"
                min={0}
                value={draft.amount ?? 0}
                onChange={(event) => patch({ amount: Number(event.target.value) || 0 })}
              />
            </Field>
            <Field label="Paddle plan code" htmlFor="path-plan">
              <Input
                id="path-plan"
                type="number"
                value={draft.paddlePlanCode ?? ''}
                onChange={(event) =>
                  patch({ paddlePlanCode: event.target.value ? Number(event.target.value) : null })
                }
              />
            </Field>
            <Field label="Paddle price ID" htmlFor="path-price">
              <Input
                id="path-price"
                value={draft.paddle_price_id ?? ''}
                onChange={(event) => patch({ paddle_price_id: event.target.value })}
                maxLength={30}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Fixed-width column — trimmed on read so it round-trips.
              </p>
            </Field>
          </Section>

          <Section title="Waitlist" blurb="Collect interest before the path is finished.">
            <div className="flex items-start justify-between gap-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium text-foreground">Waitlist mode</p>
                <p className="text-xs text-muted-foreground">
                  Learners join a list instead of enrolling.
                </p>
              </div>
              <Switch
                checked={Boolean(draft.isWaiting)}
                onCheckedChange={(next) => patch({ isWaiting: next })}
                aria-label="Waitlist mode"
              />
            </div>
            <Field label="Waitlist link" htmlFor="path-waitlink" wide>
              <Input
                id="path-waitlink"
                value={draft.waitingLink ?? ''}
                onChange={(event) => patch({ waitingLink: event.target.value })}
                placeholder="https://…"
              />
            </Field>
          </Section>
        </div>
      ) : null}

      {tab === 'visibility' ? (
        <div className="space-y-4">
          {isTeamPath ? (
            <p className="rounded-lg border border-warning bg-warning-wash p-3 text-sm text-warning">
              <strong>{path.ownerTeamId} owns this path.</strong> Platform staff can edit its
              content, but not who it belongs to or who can see it — those two would disclose or
              transfer a customer&apos;s private curriculum, and neither has an undo.
            </p>
          ) : null}

          <Section
            title="Who can see this"
            blurb="Team paths never appear in the public catalogue."
          >
            <LockedField
              label="Public catalogue"
              value={
                isTeamPath
                  ? `Off — private to ${path.ownerTeamId}`
                  : path.isPublic
                    ? 'On — in the catalogue'
                    : 'Off — draft'
              }
              reason={
                isTeamPath
                  ? 'Turning this on would publish a paying customer’s private curriculum to the whole catalogue. It is a disclosure, not an edit, so it is not available here.'
                  : 'Set by Publish and Unpublish, so the readiness checks always run first.'
              }
            />
            <AuthorField
              author={path.createdBy}
              value={draft.createdById ?? ''}
              onChange={(id) => patch({ createdById: id })}
            />
            <LockedField
              label="Owner team"
              value={path.ownerTeamId ?? ''}
              reason={
                isTeamPath
                  ? 'Clearing this would transfer the path out of the team silently, with no undo. Ownership changes belong to the team workspace.'
                  : 'This is a catalogue path. Ownership is assigned when a team creates a path in its own workspace, never from the admin portal.'
              }
            />
          </Section>

          <Section
            title="Lifecycle"
            blurb="Retired paths archive rather than delete — learner progress is a hard relation, so a delete is refused once anyone has started."
          >
            <p className="text-sm text-muted-foreground sm:col-span-2">
              {path.archivedAt
                ? `Archived on ${new Date(path.archivedAt).toLocaleDateString()}.`
                : 'Not archived.'}
            </p>
          </Section>
        </div>
      ) : null}

      {tab === 'learners' ? (
        <div className="space-y-4">
          <PageHeader
            title="Learners"
            description={
              path.counts.enrolled
                ? `${path.counts.enrolled} enrolled. Removing someone deletes their progress on this path — there is no undo.`
                : 'Nobody is enrolled yet.'
            }
            actions={<Button onClick={() => setEnrolOpen(true)}>Enrol learners</Button>}
          />

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={learnerQ}
                onChange={(event) => setLearnerQ(event.target.value)}
                placeholder="Search name or email…"
                aria-label="Search learners"
                className="pl-9"
              />
            </div>
            <Select
              value={accessFilter}
              onValueChange={(value) => {
                setAccessFilter(value as 'all' | 'full' | 'preview');
                setLearnerPage(1);
              }}
            >
              <SelectTrigger className="w-36" aria-label="Filter by access">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All access</SelectItem>
                <SelectItem value="full">Full</SelectItem>
                <SelectItem value="preview">Preview</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!learners?.data.length ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              {learnerQDebounced || accessFilter !== 'all'
                ? 'Nobody matches that filter.'
                : 'No enrolments. Use Enrol learners to add people by email.'}
            </Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Learner</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Access</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Enrolled</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Progress</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {learners.data.map((row) => (
                    <tr key={row.id} className="border-b border-border-soft last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{row.user.name}</div>
                        <div className="text-[11.5px] text-muted-foreground">{row.user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={row.isPreview ? 'preview' : 'full'}
                          onValueChange={async (value) => {
                            const result = await setLearnerAccess(
                              path.id,
                              row.user.id,
                              value as 'full' | 'preview',
                            );
                            await refetchLearners();
                            if (!result.changed) return;
                            toast.success(
                              value === 'full'
                                ? `${row.user.name} now has full access${
                                    result.granted ? ` (${result.granted} grants)` : ''
                                  }.`
                                : `${row.user.name} is back to preview${
                                    result.revoked ? ` (${result.revoked} grants revoked)` : ''
                                  }. Their progress is kept.`,
                            );
                          }}
                        >
                          <SelectTrigger
                            className="h-8 w-28"
                            aria-label={`Access for ${row.user.name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full</SelectItem>
                            <SelectItem value="preview">Preview</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">
                        {new Date(row.enrolledAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {row.topicsStarted} / {path.topics.length}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={async () => {
                            await removeLearner(path.id, row.user.id);
                            await refetchLearners();
                            toast.success(
                              `Removed ${row.user.name}. Their progress on this path went with it.`,
                            );
                          }}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {learners && learners.total > LEARNERS_PER_PAGE ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {(learners.page - 1) * LEARNERS_PER_PAGE + 1}–
                  {Math.min(learners.page * LEARNERS_PER_PAGE, learners.total)}
                </span>{' '}
                of <span className="font-mono tabular-nums">{learners.total}</span>
              </span>
              <span className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={learners.page <= 1}
                  onClick={() => setLearnerPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={learners.page * LEARNERS_PER_PAGE >= learners.total}
                  onClick={() => setLearnerPage((page) => page + 1)}
                >
                  Next
                </Button>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <TopicDrawer
        open={Boolean(editingTopic)}
        pathId={path.id}
        topic={editingTopic}
        onClose={() => setEditingTopic(null)}
        onSaved={refetch}
      />

      <AttachItemDialog
        open={Boolean(attaching && topic)}
        kind={attaching}
        pathId={path.id}
        topicId={topic?.id ?? ''}
        onClose={() => setAttaching(null)}
        onAttached={refetch}
      />

      <EnrolLearnersDialog
        open={enrolOpen}
        path={path}
        onClose={() => setEnrolOpen(false)}
        onEnrolled={refetchLearners}
      />

      {confirming ? (
        <ConfirmDelete
          open
          title={`Remove “${confirming.label}”?`}
          description="If another path shares this topic it is only unlinked here. Otherwise it is deleted along with its attachments."
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            const result = await deleteTopic(path.id, confirming.id);
            await refetch();
            setSelected(null);
            setConfirming(null);
            toast.success(
              result.unlinkedOnly
                ? 'Unlinked from this path. It is still used by another one.'
                : 'Removed. Its attachments went with it.',
            );
          }}
        />
      ) : null}
    </div>
  );
}

/* ────────────────────────────── pieces ────────────────────────────── */

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {blurb ? <p className="mt-0.5 text-xs text-muted-foreground">{blurb}</p> : null}
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  required,
  wide,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <Label htmlFor={htmlFor}>
        {label}{' '}
        {required ? (
          <span className="text-destructive">*</span>
        ) : (
          <span className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            optional
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

/** Shown but not editable, with the reason on the face of it. */
function LockedField({ label, value, reason }: { label: string; value: string; reason: string }) {
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label>
        {label}{' '}
        <span className="rounded bg-info-wash px-1 py-0.5 text-[10px] uppercase tracking-wide text-info">
          locked
        </span>
      </Label>
      <div className="rounded-lg border border-dashed border-border bg-muted px-3 py-2 text-sm text-foreground">
        {value || <span className="text-muted-foreground">Not set</span>}
      </div>
      <p className="text-xs text-muted-foreground">{reason}</p>
    </div>
  );
}

/**
 * A topic's content as ONE ordered list.
 *
 * compile-path merges every kind into a single array and sorts by `order`, so
 * twelve separate lists would hide the only thing that field controls.
 * Resources are pinned last because compile-path adds 1000 to theirs.
 */
function TopicPane({
  pathId,
  topic,
  drag,
  onChanged,
  onAttach,
  onEdit,
}: {
  pathId: string;
  topic: Topic;
  drag: ReturnType<typeof useDragReorder>;
  onChanged: () => void;
  onAttach: (kind: ItemKind) => void;
  onEdit: () => void;
}) {
  const row = (
    item: Topic['items'][number],
    index: number,
    position: number,
    draggable: boolean,
  ) => (
    <div
      key={`${item.kind}:${item.id}`}
      {...(draggable ? drag.handlers(index, topic.id) : {})}
      className="flex items-center gap-2.5 border-t border-border-soft px-3 py-2.5 text-sm first:border-t-0 data-[dragging=true]:opacity-40 data-[dragover=true]:bg-accent"
    >
      {draggable ? (
        <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
      ) : (
        <span className="w-3.5" />
      )}
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted font-mono text-[11px] font-semibold text-muted-foreground">
        {position}
      </span>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        {kindLabel(item.kind)}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
      {/*
        Same control as a chapter's free/premium switch in the course editor:
        a Switch reading the permissive state, with the word beside it.
      */}
      {kindTakesOptional(item.kind) ? (
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Switch
            checked={Boolean(item.isOptional)}
            onCheckedChange={async (next) => {
              await updateItem(pathId, topic.id, item.kind, item.id, { isOptional: next });
              onChanged();
              toast.success(`“${item.title}” is now ${next ? 'optional' : 'required'}.`);
            }}
            aria-label={`${item.title} is optional`}
          />
          optional
        </label>
      ) : (
        // The other nine joins have no isOptional column, so a switch here would
        // be a control with nowhere to save.
        <span
          className="shrink-0 text-xs text-muted-foreground"
          title={`A ${kindLabel(item.kind).toLowerCase()} link has no isOptional column, so it is always required.`}
        >
          required
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-destructive"
        onClick={async () => {
          await detachItem(pathId, topic.id, item.kind, item.id);
          onChanged();
          toast.success(
            `Detached “${item.title}”. The ${kindLabel(item.kind).toLowerCase()} itself is untouched.`,
          );
        }}
      >
        Detach
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/*
        Keyed by topic so switching selection remounts these fields.

        Title and Hours are uncontrolled — they commit on blur, which keeps a
        keystroke from re-rendering the whole pane and moving the caret. The
        cost is that `defaultValue` only applies at mount, and this pane renders
        ONE input for whichever topic is selected: without the key React reuses
        the same DOM node across topics and the box keeps the previous title.
        (The course editor avoids this by accident — its chapters each render
        their own input inside a map.)
      */}
      <div key={topic.id} className="grid gap-3 sm:grid-cols-3">
        <InlineField label="Title" htmlFor="topic-inline-title">
          <Input
            id="topic-inline-title"
            defaultValue={topic.title}
            onBlur={async (event) => {
              const next = event.target.value.trim();
              if (!next || next === topic.title) return;
              await updateTopic(pathId, topic.id, { title: next });
              onChanged();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                event.currentTarget.value = topic.title;
                event.currentTarget.blur();
              }
            }}
          />
        </InlineField>
        <InlineField label="Hours" htmlFor="topic-inline-hours">
          <Input
            id="topic-inline-hours"
            type="number"
            min={0}
            defaultValue={topic.duration}
            onBlur={async (event) => {
              const next = Number(event.target.value) || 0;
              if (next === topic.duration) return;
              await updateTopic(pathId, topic.id, { duration: next });
              onChanged();
            }}
          />
        </InlineField>
        <InlineField label="Level" htmlFor="topic-inline-level">
          <Select
            value={topic.level || 'none'}
            onValueChange={async (value) => {
              await updateTopic(pathId, topic.id, { level: value === 'none' ? '' : value });
              onChanged();
            }}
          >
            <SelectTrigger id="topic-inline-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InlineField>
      </div>

      <p className="text-xs text-muted-foreground">
        Summary, banner, slug, outcomes and the rest are in{' '}
        <button type="button" className="underline" onClick={onEdit}>
          Edit all fields
        </button>
        .
      </p>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Content in this topic — the order a learner walks it
        </p>
        <Card className="overflow-hidden">
          {topic.items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Nothing attached yet. Use the buttons below.
            </p>
          ) : null}
          {topic.items.map((item, index) => row(item, index, index + 1, true))}
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Attach:</span>
        {ATTACHABLE_KINDS.map((kind) => (
          <Button
            key={kind.id}
            variant="outline"
            size="sm"
            onClick={() => onAttach(kind.id as ItemKind)}
          >
            {kind.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function InlineField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {/* Associated deliberately: without htmlFor these read as unlabelled to a
          screen reader, and to any test that looks a field up by its label. */}
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}
