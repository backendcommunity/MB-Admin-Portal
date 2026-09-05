'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { Stat, StatRow } from '@/components/shared/Stat';
import { TabBar } from '@/components/shared/TabBar';
import { Section } from '@/components/shared/form/Section';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  IdentityFields,
  RoleFields,
  InterviewFields,
} from '@/components/mock-interviews/fields/TemplateFields';
import { TopicsField } from '@/components/mock-interviews/fields/TopicsField';
import { RubricEditor } from '@/components/mock-interviews/fields/RubricEditor';
import { fetchTemplate, updateTemplate, type TemplateInput } from '@/lib/api/mockInterviews';

const TABS = [
  ['overview', 'Overview'],
  ['interview', 'Interview'],
  ['content', 'Content'],
  ['attempts', 'Attempts'],
  ['origin', 'Origin'],
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

function pct(n: number | null) {
  return n === null || n === undefined ? '—' : `${n}%`;
}

function num(n: number | null) {
  return n === null || n === undefined ? '—' : String(n);
}

/**
 * Everything a client may write, mirrored from the query into local state.
 * Reset on an effect keyed by the row's id — a background refetch of the
 * same template must not clobber an edit in progress.
 */
function toDraft(data: TemplateInput): TemplateInput {
  return {
    name: data.name ?? '',
    summary: data.summary ?? '',
    description: data.description ?? '',
    company: data.company ?? '',
    position: data.position ?? '',
    seniority: data.seniority ?? '',
    style: data.style ?? 'Technical',
    format: data.format ?? 'Chat',
    category: data.category ?? '',
    difficulty: data.difficulty ?? 'Medium',
    duration: data.duration ?? 0,
    questions: data.questions ?? null,
    topics: data.topics ?? [],
    evaluationRubric: data.evaluationRubric ?? [],
    isPublic: data.isPublic ?? false,
  };
}

export default function TemplateDetailClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const templateId = params.id;
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.userRole);
  const authResolved = useAuthStore((s) => s.authResolved);
  // Fail closed: until the session check lands, treat the caller as unable
  // to publish rather than trusting a possibly-stale cached role.
  const canPublish = authResolved && (role === 'ADMIN' || role === 'SUPER_ADMIN');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-mock-interview', templateId],
    queryFn: () => fetchTemplate(templateId),
  });

  const [tab, setTab] = useState<TabId>('overview');
  const [form, setForm] = useState<TemplateInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Keyed on the id, not on `data` itself: `data` gets a new object identity
  // on every refetch (a background window-focus refetch, or the refetch this
  // component's own Save/Publish trigger) even when it's the same record. An
  // effect keyed on `data` would reseed `form` from the server on every one
  // of those and silently discard whatever the admin was mid-typing. Keying
  // on the id means this only re-seeds when the record actually changes.
  useEffect(() => {
    if (data) setForm(toDraft(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  const patch = (next: TemplateInput) => setForm((current) => ({ ...(current ?? {}), ...next }));

  if (isLoading) return <LoadingState label="Loading template…" />;
  if (isError || !data || !form) return <ErrorState onRetry={() => refetch()} />;

  const tabs = TABS.filter(([id]) => id !== 'origin' || data.isCustom).map(
    ([id, label]) => [id, id === 'attempts' ? `Attempts (${data.attemptCount})` : label] as const,
  );

  const save = async () => {
    setSaving(true);
    try {
      // Sync `form` from what the server actually wrote, not from whatever
      // this render still holds — the seeding effect above is deliberately
      // keyed on the id alone (see its comment) so a background refetch
      // can't clobber an in-progress edit, but that also means it will
      // NOT re-run after this save's own refetch, even though the id is
      // unchanged. Without this line, any server-side coercion or
      // trimming of what was sent (or the same isPublic-drift shape
      // Publish had) would silently go unreflected in `form`, and a
      // second Save would ship stale values the server never returned.
      const updated = await updateTemplate(templateId, form);
      setForm(toDraft(updated));
      queryClient.invalidateQueries({ queryKey: ['admin-mock-interviews'] });
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

  /**
   * Publish sends the whole current `form`, not just `{ isPublic }`.
   *
   * The alternative — leaving Publish scoped to the flag alone — has to
   * either disable the button while the form is dirty (so publishing after
   * an edit takes two separate clicks and a trip to Save first) or silently
   * drop the unsaved edit on the refetch that follows, which is the exact
   * data-loss bug this replaces. Folding the save into Publish means the
   * button does what it looks like it does — "make this live, as it stands
   * right now" — in one action, with no separate dirty-state gate to get
   * wrong.
   */
  const togglePublish = async () => {
    setPublishing(true);
    try {
      // Same reasoning as `save` above: sync `form` from the server's own
      // response rather than leaving it to the (now id-keyed, so it won't
      // re-fire here) seeding effect. Without this, `form.isPublic` stays
      // frozen at its pre-publish value — invisible, since the header badge
      // reads `data.isPublic` — and the next unrelated Save ships that stale
      // flag and silently flips the template back to draft.
      const updated = await updateTemplate(templateId, { ...form, isPublic: !data.isPublic });
      setForm(toDraft(updated));
      queryClient.invalidateQueries({ queryKey: ['admin-mock-interviews'] });
      await refetch();
      toast.success(data.isPublic ? 'Unpublished.' : 'Published.');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (error as Error).message;
      toast.error('Could not change the publish state', { description: message });
    } finally {
      setPublishing(false);
    }
  };

  const stats = data.attempts.stats;
  const recent = data.attempts.recent;

  return (
    <div>
      <p className="mb-1 text-sm text-muted-foreground">
        <Link href="/mock-interviews" className="text-primary hover:underline">
          Mock Interviews
        </Link>{' '}
        / {data.name}
      </p>

      <PageHeader
        title={data.name}
        description={data.summary || undefined}
        badge={
          <StatusBadge
            label={data.isPublic ? 'Published' : 'Draft'}
            tone={data.isPublic ? 'success' : 'warning'}
          />
        }
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => router.push('/mock-interviews')}
              disabled={saving || publishing}
            >
              Back
            </Button>
            <Button onClick={save} disabled={saving || publishing}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />

      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <div className="space-y-4">
          <Section title="Identity">
            <IdentityFields value={form} onChange={patch} disabled={saving || publishing} />
          </Section>

          <Section title="Role">
            <RoleFields value={form} onChange={patch} disabled={saving || publishing} />
          </Section>

          <Section title="Access">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Added by {data.addedBy ?? 'the platform'} · Created {fmt(data.createdAt)}
                </p>
                <p className="text-xs text-muted-foreground">ID: {data.id}</p>
              </div>
              {canPublish ? (
                <Button variant="outline" onClick={togglePublish} disabled={publishing || saving}>
                  {publishing ? 'Working…' : data.isPublic ? 'Unpublish' : 'Publish'}
                </Button>
              ) : (
                <div className="text-right">
                  <Button variant="outline" disabled>
                    Submit for review
                  </Button>
                  <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                    An admin publishes — the flag is refused server-side, not merely hidden here.
                  </p>
                </div>
              )}
            </div>
          </Section>
        </div>
      ) : null}

      {tab === 'interview' ? (
        <Section title="Interview">
          <InterviewFields value={form} onChange={patch} disabled={saving || publishing} />
        </Section>
      ) : null}

      {tab === 'content' ? (
        <div className="space-y-4">
          <Section title="Topics">
            <TopicsField
              value={form.topics ?? []}
              onChange={(topics) => patch({ topics })}
              disabled={saving || publishing}
            />
          </Section>

          <Section title="Evaluation rubric">
            <RubricEditor
              value={form.evaluationRubric ?? []}
              onChange={(evaluationRubric) => patch({ evaluationRubric })}
              disabled={saving || publishing}
            />
          </Section>
        </div>
      ) : null}

      {tab === 'attempts' ? (
        <div className="space-y-4">
          <StatRow>
            <Stat label="Total" value={num(stats.total)} />
            <Stat label="Completed" value={num(stats.completed)} />
            <Stat label="Completion rate" value={pct(stats.completionRate)} />
            <Stat label="Average score" value={num(stats.averageScore)} />
          </StatRow>

          {recent.length === 0 ? (
            <EmptyState
              title="No attempts yet"
              description="No learner has attempted this template yet — it can be safely deleted."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Candidate</th>
                    {recent.some((a) => a.candidate.email !== undefined) ? (
                      <th className="px-3 py-2">Email</th>
                    ) : null}
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((attempt) => (
                    <tr key={attempt.id} className="border-t">
                      <td className="px-3 py-2">{attempt.candidate.name}</td>
                      {recent.some((a) => a.candidate.email !== undefined) ? (
                        <td className="px-3 py-2">{attempt.candidate.email ?? '—'}</td>
                      ) : null}
                      <td className="px-3 py-2">{attempt.status}</td>
                      <td className="px-3 py-2 tabular-nums">{num(attempt.score)}</td>
                      <td className="px-3 py-2">{fmt(attempt.completedAt ?? attempt.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'origin' && data.isCustom ? (
        <Section title="Origin">
          <StatusBadge label="Custom · learner JD" tone="info" />
          <pre className="mt-3 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs">
            {data.sourceJd}
          </pre>
        </Section>
      ) : null}
    </div>
  );
}
