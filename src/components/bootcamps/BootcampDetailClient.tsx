'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MediaField } from '@/components/shared/form/MediaField';
import { Field, FieldGrid, Section } from '@/components/shared/form/Section';
import { Stat, StatRow } from '@/components/shared/Stat';
import { TabBar } from '@/components/shared/TabBar';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import CohortFormDialog from '@/components/bootcamps/CohortFormDialog';
import AssignmentsQueue from '@/components/bootcamps/AssignmentsQueue';
import { useAuthStore } from '@/store/authStore';
import { submitForReview } from '@/lib/api/instructor';
import {
  fetchBootcamp,
  updateBootcamp,
  LEVELS,
  type BootcampTopic,
  type Cohort,
} from '@/lib/api/bootcamps';

/**
 * `GET /admin/bootcamps/:id` does not currently return `isWaiting` or
 * `waitingLink` (the row shape omits them even though the model has both),
 * so — unlike course/path/project/offer — there is no real signal here to
 * derive Draft/In review/Changes requested/Published from. What IS true and
 * safe to show is "you just submitted this" for the rest of the session; it
 * intentionally does not survive a reload, rather than claim a persisted
 * status the API cannot back up.
 */
function BootcampReviewAction({ bootcampId }: { bootcampId: string }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle');

  if (status === 'submitted') {
    return <StatusBadge label="Submitted for review" tone="info" />;
  }

  const submit = async () => {
    setStatus('submitting');
    try {
      await submitForReview('bootcamp', bootcampId);
      toast.success('Submitted for review.');
      setStatus('submitted');
    } catch (error) {
      toast.error('Could not submit', {
        description:
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (error as Error).message,
      });
      setStatus('idle');
    }
  };

  return (
    <Button variant="outline" onClick={submit} disabled={status === 'submitting'}>
      {status === 'submitting' ? 'Submitting…' : 'Submit for review'}
    </Button>
  );
}

const TABS = [
  ['overview', 'Overview'],
  ['cohorts', 'Cohorts'],
  ['assignments', 'Assignments'],
] as const;

type TabId = (typeof TABS)[number][0];

function statusTone(status: string): 'success' | 'neutral' | 'info' | 'warning' {
  if (status === 'OPEN') return 'success';
  if (status === 'STARTED') return 'info';
  return 'neutral';
}

function levelTone(level: string): 'success' | 'info' | 'warning' | 'neutral' {
  if (level === 'Beginner') return 'success';
  if (level === 'Intermediate') return 'info';
  if (level === 'Advanced') return 'warning';
  return 'neutral';
}

function fmt(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function BootcampDetailClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const bootcampId = params.id;
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.userRole);
  const authResolved = useAuthStore((s) => s.authResolved);
  // Fail closed: until the session check lands, treat the caller as non-staff
  // rather than trusting a possibly-stale cached role (see SuperAdminOnly).
  const isStaff = authResolved && (role === 'ADMIN' || role === 'SUPER_ADMIN');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-bootcamp', bootcampId],
    queryFn: () => fetchBootcamp(bootcampId),
  });

  // Keyed on the saved content, so a refetch that changed nothing does not
  // throw away what is being typed.
  const serverKey = data
    ? JSON.stringify([data.title, data.slug, data.summary, data.banner, data.level, data.topics])
    : 'none';
  const [draft, setDraft] = useSeededForm(serverKey, () => ({
    title: data?.title ?? '',
    slug: data?.slug ?? '',
    summary: data?.summary ?? '',
    banner: data?.banner ?? '',
    level: data?.level || 'Beginner',
  }));
  const [topics, setTopics] = useSeededForm<BootcampTopic[]>(serverKey, () => data?.topics ?? []);
  const [saving, setSaving] = useState(false);
  const [newCohort, setNewCohort] = useState(false);
  const [tab, setTab] = useState<TabId>('overview');

  const dirty = useMemo(() => {
    if (!data) return false;
    return (
      draft.title !== data.title ||
      draft.slug !== data.slug ||
      draft.summary !== data.summary ||
      draft.banner !== data.banner ||
      draft.level !== (data.level || 'Beginner') ||
      JSON.stringify(topics) !== JSON.stringify(data.topics ?? [])
    );
  }, [data, draft, topics]);

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error('A bootcamp needs a title.');
      return;
    }
    setSaving(true);
    try {
      await updateBootcamp(bootcampId, {
        ...draft,
        // Blank rows are a half-typed topic, not data worth storing.
        topics: topics.filter((topic) => (topic.title ?? '').trim()),
      });
      toast.success('Saved.');
      refetch();
      // Same cache-staleness issue as the table's create path: the list lives
      // on a different query than this page's, so a title/level change here
      // needs its own invalidation to show up without a hard reload.
      queryClient.invalidateQueries({ queryKey: ['admin-bootcamps'] });
    } catch (error) {
      toast.error('Could not save', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const lessonTotal = data.cohorts.reduce((n, c) => n + (c.lessonCount ?? 0), 0);
  const learnerTotal = data.cohorts.reduce((n, c) => n + (c.studentCount ?? 0), 0);

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/bootcamps" className="hover:text-foreground hover:underline">
          Bootcamps
        </Link>{' '}
        / {data.title || 'Untitled bootcamp'}
      </p>

      <PageHeader
        title={data.title || 'Untitled bootcamp'}
        description={`${data.slug} · ${data.cohorts.length} cohort${data.cohorts.length === 1 ? '' : 's'}`}
        actions={
          <>
            <StatusBadge label={data.level || '—'} tone={levelTone(data.level)} />
            {isStaff ? null : <BootcampReviewAction bootcampId={bootcampId} />}
            <Button variant="outline" onClick={() => router.push('/bootcamps')}>
              Back
            </Button>
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      />

      <StatRow>
        <Stat label="cohorts" value={String(data.cohorts.length)} />
        <Stat label="learners" value={learnerTotal.toLocaleString()} />
        <Stat label="lessons" value={String(lessonTotal)} />
        <Stat label="topics" value={String(topics.length)} />
      </StatRow>

      <TabBar tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <Section title="Identity" id="section-identity">
              <Field label="Title" htmlFor="bc-title" required>
                <Input
                  id="bc-title"
                  value={draft.title}
                  onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
                  placeholder="Node.js Backend Engineering Bootcamp"
                />
              </Field>

              <FieldGrid>
                <Field
                  label="Slug"
                  htmlFor="bc-slug"
                  hint="Not unique in the schema, so the API picks a free variant rather than letting two bootcamps collide."
                >
                  <Input
                    id="bc-slug"
                    value={draft.slug}
                    onChange={(event) => setDraft((d) => ({ ...d, slug: event.target.value }))}
                    className="font-mono text-sm"
                  />
                </Field>

                <Field
                  label="Level"
                  htmlFor="bc-level"
                  required
                  hint="Stored in a fixed-width column, so it reads back space-padded and is trimmed here."
                >
                  <Select
                    value={draft.level}
                    onValueChange={(value) => setDraft((d) => ({ ...d, level: value }))}
                  >
                    <SelectTrigger id="bc-level">
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
              </FieldGrid>

              <div className="space-y-1.5">
                <Label htmlFor="bc-summary">Summary</Label>
                {/* Plain text, not rich text: the learner page prints this
                    straight into JSX, so markup would show as literal tags. */}
                <textarea
                  id="bc-summary"
                  value={draft.summary}
                  onChange={(event) => setDraft((d) => ({ ...d, summary: event.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  placeholder="Build and ship a production Node service, week by week, with a cohort."
                />
                <p className="text-xs text-muted-foreground">
                  Shown on the bootcamp card and its page, as plain text.
                </p>
              </div>
            </Section>

            <Section title="Media" id="section-media">
              <MediaField
                value={draft.banner}
                onChange={(next) => setDraft((d) => ({ ...d, banner: next }))}
                label="Banner"
                scope="bootcamp-banner"
                ownerId={bootcampId}
                required
                hint="Required by the schema, so there is no title-only draft."
              />
            </Section>

            <Section title="Topics" id="section-topics">
              <p className="text-xs text-muted-foreground">
                What the bootcamp covers, shown on its public page. Each topic is a title and a
                summary, not a plain tag.
              </p>

              {topics.length === 0 ? (
                <p className="text-sm text-muted-foreground">No topics yet.</p>
              ) : (
                <div className="space-y-2">
                  {topics.map((topic, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="w-4 shrink-0 pt-2.5 text-xs tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <Input
                          value={topic.title}
                          onChange={(event) =>
                            setTopics((list) =>
                              list.map((t, i) =>
                                i === index ? { ...t, title: event.target.value } : t,
                              ),
                            )
                          }
                          placeholder="Title"
                          aria-label={`Topic ${index + 1} title`}
                        />
                        <Input
                          value={topic.summary}
                          onChange={(event) =>
                            setTopics((list) =>
                              list.map((t, i) =>
                                i === index ? { ...t, summary: event.target.value } : t,
                              ),
                            )
                          }
                          placeholder="Summary"
                          aria-label={`Topic ${index + 1} summary`}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove topic ${index + 1}`}
                        onClick={() => setTopics((list) => list.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setTopics((list) => [...list, { title: '', summary: '' }])}
              >
                <Plus className="mr-1.5 size-4" />
                Add topic
              </Button>
            </Section>

            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Section title="Where the content lives">
              <p className="break-words text-xs leading-relaxed text-muted-foreground">
                A bootcamp holds identity only. Weeks, lessons, schedule and students all belong to
                a cohort, which sits above the curriculum.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setTab('cohorts')}
              >
                Open cohorts
              </Button>
            </Section>
          </aside>
        </div>
      ) : null}

      {tab === 'cohorts' ? (
        <Card className="overflow-hidden p-0">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cohorts
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Each cohort has its own dates, price, capacity — and its own curriculum. Open one to
                build it.
              </p>
            </div>
            <Button size="sm" onClick={() => setNewCohort(true)}>
              <Plus className="mr-1.5 size-4" />
              New cohort
            </Button>
          </div>

          {data.cohorts.length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent"
              title="No cohorts"
              description="Nobody can join, and there is nowhere to put a curriculum."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted">
                  <tr>
                    {['Cohort', 'Runs', 'Curriculum', 'Price', 'Capacity', 'Status', ''].map(
                      (head) => (
                        <th
                          key={head}
                          className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
                        >
                          {head}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.cohorts.map((cohort: Cohort) => (
                    <tr
                      key={cohort.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => router.push(`/bootcamps/${bootcampId}/cohorts/${cohort.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{cohort.name}</div>
                        {cohort.studyGroupLink ? (
                          <div className="text-xs text-muted-foreground">study group linked</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {fmt(cohort.startsAt)} → {fmt(cohort.endsAt)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                        {cohort.weekCount ?? 0} wk · {cohort.lessonCount ?? 0} lessons
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="tabular-nums">
                          {cohort.amount ? cohort.amount.toLocaleString() : 'Free'}
                        </span>
                        {cohort.allowsSubscription ? (
                          <StatusBadge label="sub" tone="neutral" className="ml-1.5" />
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm tabular-nums text-muted-foreground">
                          {cohort.studentCount ?? 0} / {cohort.maxStudent || '∞'}
                        </div>
                        {/* A bar, because "38 / 40" and "4 / 40" read the same
                            at a glance and mean different things. */}
                        {cohort.maxStudent > 0 ? (
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round(
                                    ((cohort.studentCount ?? 0) / cohort.maxStudent) * 100,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={cohort.status} tone={statusTone(cohort.status)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm">
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'assignments' ? <AssignmentsQueue bootcampId={bootcampId} /> : null}

      <CohortFormDialog
        open={newCohort}
        onOpenChange={setNewCohort}
        bootcampId={bootcampId}
        onSaved={() => refetch()}
      />
    </div>
  );
}
