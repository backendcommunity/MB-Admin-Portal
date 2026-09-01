'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Field, FieldGrid, Section } from '@/components/shared/form/Section';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TagInput } from '@/components/shared/form/TagInput';
import { RichTextField } from '@/components/shared/form/RichTextField';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import TaskDialog from '@/components/projects/TaskDialog';
import SolutionDialog from '@/components/projects/SolutionDialog';
import EnrolLearnersDialog from '@/components/projects/EnrolLearnersDialog';
import { richTextPreview } from '@/lib/richtext';
import { useDragReorder, moved } from '@/lib/courses/useDragReorder';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import {
  LEVELS,
  MODES,
  PLAYGROUND_LANGUAGES,
  createProjectTask,
  deleteProjectTask,
  deleteTask,
  fetchLearners,
  fetchProject,
  fetchSolutions,
  removeLearner,
  reorderProjectTasks,
  reorderTasks,
  updateProject,
  updateProjectTask,
  type Level,
  type Mode,
  type ProjectDetail,
  type ProjectTask,
  type Solution,
  type Task,
} from '@/lib/api/projects';

const TABS = [
  ['overview', 'Overview'],
  ['playground', 'Playground'],
  ['tasks', 'Tasks'],
  ['learners', 'Builders'],
  ['solutions', 'Solutions'],
] as const;

type TabId = (typeof TABS)[number][0];

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ProjectDetailClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-project', projectId],
    queryFn: () => fetchProject(projectId),
  });

  const [tab, setTab] = useState<TabId>('overview');
  const [saving, setSaving] = useState(false);

  const serverKey = data
    ? JSON.stringify([
        data.title,
        data.slug,
        data.summary,
        data.description,
        data.banner,
        data.level,
        data.duration,
        data.skills,
        data.technologies,
        data.prerequisites,
        data.industries,
        data.languages,
        data.isPremium,
        data.amount,
        data.isSample,
        data.isWaiting,
        data.waitingLink,
        data.baseRepository,
        data.frontendURL,
        data.referenceApiURL,
        data.PRDLink,
        data.playgroundConfig,
      ])
    : 'none';

  const [draft, setDraft] = useSeededForm(serverKey, () => ({
    title: data?.title ?? '',
    slug: data?.slug ?? '',
    summary: data?.summary ?? '',
    description: data?.description ?? '',
    banner: data?.banner ?? '',
    level: (data?.level ?? 'Beginner') as Level,
    duration: data?.duration ?? 0,
    skills: data?.skills ?? [],
    technologies: data?.technologies ?? [],
    prerequisites: data?.prerequisites ?? [],
    industries: data?.industries ?? [],
    languages: data?.languages ?? [],
    isPremium: data?.isPremium ?? false,
    amount: data?.amount ?? 0,
    isSample: data?.isSample ?? false,
    isWaiting: data?.isWaiting ?? true,
    waitingLink: data?.waitingLink ?? '',
    baseRepository: data?.baseRepository ?? '',
    frontendURL: data?.frontendURL ?? '',
    referenceApiURL: data?.referenceApiURL ?? '',
    PRDLink: data?.PRDLink ?? '',
    mode: (data?.mode ?? 'rest-api') as Mode,
    language: data?.language ?? 'node',
    entrypoint: data?.entrypoint ?? '',
    terminalJail: data?.terminalJail ?? true,
    showPreviewOnLoad: data?.showPreviewOnLoad ?? false,
  }));

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (!draft.title.trim() || !draft.summary.trim()) {
      toast.error('A project needs a title and a summary.');
      return;
    }
    setSaving(true);
    try {
      const { mode, language, entrypoint, terminalJail, showPreviewOnLoad, ...rest } = draft;
      await updateProject(projectId, {
        ...rest,
        // Merged server-side over what is stored, so a partial config cannot
        // silently drop the keys another part of the form owns.
        playgroundConfig: {
          mode,
          ...(mode === 'terminal' ? { language, entrypoint, terminalJail } : {}),
          ...(mode === 'frontend' ? { showPreviewOnLoad } : {}),
        },
      });
      toast.success('Saved.');
      refetch();
      // The projects list is a separate query with a 60s staleTime — without
      // this, an edit here would not show up there until it expires or the
      // page is hard-reloaded.
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
    } catch (error) {
      toast.error('Could not save', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const taskTotal = data.projectTasks.reduce((n, pt) => n + pt.tasks.length, 0);
  const pointTotal = data.projectTasks.reduce(
    (n, pt) => n + pt.tasks.reduce((m, t) => m + (t.mb || 0), 0),
    0,
  );

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground hover:underline">
          Projects
        </Link>{' '}
        / {data.title}
      </p>

      <PageHeader
        title={data.title}
        subtitle={`/${data.slug}`}
        badge={
          <span className="flex items-center gap-2">
            <StatusBadge label={data.mode} tone="info" />
            <StatusBadge
              label={data.status}
              tone={data.status === 'published' ? 'success' : 'warning'}
            />
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => router.push('/projects')}>
              Back
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      />

      <StatRow>
        <Stat label="projecttasks" value={String(data.projectTasks.length)} />
        <Stat label="tasks" value={String(taskTotal)} />
        <Stat label="points" value={String(pointTotal)} />
        <Stat label="builders" value={String(data.learnerCount ?? 0)} />
        <Stat label="solutions" value={String(data.solutionCount ?? 0)} />
        <Stat label="duration" value={data.duration ? `${data.duration} h` : '—'} />
      </StatRow>

      <TabBar tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <Section title="Identity" id="section-identity">
              <Field label="Title" htmlFor="p-title" required>
                <Input
                  id="p-title"
                  value={draft.title}
                  onChange={(event) => set('title', event.target.value)}
                />
              </Field>
              <FieldGrid>
                <Field label="Slug" htmlFor="p-slug" required>
                  <Input
                    id="p-slug"
                    value={draft.slug}
                    onChange={(event) => set('slug', event.target.value)}
                    className="font-mono text-sm"
                  />
                </Field>
                <Field label="Level" htmlFor="p-level" required>
                  <Select value={draft.level} onValueChange={(v) => set('level', v as Level)}>
                    <SelectTrigger id="p-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Duration (hours)" htmlFor="p-duration">
                  <Input
                    id="p-duration"
                    type="number"
                    min={0}
                    value={draft.duration}
                    onChange={(event) => set('duration', Number(event.target.value) || 0)}
                  />
                </Field>
                <Field label="Banner URL" htmlFor="p-banner">
                  <Input
                    id="p-banner"
                    value={draft.banner}
                    onChange={(event) => set('banner', event.target.value)}
                  />
                </Field>
              </FieldGrid>
              <Field
                label="Summary"
                htmlFor="p-summary"
                required
                hint="The column is NOT NULL, so it cannot be cleared once set."
              >
                <textarea
                  id="p-summary"
                  value={draft.summary}
                  rows={2}
                  onChange={(event) => set('summary', event.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </Field>
              {/* The learner page renders this as markup, so it is authored as
                  rich text rather than typed into a plain box. */}
              <RichTextField
                id="p-description"
                label="Description"
                hint="The brief the builder reads before starting."
                value={draft.description}
                onChange={(description) => set('description', description)}
              />
            </Section>

            <Section title="Taxonomy" id="section-taxonomy">
              <FieldGrid>
                <Field label="Technologies" hint="Stored as a JSON array.">
                  <TagInput value={draft.technologies} onChange={(v) => set('technologies', v)} />
                </Field>
                <Field label="Skills">
                  <TagInput value={draft.skills} onChange={(v) => set('skills', v)} />
                </Field>
                <Field label="Prerequisites">
                  <TagInput value={draft.prerequisites} onChange={(v) => set('prerequisites', v)} />
                </Field>
                <Field label="Industries">
                  <TagInput value={draft.industries} onChange={(v) => set('industries', v)} />
                </Field>
                <Field
                  label="Languages"
                  hint="A real string[] column — separate from the playground language."
                >
                  <TagInput value={draft.languages} onChange={(v) => set('languages', v)} />
                </Field>
              </FieldGrid>
            </Section>

            <Section title="Access" id="section-access">
              <FieldGrid>
                <Field label="Price" htmlFor="p-amount" hint="A Float here, unlike Cohort.amount.">
                  <Input
                    id="p-amount"
                    type="number"
                    min={0}
                    value={draft.amount}
                    onChange={(event) => set('amount', Number(event.target.value) || 0)}
                  />
                </Field>
                <Field label="Waitlist link" htmlFor="p-waiting">
                  <Input
                    id="p-waiting"
                    value={draft.waitingLink}
                    onChange={(event) => set('waitingLink', event.target.value)}
                  />
                </Field>
              </FieldGrid>

              {[
                [
                  'isPremium',
                  'Premium',
                  'Only a subscriber or somebody with an entitlement can start it.',
                ],
                ['isSample', 'Sample project', 'Shown as an example, not counted as real work.'],
                [
                  'isWaiting',
                  'Waitlisted (draft)',
                  'Defaults to TRUE. This one flag is the whole publish state.',
                ],
              ].map(([key, label, hint]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                  <Switch
                    checked={draft[key as 'isPremium'] as boolean}
                    onCheckedChange={(next) => set(key as 'isPremium', next)}
                    aria-label={label}
                  />
                </label>
              ))}
            </Section>

            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Section title="Dates">
              <dl className="space-y-2 text-xs">
                <Row label="Created" value={fmt(data.createdAt ?? null)} />
                <Row label="Updated" value={fmt(data.updatedAt ?? null)} />
              </dl>
            </Section>
          </aside>
        </div>
      ) : null}

      {tab === 'playground' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <Section title="Playground" id="section-playground">
              <Field
                label="Mode"
                htmlFor="p-mode"
                required
                hint="rest-api grades HTTP calls, terminal grades stdout, frontend just shows a preview."
              >
                <Select value={draft.mode} onValueChange={(v) => set('mode', v as Mode)}>
                  <SelectTrigger id="p-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {draft.mode === 'terminal' ? (
                <>
                  <FieldGrid>
                    <Field label="Language" htmlFor="p-lang" required>
                      <Select value={draft.language} onValueChange={(v) => set('language', v)}>
                        <SelectTrigger id="p-lang">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLAYGROUND_LANGUAGES.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {lang}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field
                      label="Entrypoint"
                      htmlFor="p-entry"
                      required
                      hint="A relative path with no '..' segments — confined to the workdir."
                    >
                      <Input
                        id="p-entry"
                        value={draft.entrypoint}
                        onChange={(event) => set('entrypoint', event.target.value)}
                        className="font-mono text-sm"
                      />
                    </Field>
                  </FieldGrid>
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <span>
                      <span className="block text-sm font-medium">Terminal jail</span>
                      <span className="block text-xs text-muted-foreground">
                        On by default. Turning it off gives the builder the container.
                      </span>
                    </span>
                    <Switch
                      checked={draft.terminalJail}
                      onCheckedChange={(next) => set('terminalJail', next)}
                      aria-label="Terminal jail"
                    />
                  </label>
                </>
              ) : null}

              {draft.mode === 'frontend' ? (
                <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span>
                    <span className="block text-sm font-medium">Show the preview on load</span>
                    <span className="block text-xs text-muted-foreground">
                      Opens the preview pane immediately.
                    </span>
                  </span>
                  <Switch
                    checked={draft.showPreviewOnLoad}
                    onCheckedChange={(next) => set('showPreviewOnLoad', next)}
                    aria-label="Show the preview on load"
                  />
                </label>
              ) : null}
            </Section>

            <Section title="Links" id="section-links">
              <Field
                label="Base repository"
                htmlFor="p-repo"
                hint="The starter the playground clones."
              >
                <Input
                  id="p-repo"
                  value={draft.baseRepository}
                  onChange={(event) => set('baseRepository', event.target.value)}
                />
              </Field>
              <FieldGrid>
                <Field
                  label="Frontend URL"
                  htmlFor="p-front"
                  hint="A live demo of the finished thing."
                >
                  <Input
                    id="p-front"
                    value={draft.frontendURL}
                    onChange={(event) => set('frontendURL', event.target.value)}
                  />
                </Field>
                <Field
                  label="Reference API"
                  htmlFor="p-ref"
                  hint="A working implementation the builder can call."
                >
                  <Input
                    id="p-ref"
                    value={draft.referenceApiURL}
                    onChange={(event) => set('referenceApiURL', event.target.value)}
                  />
                </Field>
              </FieldGrid>
              <Field
                label="PRD link"
                htmlFor="p-prd"
                hint="The product-requirements document — not a repository."
              >
                <Input
                  id="p-prd"
                  value={draft.PRDLink}
                  onChange={(event) => set('PRDLink', event.target.value)}
                />
              </Field>
            </Section>

            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <Section title="What mode decides">
              <p className="text-xs leading-relaxed text-muted-foreground">
                It picks the grading contract every task carries: apiSpec for rest-api, terminalSpec
                for terminal, neither for frontend. Changing it does not rewrite the tasks, so
                existing contracts stop being read.
              </p>
            </Section>
          </aside>
        </div>
      ) : null}

      {tab === 'tasks' ? <TasksTab project={data} onChanged={refetch} /> : null}
      {tab === 'learners' ? <BuildersTab projectId={projectId} /> : null}
      {tab === 'solutions' ? <SolutionsTab projectId={projectId} onChanged={refetch} /> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}

// ── ProjectTasks and Tasks ──────────────────────────────────────────────────

function TasksTab({ project, onChanged }: { project: ProjectDetail; onChanged: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    project.projectTasks.find((pt) => pt.id === selectedId) ?? project.projectTasks[0] ?? null;

  const [ptDraft, setPtDraft] = useSeededForm(
    selected ? `${selected.id}:${selected.title}:${selected.summary}:${selected.slug}` : 'none',
    () => ({
      title: selected?.title ?? '',
      slug: selected?.slug ?? '',
      summary: selected?.summary ?? '',
      banner: selected?.banner ?? '',
      isPremium: selected?.isPremium ?? false,
    }),
  );
  const [savingPt, setSavingPt] = useState(false);
  const [taskFor, setTaskFor] = useState<{ pt: ProjectTask; task: Task | null } | null>(null);
  const [confirming, setConfirming] = useState<{ label: string; run: () => Promise<void> } | null>(
    null,
  );

  const ptDrag = useDragReorder({
    onReorder: async (from, to) => {
      const next = moved(project.projectTasks, from, to);
      await reorderProjectTasks(
        project.id,
        next.map((pt) => pt.id),
      );
      onChanged();
      toast.success('ProjectTasks reordered.');
    },
  });

  const taskDrag = useDragReorder({
    onReorder: async (from, to, scope) => {
      const pt = project.projectTasks.find((row) => row.id === scope);
      if (!pt) return;
      const next = moved(pt.tasks, from, to);
      await reorderTasks(
        project.id,
        pt.id,
        next.map((t) => t.id),
      );
      onChanged();
      toast.success('Tasks reordered.');
    },
  });

  /** A TASK only grades if it carries the contract its mode reads. */
  const ungraded = project.projectTasks
    .flatMap((pt) => pt.tasks)
    .filter(
      (t) =>
        t.type === 'TASK' &&
        ((project.mode === 'rest-api' && !t.apiSpec) ||
          (project.mode === 'terminal' && !t.terminalSpec)),
    );

  const addPt = async () => {
    try {
      const created = await createProjectTask(project.id, {
        title: `ProjectTask ${project.projectTasks.length + 1}`,
      });
      setSelectedId(created.id);
      onChanged();
    } catch (error) {
      toast.error('Could not add it', { description: (error as Error).message });
    }
  };

  const savePt = async () => {
    if (!selected || !ptDraft.title.trim()) return;
    setSavingPt(true);
    try {
      await updateProjectTask(project.id, selected.id, ptDraft);
      onChanged();
      toast.success('ProjectTask saved.');
    } catch (error) {
      toast.error('Could not save', { description: (error as Error).message });
    } finally {
      setSavingPt(false);
    }
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit p-0">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              ProjectTasks
            </span>
            <Button variant="ghost" size="sm" onClick={addPt}>
              <Plus className="size-4" />
            </Button>
          </div>

          {project.projectTasks.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              None yet. There is nothing for a builder to work through.
            </p>
          ) : (
            <div className="p-1.5">
              {project.projectTasks.map((pt, index) => (
                <button
                  key={pt.id}
                  type="button"
                  {...ptDrag.handlers(index, 'pt')}
                  onClick={() => setSelectedId(pt.id)}
                  aria-current={pt.id === selected?.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted data-[dragover=true]:ring-1 data-[dragover=true]:ring-primary aria-[current=true]:bg-muted"
                >
                  <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{pt.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {pt.tasks.length} task{pt.tasks.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  {pt.isPremium ? <StatusBadge label="premium" tone="neutral" /> : null}
                </button>
              ))}
            </div>
          )}
        </Card>

        {selected ? (
          <div className="space-y-4">
            {ungraded.length ? (
              <div className="rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
                {ungraded.length} task{ungraded.length === 1 ? '' : 's'} of type TASK carry no{' '}
                {project.mode === 'terminal' ? 'terminalSpec' : 'apiSpec'}, so nothing can grade{' '}
                {ungraded.length === 1 ? 'it' : 'them'} in {project.mode} mode.
              </div>
            ) : null}

            {/* One card: the ProjectTask and the Tasks that belong to it are
                one thing, and splitting them read as two unrelated panels. */}
            <Card className="overflow-hidden p-0">
              <div className="border-b px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ProjectTask
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A group of tasks worked through together.
                </p>
              </div>

              <div className="space-y-4 p-4">
                <FieldGrid>
                  <Field label="Title" htmlFor="pt-title" required>
                    <Input
                      id="pt-title"
                      value={ptDraft.title}
                      onChange={(event) => setPtDraft((d) => ({ ...d, title: event.target.value }))}
                    />
                  </Field>
                  <Field label="Slug" htmlFor="pt-slug">
                    <Input
                      id="pt-slug"
                      value={ptDraft.slug}
                      onChange={(event) => setPtDraft((d) => ({ ...d, slug: event.target.value }))}
                      className="font-mono text-sm"
                    />
                  </Field>
                </FieldGrid>

                <Field label="Summary" htmlFor="pt-summary">
                  <textarea
                    id="pt-summary"
                    value={ptDraft.summary}
                    rows={2}
                    onChange={(event) => setPtDraft((d) => ({ ...d, summary: event.target.value }))}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </Field>

                <Field label="Banner URL" htmlFor="pt-banner">
                  <Input
                    id="pt-banner"
                    value={ptDraft.banner}
                    onChange={(event) => setPtDraft((d) => ({ ...d, banner: event.target.value }))}
                  />
                </Field>

                <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span>
                    <span className="block text-sm font-medium">Premium</span>
                    <span className="block text-xs text-muted-foreground">
                      Everything inside it needs an entitlement.
                    </span>
                  </span>
                  <Switch
                    checked={ptDraft.isPremium}
                    onCheckedChange={(next) => setPtDraft((d) => ({ ...d, isPremium: next }))}
                    aria-label="Premium"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between border-y bg-muted/40 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tasks — drag to reorder
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTaskFor({ pt: selected, task: null })}
                >
                  <Plus className="mr-1.5 size-4" />
                  Add task
                </Button>
              </div>

              {selected.tasks.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">No tasks here.</p>
              ) : (
                /* Each task is its own card: a task carries a title, a type, a
                   point value and a grading contract, which is too much to read
                   as a flat row in a divided list. */
                <div className="space-y-2 p-3">
                  {selected.tasks.map((task, index) => {
                    const spec = project.mode === 'terminal' ? task.terminalSpec : task.apiSpec;
                    const links = [
                      task.videoTitle && ['video', task.videoTitle],
                      task.articleTitle && ['article', task.articleTitle],
                      task.chapterTitle && ['chapter', task.chapterTitle],
                    ].filter(Boolean) as Array<[string, string]>;

                    return (
                      <div
                        key={task.id}
                        {...taskDrag.handlers(index, selected.id)}
                        className="rounded-lg border bg-card p-3 transition-colors data-[dragover=true]:border-primary data-[dragging=true]:opacity-50"
                      >
                        <div className="flex items-start gap-2.5">
                          <GripVertical className="mt-0.5 size-4 shrink-0 cursor-grab text-muted-foreground" />
                          <span className="mt-0.5 w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                            {index + 1}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium">{task.title}</span>
                              <StatusBadge label={task.type.toLowerCase()} tone="neutral" />
                              {task.isPremium ? (
                                <StatusBadge label="premium" tone="warning" />
                              ) : null}
                              {!task.required ? (
                                <StatusBadge label="optional" tone="neutral" />
                              ) : null}
                            </div>

                            {richTextPreview(task.description) ? (
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {richTextPreview(task.description)}
                              </p>
                            ) : null}

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="tabular-nums">{task.mb} mb</span>

                              {/* Whether it can actually be graded is the thing
                                  worth seeing without opening it. */}
                              {task.type === 'TASK' ? (
                                project.mode === 'frontend' ? (
                                  <span>self-marked</span>
                                ) : spec ? (
                                  <span className="text-success">
                                    {project.mode === 'terminal'
                                      ? 'stdout checked'
                                      : `${spec && 'method' in spec ? spec.method : ''} ${
                                          spec && 'url' in spec ? spec.url : ''
                                        }`.trim()}
                                  </span>
                                ) : (
                                  <span className="text-warning">no test</span>
                                )
                              ) : null}

                              {task.type === 'QUIZ' ? (
                                <span>
                                  {task.questions.length} question
                                  {task.questions.length === 1 ? '' : 's'}
                                </span>
                              ) : null}

                              {links.map(([kind, title]) => (
                                <span key={kind} className="truncate">
                                  {kind}: {title}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${task.title}`}
                              onClick={() => setTaskFor({ pt: selected, task })}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${task.title}`}
                              onClick={() =>
                                setConfirming({
                                  label: `Remove “${task.title}”?`,
                                  run: async () => {
                                    await deleteTask(project.id, selected.id, task.id);
                                    onChanged();
                                  },
                                })
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* The ProjectTask's own actions sit at the foot of everything it
                  owns, not between its fields and its tasks. */}
              <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
                <Button size="sm" onClick={savePt} disabled={savingPt}>
                  {savingPt ? 'Saving…' : 'Save ProjectTask'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() =>
                    setConfirming({
                      label: `Delete “${selected.title}” and its tasks?`,
                      run: async () => {
                        await deleteProjectTask(project.id, selected.id);
                        setSelectedId(null);
                        onChanged();
                      },
                    })
                  }
                >
                  Delete ProjectTask
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <EmptyState
            title="No ProjectTask selected"
            description="Add one to start building the work."
          />
        )}
      </div>

      {taskFor ? (
        <TaskDialog
          open
          onOpenChange={(next) => !next && setTaskFor(null)}
          projectId={project.id}
          projectTaskId={taskFor.pt.id}
          mode={project.mode}
          task={taskFor.task}
          onSaved={onChanged}
        />
      ) : null}

      <ConfirmDelete
        open={Boolean(confirming)}
        onCancel={() => setConfirming(null)}
        title={confirming?.label ?? ''}
        description="Deletes are refused when a builder's progress depends on the row."
        onConfirm={async () => {
          const job = confirming;
          setConfirming(null);
          if (!job) return;
          try {
            await job.run();
            toast.success('Done.');
          } catch (error) {
            toast.error('Could not do that', { description: (error as Error).message });
          }
        }}
      />
    </>
  );
}

// ── builders ────────────────────────────────────────────────────────────────

function BuildersTab({ projectId }: { projectId: string }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [enrolling, setEnrolling] = useState(false);
  const [confirming, setConfirming] = useState<{ id: string; email: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-project-learners', projectId, q, page],
    queryFn: () => fetchLearners(projectId, { q: q.trim() || undefined, page, limit: 25 }),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
          placeholder="Search by name or email…"
          className="max-w-xs"
          aria-label="Search builders"
        />
        <Button size="sm" onClick={() => setEnrolling(true)}>
          <Plus className="mr-1.5 size-4" />
          Add builders
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={q ? 'Nobody matches' : 'Nobody has started this project'}
          description={q ? 'Try a different search.' : 'Add them by email.'}
        />
      ) : (
        <Card className="divide-y p-0">
          {rows.map((learner) => (
            <div key={learner.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                {/* Everything about the person lives on their user record. */}
                <Link
                  href={`/users/${learner.userId}`}
                  className="block truncate font-medium text-primary hover:underline"
                >
                  {learner.name || learner.email}
                </Link>
                <div className="truncate text-xs text-muted-foreground">{learner.email}</div>
              </div>

              <div className="w-40">
                <div className="text-xs tabular-nums text-muted-foreground">
                  {learner.done} / {learner.total} tasks
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${learner.total ? Math.round((learner.done / learner.total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Cloning the starter and running a server are separate steps. */}
              <StatusBadge
                label={learner.cloned ? 'cloned' : 'not cloned'}
                tone={learner.cloned ? 'success' : 'neutral'}
              />
              {learner.serverStatus ? (
                <StatusBadge
                  label={learner.serverStatus.toLowerCase()}
                  tone={learner.serverStatus === 'HEALTHY' ? 'success' : 'warning'}
                />
              ) : null}
              {learner.completedAt ? (
                <StatusBadge label={fmt(learner.completedAt)} tone="success" />
              ) : null}

              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${learner.email}`}
                onClick={() => setConfirming({ id: learner.id, email: learner.email })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </Card>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {pages} · {total} builder{total === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <EnrolLearnersDialog
        open={enrolling}
        onOpenChange={setEnrolling}
        projectId={projectId}
        onEnrolled={() => refetch()}
      />

      <ConfirmDelete
        open={Boolean(confirming)}
        onCancel={() => setConfirming(null)}
        title={`Remove ${confirming?.email ?? ''} from this project?`}
        description="Their progress on it goes with the enrolment."
        onConfirm={async () => {
          const job = confirming;
          setConfirming(null);
          if (!job) return;
          try {
            await removeLearner(projectId, job.id);
            toast.success('Removed.');
            refetch();
          } catch (error) {
            toast.error('Could not remove them', { description: (error as Error).message });
          }
        }}
      />
    </div>
  );
}

// ── solutions ───────────────────────────────────────────────────────────────

function SolutionsTab({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [status, setStatus] = useState('ALL');
  const [open, setOpen] = useState<Solution | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-project-solutions', projectId, status],
    queryFn: () => fetchSolutions(projectId, status === 'ALL' ? undefined : status),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          What a builder submits when they are finished. This is the thing that gets reviewed.
        </p>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing submitted" description="No solutions for this project yet." />
      ) : (
        <Card className="divide-y p-0">
          {rows.map((solution) => (
            <button
              key={solution.id}
              type="button"
              className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
              onClick={() => setOpen(solution)}
            >
              <StatusBadge
                label={solution.status.toLowerCase()}
                tone={
                  solution.status === 'APPROVED'
                    ? 'success'
                    : solution.status === 'REJECTED'
                      ? 'danger'
                      : 'warning'
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{solution.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[solution.name, solution.repository.replace(/^https?:\/\//, '')]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {solution.score ? `${solution.score} / 100` : 'unscored'}
              </span>
              <span className="text-xs text-muted-foreground">{fmt(solution.submittedAt)}</span>
            </button>
          ))}
        </Card>
      )}

      <SolutionDialog
        open={Boolean(open)}
        onOpenChange={(next) => !next && setOpen(null)}
        projectId={projectId}
        solution={open}
        onReviewed={() => {
          refetch();
          onChanged();
        }}
      />
    </div>
  );
}
