import { axiosInstance } from '@/lib/api/axios';

/**
 * The admin bootcamp surface.
 *
 * The shape that matters: a BOOTCAMP is the shell — title, banner, level, the
 * topics it covers. A COHORT is one run of it, and everything a learner
 * actually touches hangs off the cohort: its weeks and lessons, its schedule,
 * its roster, its bonuses. Two cohorts of the same bootcamp can have completely
 * different curricula, so nothing here is addressed by bootcamp alone.
 */

export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
export type Level = (typeof LEVELS)[number];

export const COHORT_STATUSES = ['OPEN', 'STARTED', 'CLOSED'] as const;
export type CohortStatus = (typeof COHORT_STATUSES)[number];

export const LESSON_TYPES = [
  'VIDEO',
  'ARTICLE',
  'QUIZ',
  'PROJECT',
  'EXERCISE',
  'PLAYGROUND',
  'ASSIGNMENT',
] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

/**
 * Which lesson types link a library item, and the library kind it comes from.
 *
 * There is one search endpoint — `/admin/library?kind=…` — not a route per
 * kind. The other three types (EXERCISE, PLAYGROUND, ASSIGNMENT) are
 * self-contained and link nothing.
 */
export const LESSON_ITEM_KIND: Partial<Record<LessonType, LibraryKind>> = {
  VIDEO: 'video',
  ARTICLE: 'article',
  QUIZ: 'quiz',
  PROJECT: 'project',
};

export const EVENT_TYPES = [
  'LIVE_SESSION',
  'WORKSHOP',
  'REVIEW',
  'OFFICE_HOURS',
  'GUEST_SPEAKER',
  'DEMO_DAY',
  'STANDUP',
  'ASSESSMENT',
  'OTHER',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'RESCHEDULED',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const BONUS_KINDS = ['course', 'resource', 'video'] as const;
export type BonusKind = (typeof BONUS_KINDS)[number];

/** A bonus kind is a library kind by the same name. */
export const BONUS_SOURCE: Record<BonusKind, LibraryKind> = {
  course: 'course',
  resource: 'resource',
  video: 'video',
};

// ── types ───────────────────────────────────────────────────────────────────

export type BootcampTopic = { title: string; summary: string };

export type Bootcamp = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  banner: string;
  level: Level | string;
  topics: BootcampTopic[];
  cohortCount?: number;
  studentCount?: number;
  /** The soonest cohort still open to join, or null when there is none. */
  nextCohort?: {
    id: string;
    name: string;
    status: CohortStatus;
    startsAt: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Cohort = {
  id: string;
  bootcampId: string;
  name: string;
  duration: number;
  amount: number;
  maxStudent: number;
  startsAt: string;
  endsAt: string | null;
  status: CohortStatus;
  completed: boolean;
  studyGroupLink: string;
  paddle_price_id: string;
  asyncpay_plan_id: string;
  allowsSubscription: boolean;
  paymentMethods: string[];
  studentCount?: number;
  weekCount?: number;
  /** Summed across the cohort's weeks — Prisma cannot count two levels down. */
  lessonCount?: number;
  bonusCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Lesson = {
  id: string;
  weekId: string;
  title: string;
  summary: string;
  description: string;
  type: LessonType;
  mb: number;
  order: number;
  itemId: string;
  itemTitle: string;
  videoId: string | null;
  articleId: string | null;
  quizId: string | null;
  projectId: string | null;
};

export type Week = {
  id: string;
  cohortId: string;
  title: string;
  summary: string;
  order: number;
  lessons: Lesson[];
};

export type CohortMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  score: number;
  completed: boolean;
  /** Lessons they have finished, for the progress bar. */
  lessonsDone: number;
  currentWeekId: string | null;
  currentLessonId: string | null;
  joinedAt: string;
  /** Set when they leave or the run finishes for them. */
  endedAt: string | null;
};

/** The roster carries the spine with it, so a position can be shown. */
export type MemberPage = Paged<CohortMember> & {
  weeks: Array<{ id: string; title: string; position: number }>;
  lessonTotal: number;
};

/**
 * A submission awaiting review.
 *
 * Only ASSIGNMENT, EXERCISE and PROJECT lessons produce one — the other four
 * types have nothing to hand in.
 */
export type Assignment = {
  id: string;
  completed: boolean;
  submissionUrl: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; avatar?: string } | null;
  lesson: {
    id: string;
    title: string;
    week: {
      id: string;
      title: string;
      cohort: { id: string; name: string; bootcamp: { id: string; title: string } } | null;
    } | null;
  } | null;
};

export type Bonus = {
  id: string;
  cohortId: string;
  kind: BonusKind | null;
  itemId: string;
  itemTitle: string;
  topic: string;
  summary: string;
};

export type BootcampEvent = {
  id: string;
  bootcampId: string;
  weekId: string;
  lessonId: string | null;
  weekTitle: string;
  lessonTitle: string;
  title: string;
  description: string;
  eventType: EventType;
  status: EventStatus;
  eventDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  location: string;
  meetingUrl: string;
  recordingUrl: string;
};

export type BootcampDetail = Bootcamp & { cohorts: Cohort[] };
export type CohortDetail = Cohort & {
  bootcamp: { id: string; title: string; slug: string };
  weeks: Week[];
};

export type Paged<T> = { data: T[]; total: number; page: number; limit: number };

// ── bootcamps ───────────────────────────────────────────────────────────────

export async function fetchBootcamps(params?: {
  q?: string;
  page?: number;
  limit?: number;
  level?: string;
  sort?: string;
  order?: string;
}) {
  const { data } = await axiosInstance.get<Paged<Bootcamp>>('/admin/bootcamps', { params });
  return data;
}

export async function fetchBootcamp(id: string) {
  const { data } = await axiosInstance.get<BootcampDetail>(`/admin/bootcamps/${id}`);
  return data;
}

export async function slugAvailable(slug: string, exclude?: string) {
  const { data } = await axiosInstance.get<{ available: boolean }>(
    '/admin/bootcamps/slug-available',
    { params: { slug, ...(exclude ? { exclude } : {}) } },
  );
  return data.available;
}

export async function createBootcamp(payload: Partial<Bootcamp>) {
  const { data } = await axiosInstance.post<Bootcamp>('/admin/bootcamps', payload);
  return data;
}

export async function updateBootcamp(id: string, payload: Partial<Bootcamp>) {
  const { data } = await axiosInstance.patch<Bootcamp>(`/admin/bootcamps/${id}`, payload);
  return data;
}

export async function deleteBootcamp(id: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(`/admin/bootcamps/${id}`);
  return data;
}

// ── cohorts ─────────────────────────────────────────────────────────────────

export async function fetchCohorts(
  bootcampId: string,
  params?: { q?: string; page?: number; limit?: number; status?: string },
) {
  const { data } = await axiosInstance.get<Paged<Cohort>>(
    `/admin/bootcamps/${bootcampId}/cohorts`,
    { params },
  );
  return data;
}

export async function createCohort(bootcampId: string, payload: Partial<Cohort>) {
  const { data } = await axiosInstance.post<Cohort>(
    `/admin/bootcamps/${bootcampId}/cohorts`,
    payload,
  );
  return data;
}

export async function fetchCohort(cohortId: string) {
  const { data } = await axiosInstance.get<CohortDetail>(`/cohorts/${cohortId}`);
  return data;
}

export async function updateCohort(cohortId: string, payload: Partial<Cohort>) {
  const { data } = await axiosInstance.patch<Cohort>(`/cohorts/${cohortId}`, payload);
  return data;
}

export async function deleteCohort(cohortId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(`/cohorts/${cohortId}`);
  return data;
}

// ── curriculum ──────────────────────────────────────────────────────────────

export async function fetchCurriculum(cohortId: string) {
  const { data } = await axiosInstance.get<{ data: Week[] }>(`/cohorts/${cohortId}/curriculum`);
  return data.data;
}

export async function createWeek(cohortId: string, payload: { title: string; summary?: string }) {
  const { data } = await axiosInstance.post<Week>(`/cohorts/${cohortId}/weeks`, payload);
  return data;
}

export async function updateWeek(
  cohortId: string,
  weekId: string,
  payload: { title?: string; summary?: string },
) {
  const { data } = await axiosInstance.patch<Week>(`/cohorts/${cohortId}/weeks/${weekId}`, payload);
  return data;
}

export async function deleteWeek(cohortId: string, weekId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(
    `/cohorts/${cohortId}/weeks/${weekId}`,
  );
  return data;
}

/** Order is the position in `orderedIds` — the drag is the only control. */
export async function reorderWeeks(cohortId: string, orderedIds: string[]) {
  const { data } = await axiosInstance.patch<{ data: Week[] }>(
    `/cohorts/${cohortId}/weeks/reorder`,
    { orderedIds },
  );
  return data.data;
}

export type LessonInput = {
  title?: string;
  summary?: string;
  description?: string;
  type?: LessonType;
  mb?: number;
  itemId?: string;
};

export async function createLesson(cohortId: string, weekId: string, payload: LessonInput) {
  const { data } = await axiosInstance.post<Lesson>(
    `/cohorts/${cohortId}/weeks/${weekId}/lessons`,
    payload,
  );
  return data;
}

export async function updateLesson(
  cohortId: string,
  weekId: string,
  lessonId: string,
  payload: LessonInput,
) {
  const { data } = await axiosInstance.patch<Lesson>(
    `/cohorts/${cohortId}/weeks/${weekId}/lessons/${lessonId}`,
    payload,
  );
  return data;
}

export async function deleteLesson(cohortId: string, weekId: string, lessonId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(
    `/cohorts/${cohortId}/weeks/${weekId}/lessons/${lessonId}`,
  );
  return data;
}

export async function reorderLessons(cohortId: string, weekId: string, orderedIds: string[]) {
  const { data } = await axiosInstance.patch<{ data: Lesson[] }>(
    `/cohorts/${cohortId}/weeks/${weekId}/lessons/reorder`,
    { orderedIds },
  );
  return data.data;
}

// ── roster ──────────────────────────────────────────────────────────────────

export async function fetchMembers(
  cohortId: string,
  params?: { q?: string; page?: number; limit?: number },
) {
  const { data } = await axiosInstance.get<MemberPage>(`/cohorts/${cohortId}/members`, {
    params,
  });
  return data;
}

export type AddMembersResult = {
  added: CohortMember[];
  skipped: Array<{ email: string; reason: string }>;
};

/**
 * Add one or many. Nothing is all-or-nothing: an unknown address or an
 * already-enrolled learner is reported back rather than losing the addresses
 * that did work.
 */
export async function addMembers(cohortId: string, emails: string[]) {
  const { data } = await axiosInstance.post<AddMembersResult>(`/cohorts/${cohortId}/members`, {
    emails,
  });
  return data;
}

export async function removeMember(cohortId: string, memberId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(
    `/cohorts/${cohortId}/members/${memberId}`,
  );
  return data;
}

// ── bonuses ─────────────────────────────────────────────────────────────────

export async function fetchBonuses(cohortId: string) {
  const { data } = await axiosInstance.get<{ data: Bonus[] }>(`/cohorts/${cohortId}/bonuses`);
  return data.data;
}

export type BonusInput = {
  kind?: BonusKind;
  itemId?: string;
  topic?: string;
  summary?: string;
};

export async function createBonus(cohortId: string, payload: BonusInput) {
  const { data } = await axiosInstance.post<Bonus>(`/cohorts/${cohortId}/bonuses`, payload);
  return data;
}

export async function updateBonus(cohortId: string, bonusId: string, payload: BonusInput) {
  const { data } = await axiosInstance.patch<Bonus>(
    `/cohorts/${cohortId}/bonuses/${bonusId}`,
    payload,
  );
  return data;
}

export async function deleteBonus(cohortId: string, bonusId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(
    `/cohorts/${cohortId}/bonuses/${bonusId}`,
  );
  return data;
}

// ── schedule ────────────────────────────────────────────────────────────────

export async function fetchEvents(cohortId: string) {
  const { data } = await axiosInstance.get<{ data: BootcampEvent[] }>(
    `/cohorts/${cohortId}/events`,
  );
  return data.data;
}

export type EventInput = {
  weekId?: string;
  lessonId?: string | null;
  title?: string;
  description?: string;
  eventType?: EventType;
  status?: EventStatus;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  location?: string;
  meetingUrl?: string;
  recordingUrl?: string;
};

export async function createEvent(cohortId: string, payload: EventInput) {
  const { data } = await axiosInstance.post<BootcampEvent>(`/cohorts/${cohortId}/events`, payload);
  return data;
}

export async function updateEvent(cohortId: string, eventId: string, payload: EventInput) {
  const { data } = await axiosInstance.patch<BootcampEvent>(
    `/cohorts/${cohortId}/events/${eventId}`,
    payload,
  );
  return data;
}

export async function deleteEvent(cohortId: string, eventId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(
    `/cohorts/${cohortId}/events/${eventId}`,
  );
  return data;
}

// ── library lookup ──────────────────────────────────────────────────────────

export type LibraryKind =
  | 'quiz'
  | 'exercise'
  | 'video'
  | 'article'
  | 'chapter'
  | 'cohort'
  | 'lesson'
  | 'resource'
  | 'project'
  | 'course';

export type LibraryRow = {
  id: string;
  title: string;
  /** A short qualifier from the endpoint — a duration, a level, a type. */
  meta: string;
  /** Where it already lives, when it lives somewhere. */
  context: string | null;
};

/**
 * Search the library for one kind.
 *
 * One endpoint serves every kind, keyed by `kind` — the same one the course
 * editor uses. Asking for a kind it does not know is a 422, which is what the
 * pickers were doing before and what made every search look empty.
 */
export async function searchLibrary(kind: LibraryKind, q: string): Promise<LibraryRow[]> {
  const params = new URLSearchParams({ kind, limit: '20' });
  if (q) params.set('q', q);

  const { data } = await axiosInstance.get<{ data: LibraryRow[] }>(
    `/admin/library?${params.toString()}`,
  );
  return data?.data ?? [];
}

// ── assignment review ───────────────────────────────────────────────────────

/**
 * Submissions across every bootcamp, newest first.
 *
 * This one lives on the learner-facing router rather than under /admin, and it
 * is gated on the ADMIN and INSTRUCTOR roles inside the handler.
 */
export async function fetchAssignments(bootcampId?: string) {
  const { data } = await axiosInstance.get<{ data: Assignment[]; total: number }>(
    '/bootcamps/admin/assignments',
    { params: bootcampId ? { bootcampId } : undefined },
  );
  return data;
}

/** Marks the lesson complete and awards its points, through an event. */
export async function approveAssignment(userLessonId: string) {
  const { data } = await axiosInstance.patch(`/bootcamps/admin/assignments/${userLessonId}`);
  return data;
}
