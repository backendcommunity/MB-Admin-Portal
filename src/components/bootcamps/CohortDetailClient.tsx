'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/PageHeader';
import { Stat, StatRow } from '@/components/shared/Stat';
import { TabBar } from '@/components/shared/TabBar';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import CohortFormDialog from '@/components/bootcamps/CohortFormDialog';
import LessonDialog from '@/components/bootcamps/LessonDialog';
import EventDialog from '@/components/bootcamps/EventDialog';
import BonusDialog from '@/components/bootcamps/BonusDialog';
import AddStudentsDialog from '@/components/bootcamps/AddStudentsDialog';
import { useDragReorder, moved } from '@/lib/courses/useDragReorder';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import {
  createWeek,
  deleteBonus,
  deleteEvent,
  deleteLesson,
  deleteWeek,
  fetchBonuses,
  fetchCohort,
  fetchEvents,
  fetchMembers,
  removeMember,
  reorderLessons,
  reorderWeeks,
  updateWeek,
  type Bonus,
  type BootcampEvent,
  type CohortMember,
  type Lesson,
  type Week,
} from '@/lib/api/bootcamps';

const TABS = [
  ['curriculum', 'Curriculum'],
  ['schedule', 'Schedule'],
  ['students', 'Students'],
  ['bonuses', 'Bonuses'],
] as const;

type TabId = (typeof TABS)[number][0];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function fmtClock(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

function eventTone(status: string): 'success' | 'neutral' | 'info' | 'warning' | 'danger' {
  if (status === 'COMPLETED') return 'neutral';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'RESCHEDULED') return 'warning';
  return 'success';
}

export default function CohortDetailClient() {
  const router = useRouter();
  const params = useParams<{ id: string; cohortId: string }>();
  const bootcampId = params.id;
  const cohortId = params.cohortId;

  const cohortQuery = useQuery({
    queryKey: ['admin-cohort', cohortId],
    queryFn: () => fetchCohort(cohortId),
  });
  const cohort = cohortQuery.data;
  const weeks = useMemo(() => cohort?.weeks ?? [], [cohort]);

  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  // Keep a valid selection as weeks come and go, without a setState-in-effect
  // round trip: the first week stands in until one is chosen.
  const selectedWeek = weeks.find((week) => week.id === selectedWeekId) ?? weeks[0] ?? null;

  const [editingCohort, setEditingCohort] = useState(false);
  const [tab, setTab] = useState<TabId>('curriculum');
  // Keyed on the week's stored content, so switching weeks refills the fields
  // and a save that changed nothing does not wipe what is being typed.
  const [weekDraft, setWeekDraft] = useSeededForm(
    selectedWeek ? `${selectedWeek.id}:${selectedWeek.title}:${selectedWeek.summary}` : 'none',
    () => ({ title: selectedWeek?.title ?? '', summary: selectedWeek?.summary ?? '' }),
  );
  const [savingWeek, setSavingWeek] = useState(false);
  const [lessonFor, setLessonFor] = useState<{ week: Week; lesson: Lesson | null } | null>(null);
  const [confirming, setConfirming] = useState<{ label: string; run: () => Promise<void> } | null>(
    null,
  );

  const weekDrag = useDragReorder({
    onReorder: async (from, to) => {
      const next = moved(weeks, from, to);
      // Paint the new order immediately, then let the refetch confirm it.
      await reorderWeeks(
        cohortId,
        next.map((week) => week.id),
      );
      await cohortQuery.refetch();
      toast.success('Weeks reordered.');
    },
  });

  const lessonDrag = useDragReorder({
    onReorder: async (from, to, scope) => {
      const week = weeks.find((row) => row.id === scope);
      if (!week) return;
      const next = moved(week.lessons, from, to);
      await reorderLessons(
        cohortId,
        week.id,
        next.map((lesson) => lesson.id),
      );
      await cohortQuery.refetch();
      toast.success('Lessons reordered.');
    },
  });

  const saveWeek = async () => {
    if (!selectedWeek || !weekDraft.title.trim()) return;
    setSavingWeek(true);
    try {
      await updateWeek(cohortId, selectedWeek.id, weekDraft);
      await cohortQuery.refetch();
      toast.success('Week saved.');
    } catch (error) {
      toast.error('Could not save the week', { description: (error as Error).message });
    } finally {
      setSavingWeek(false);
    }
  };

  const addWeek = async () => {
    try {
      const week = await createWeek(cohortId, {
        title: `Week ${weeks.length + 1} — Untitled`,
      });
      setSelectedWeekId(week.id);
      await cohortQuery.refetch();
    } catch (error) {
      toast.error('Could not add the week', { description: (error as Error).message });
    }
  };

  const guard = (label: string, run: () => Promise<void>) => setConfirming({ label, run });

  if (cohortQuery.isLoading) return <LoadingState />;
  if (cohortQuery.isError || !cohort) return <ErrorState onRetry={() => cohortQuery.refetch()} />;

  const seatsLeft =
    cohort.maxStudent > 0 ? Math.max(0, cohort.maxStudent - (cohort.studentCount ?? 0)) : null;

  const lessonCount = weeks.reduce((n, week) => n + week.lessons.length, 0);
  const pointTotal = weeks.reduce(
    (n, week) => n + week.lessons.reduce((m, lesson) => m + (lesson.mb || 0), 0),
    0,
  );

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/bootcamps" className="hover:text-foreground hover:underline">
          Bootcamps
        </Link>{' '}
        /{' '}
        <Link href={`/bootcamps/${bootcampId}`} className="hover:text-foreground hover:underline">
          {cohort.bootcamp.title}
        </Link>{' '}
        / {cohort.name}
      </p>

      <PageHeader
        title={cohort.name}
        description={`${fmtDate(cohort.startsAt)}${
          cohort.endsAt ? ` – ${fmtDate(cohort.endsAt)}` : ''
        } · ${cohort.amount ? cohort.amount.toLocaleString() : 'Free'} · capacity ${
          cohort.maxStudent || '∞'
        }`}
        actions={
          <>
            <StatusBadge
              label={cohort.status}
              tone={
                cohort.status === 'OPEN'
                  ? 'success'
                  : cohort.status === 'STARTED'
                    ? 'info'
                    : 'neutral'
              }
            />
            <Button variant="outline" onClick={() => router.push(`/bootcamps/${bootcampId}`)}>
              Bootcamp
            </Button>
            <Button onClick={() => setEditingCohort(true)}>Edit cohort</Button>
          </>
        }
      />

      <StatRow>
        <Stat label="weeks" value={String(weeks.length)} />
        <Stat label="lessons" value={String(lessonCount)} />
        <Stat label="learners" value={String(cohort.studentCount ?? 0)} />
        <Stat label="points" value={pointTotal.toLocaleString()} />
        <Stat label="bonuses" value={String(cohort.bonusCount ?? 0)} />
      </StatRow>

      <TabBar tabs={TABS} value={tab} onChange={setTab} />

      {/* ── curriculum ───────────────────────────────────────────────── */}
      {tab === 'curriculum' ? (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="h-fit p-0">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Weeks
              </span>
              <Button variant="ghost" size="sm" onClick={addWeek}>
                <Plus className="size-4" />
              </Button>
            </div>

            {weeks.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No weeks yet. This cohort has no curriculum.
              </p>
            ) : (
              <div className="p-1.5">
                {weeks.map((week, index) => (
                  <button
                    key={week.id}
                    type="button"
                    {...weekDrag.handlers(index, 'weeks')}
                    onClick={() => setSelectedWeekId(week.id)}
                    aria-current={week.id === selectedWeek?.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted data-[dragover=true]:ring-1 data-[dragover=true]:ring-primary aria-[current=true]:bg-muted"
                  >
                    <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{week.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {week.lessons.length} lesson{week.lessons.length === 1 ? '' : 's'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {selectedWeek ? (
            <div className="space-y-4">
              <Card className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="week-title">Title</Label>
                    <Input
                      id="week-title"
                      value={weekDraft.title}
                      onChange={(event) =>
                        setWeekDraft((d) => ({ ...d, title: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="week-summary">Summary</Label>
                    <Input
                      id="week-summary"
                      value={weekDraft.summary}
                      onChange={(event) =>
                        setWeekDraft((d) => ({ ...d, summary: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Position in the spine is the week&apos;s order — drag to change it.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveWeek} disabled={savingWeek}>
                    {savingWeek ? 'Saving…' : 'Save week'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      guard(`Delete “${selectedWeek.title}” and its lessons?`, async () => {
                        await deleteWeek(cohortId, selectedWeek.id);
                        setSelectedWeekId(null);
                        await cohortQuery.refetch();
                      })
                    }
                  >
                    Delete week
                  </Button>
                </div>
              </Card>

              <Card className="p-0">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Lessons — the order the week is worked through
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLessonFor({ week: selectedWeek, lesson: null })}
                  >
                    <Plus className="mr-1.5 size-4" />
                    Add lesson
                  </Button>
                </div>

                {selectedWeek.lessons.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    No lessons in this week.
                  </p>
                ) : (
                  <div className="divide-y">
                    {selectedWeek.lessons.map((lesson, index) => (
                      <div
                        key={lesson.id}
                        {...lessonDrag.handlers(index, selectedWeek.id)}
                        className="flex items-center gap-2 px-4 py-2.5 data-[dragover=true]:bg-muted"
                      >
                        <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{lesson.title}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {lesson.type.toLowerCase()}
                            {lesson.itemTitle ? ` · ${lesson.itemTitle}` : ''}
                            {lesson.mb ? ` · ${lesson.mb} mb` : ''}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${lesson.title}`}
                          onClick={() => setLessonFor({ week: selectedWeek, lesson })}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${lesson.title}`}
                          onClick={() =>
                            guard(`Remove “${lesson.title}”?`, async () => {
                              await deleteLesson(cohortId, selectedWeek.id, lesson.id);
                              await cohortQuery.refetch();
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <EmptyState
              title="No week selected"
              description="Add a week to start building this cohort's curriculum."
            />
          )}
        </div>
      ) : null}

      {tab === 'schedule' ? (
        <SchedulePane cohortId={cohortId} weeks={weeks} onGuard={guard} />
      ) : null}

      {tab === 'students' ? (
        <StudentsPane
          cohortId={cohortId}
          seatsLeft={seatsLeft}
          onGuard={guard}
          onChanged={() => cohortQuery.refetch()}
        />
      ) : null}

      {tab === 'bonuses' ? <BonusesPane cohortId={cohortId} onGuard={guard} /> : null}

      <CohortFormDialog
        open={editingCohort}
        onOpenChange={setEditingCohort}
        bootcampId={bootcampId}
        cohort={cohort}
        onSaved={() => cohortQuery.refetch()}
      />

      {lessonFor ? (
        <LessonDialog
          open
          onOpenChange={(next) => !next && setLessonFor(null)}
          cohortId={cohortId}
          weekId={lessonFor.week.id}
          lesson={lessonFor.lesson}
          onSaved={() => cohortQuery.refetch()}
        />
      ) : null}

      <ConfirmDelete
        open={Boolean(confirming)}
        onCancel={() => setConfirming(null)}
        title={confirming?.label ?? ''}
        description="Deletes are refused when a learner's progress depends on the row."
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
    </div>
  );
}

// ── schedule ────────────────────────────────────────────────────────────────

function SchedulePane({
  cohortId,
  weeks,
  onGuard,
}: {
  cohortId: string;
  weeks: Week[];
  onGuard: (label: string, run: () => Promise<void>) => void;
}) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-cohort-events', cohortId],
    queryFn: () => fetchEvents(cohortId),
  });
  const [editing, setEditing] = useState<BootcampEvent | null>(null);
  const [creating, setCreating] = useState(false);

  const events = data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Live sessions for this cohort. Two sessions in the same cohort cannot overlap.
        </p>
        <Button size="sm" onClick={() => setCreating(true)} disabled={weeks.length === 0}>
          <Plus className="mr-1.5 size-4" />
          Schedule event
        </Button>
      </div>

      {weeks.length === 0 ? (
        <EmptyState
          title="Add a week first"
          description="An event belongs to a week, so there is nothing to hang one on yet."
        />
      ) : isLoading ? (
        <LoadingState />
      ) : events.length === 0 ? (
        <EmptyState title="Nothing scheduled" description="No sessions for this cohort yet." />
      ) : (
        <Card className="divide-y p-0">
          {events.map((event) => (
            <div key={event.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="w-14 shrink-0 rounded-lg bg-muted py-1.5 text-center">
                <div className="text-lg font-semibold leading-none">
                  {new Date(event.eventDate).getUTCDate()}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {new Date(event.eventDate).toLocaleDateString(undefined, {
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{event.title}</div>
                <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {fmtClock(event.startTime)}–{fmtClock(event.endTime)} {event.timezone}
                  </span>
                  <span>{event.eventType.replace(/_/g, ' ').toLowerCase()}</span>
                  {event.weekTitle ? <span>{event.weekTitle}</span> : null}
                  {event.lessonTitle ? <span>· {event.lessonTitle}</span> : null}
                </div>
              </div>

              <StatusBadge label={event.status.toLowerCase()} tone={eventTone(event.status)} />
              <Button variant="ghost" size="sm" onClick={() => setEditing(event)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${event.title}`}
                onClick={() =>
                  onGuard(`Remove “${event.title}”?`, async () => {
                    await deleteEvent(cohortId, event.id);
                    await refetch();
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </Card>
      )}

      <EventDialog
        open={creating || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        cohortId={cohortId}
        weeks={weeks}
        event={editing}
        onSaved={() => refetch()}
      />
    </div>
  );
}

// ── students ────────────────────────────────────────────────────────────────

function StudentsPane({
  cohortId,
  seatsLeft,
  onGuard,
  onChanged,
}: {
  cohortId: string;
  seatsLeft: number | null;
  onGuard: (label: string, run: () => Promise<void>) => void;
  onChanged: () => void;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-cohort-members', cohortId, q, page],
    queryFn: () => fetchMembers(cohortId, { q: q.trim() || undefined, page, limit: 25 }),
  });

  const rows: CohortMember[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));
  // The roster carries the spine, so a currentWeekId reads as "Week 3".
  const weekPosition = new Map((data?.weeks ?? []).map((week) => [week.id, week.position]));
  const lessonTotal = data?.lessonTotal ?? 0;

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
          aria-label="Search learners"
        />
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1.5 size-4" />
          Add learners
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={q ? 'Nobody matches' : 'No learners yet'}
          description={q ? 'Try a different search.' : 'Add them by email.'}
        />
      ) : (
        <Card className="divide-y p-0">
          {rows.map((member) => {
            const position = member.currentWeekId
              ? weekPosition.get(member.currentWeekId)
              : undefined;
            const done = member.lessonsDone ?? 0;
            const pct = lessonTotal ? Math.round((done / lessonTotal) * 100) : 0;
            return (
              <div key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{member.name || member.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                </div>

                <span className="w-20 text-xs text-muted-foreground">
                  {position ? `Week ${position}` : 'Not started'}
                </span>

                <div className="w-40">
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {done} / {lessonTotal} lessons
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                  {member.score} pts
                </span>
                {member.completed ? <StatusBadge label="completed" tone="success" /> : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${member.email}`}
                  onClick={() =>
                    onGuard(`Remove ${member.email} from this cohort?`, async () => {
                      await removeMember(cohortId, member.id);
                      await refetch();
                      onChanged();
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {pages} · {total} learner{total === 1 ? '' : 's'}
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

      <AddStudentsDialog
        open={adding}
        onOpenChange={setAdding}
        cohortId={cohortId}
        seatsLeft={seatsLeft}
        onSaved={() => {
          refetch();
          onChanged();
        }}
      />
    </div>
  );
}

// ── bonuses ─────────────────────────────────────────────────────────────────

function BonusesPane({
  cohortId,
  onGuard,
}: {
  cohortId: string;
  onGuard: (label: string, run: () => Promise<void>) => void;
}) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-cohort-bonuses', cohortId],
    queryFn: () => fetchBonuses(cohortId),
  });
  const [editing, setEditing] = useState<Bonus | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Extras for this cohort. Each one points at a course, a resource or a video.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 size-4" />
          Add bonus
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState title="No bonuses" description="Nothing extra for this cohort yet." />
      ) : (
        <Card className="divide-y p-0">
          {rows.map((bonus) => (
            <div key={bonus.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <StatusBadge label={bonus.kind ?? 'unset'} tone="info" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{bonus.itemTitle || 'Nothing chosen'}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[bonus.topic, bonus.summary].filter(Boolean).join(' · ') ||
                    'No topic or summary'}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(bonus)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${bonus.itemTitle || 'bonus'}`}
                onClick={() =>
                  onGuard(`Remove “${bonus.itemTitle || 'this bonus'}”?`, async () => {
                    await deleteBonus(cohortId, bonus.id);
                    await refetch();
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </Card>
      )}

      <BonusDialog
        open={creating || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        cohortId={cohortId}
        bonus={editing}
        onSaved={() => refetch()}
      />
    </div>
  );
}
