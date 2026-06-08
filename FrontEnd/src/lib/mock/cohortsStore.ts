export type MockCohortMember = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export type MockLesson = {
  id: number;
  title: string;
  type: "video" | "live" | "assignment";
  status: "pending" | "reviewed" | "approved";
};

export type MockWeek = {
  id: number;
  title: string;
  lessons: MockLesson[];
};

export type MockCohort = {
  id: number;
  bootcampId: number;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
  size: number;
  members: MockCohortMember[];
  weeks: MockWeek[];
};

let nextCohortId = 3;
let nextMemberId = 4;
let nextWeekId = 3;
let nextLessonId = 5;

const cohorts: MockCohort[] = [
  {
    id: 1,
    bootcampId: 1,
    name: "Cohort 1",
    startDate: "2026-07-01",
    endDate: "2026-09-01",
    active: true,
    size: 30,
    members: [
      { id: 1, name: "Alice Smith", email: "alice@example.com", role: "ADMIN" },
      { id: 2, name: "Bob Jones", email: "bob@example.com", role: "INSTRUCTOR" },
    ],
    weeks: [
      {
        id: 1,
        title: "Week 1",
        lessons: [
          { id: 1, title: "Intro to Bootcamp", type: "live", status: "approved" },
          { id: 2, title: "Setup Assignment", type: "assignment", status: "pending" },
        ],
      },
      {
        id: 2,
        title: "Week 2",
        lessons: [{ id: 3, title: "Core Concepts", type: "video", status: "reviewed" }],
      },
    ],
  },
  {
    id: 2,
    bootcampId: 1,
    name: "Cohort 2",
    startDate: "2026-10-01",
    endDate: "2027-01-01",
    active: false,
    size: 24,
    members: [{ id: 3, name: "Carol Lee", email: "carol@example.com", role: "SUPER_ADMIN" }],
    weeks: [{ id: 3, title: "Week 1", lessons: [{ id: 4, title: "Orientation", type: "live", status: "pending" }] }],
  },
];

export function listCohorts() {
  return cohorts;
}

export function listCohortsWithQuery(params: {
  page: number;
  limit: number;
  q: string;
  sort?: string | null;
  order?: string | null;
  status?: string | null;
  bootcampId?: number | null;
}) {
  const { page, limit, q, sort, order = "asc", status = "all", bootcampId } = params;
  let filtered = cohorts.filter((cohort) => cohort.name.toLowerCase().includes(q.toLowerCase()));

  if (bootcampId) {
    filtered = filtered.filter((cohort) => cohort.bootcampId === bootcampId);
  }

  if (status !== "all") {
    if (status === "active") {
      filtered = filtered.filter((cohort) => cohort.active);
    } else if (status === "inactive") {
      filtered = filtered.filter((cohort) => !cohort.active);
    }
  }

  if (sort) {
    filtered = filtered.slice().sort((a, b) => {
      const aVal: any = (a as any)[sort];
      const bVal: any = (b as any)[sort];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return order === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return order === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        const aNum = aVal ? 1 : 0;
        const bNum = bVal ? 1 : 0;
        return order === "asc" ? aNum - bNum : bNum - aNum;
      }

      return 0;
    });
  }

  const start = (page - 1) * limit;
  return {
    data: filtered.slice(start, start + limit).map((cohort) => ({
      ...cohort,
      memberCount: cohort.members.length,
      weekCount: cohort.weeks.length,
    })),
    total: filtered.length,
  };
}

export function getCohortById(id: number) {
  return cohorts.find((cohort) => cohort.id === id) || null;
}

export function createCohort(input: Partial<MockCohort>) {
  const cohort: MockCohort = {
    id: nextCohortId++,
    bootcampId: input.bootcampId || 1,
    name: input.name || "New Cohort",
    startDate: input.startDate || new Date().toISOString().slice(0, 10),
    endDate: input.endDate || new Date().toISOString().slice(0, 10),
    active: input.active ?? true,
    size: input.size ?? 20,
    members: [],
    weeks: [],
  };

  cohorts.push(cohort);
  return cohort;
}

export function updateCohort(id: number, input: Partial<MockCohort>) {
  const index = cohorts.findIndex((cohort) => cohort.id === id);
  if (index === -1) return null;
  cohorts[index] = { ...cohorts[index], ...input };
  return cohorts[index];
}

export function deleteCohort(id: number) {
  const initialLength = cohorts.length;
  const next = cohorts.filter((cohort) => cohort.id !== id);
  cohorts.length = 0;
  cohorts.push(...next);
  return cohorts.length !== initialLength;
}

export function listMembers(cohortId: number) {
  return getCohortById(cohortId)?.members || [];
}

export function enrollMember(cohortId: number, member: Omit<MockCohortMember, "id">) {
  const cohort = getCohortById(cohortId);
  if (!cohort) return null;

  const created = { id: nextMemberId++, ...member };
  cohort.members.push(created);
  return created;
}

export function removeMember(cohortId: number, memberId: number) {
  const cohort = getCohortById(cohortId);
  if (!cohort) return false;
  const initialLength = cohort.members.length;
  cohort.members = cohort.members.filter((member) => member.id !== memberId);
  return cohort.members.length !== initialLength;
}

export function listWeeks(cohortId: number) {
  return getCohortById(cohortId)?.weeks || [];
}

export function createWeek(cohortId: number, title: string) {
  const cohort = getCohortById(cohortId);
  if (!cohort) return null;
  const week = { id: nextWeekId++, title, lessons: [] as MockLesson[] };
  cohort.weeks.push(week);
  return week;
}

export function updateWeek(cohortId: number, weekId: number, title: string) {
  const week = getCohortById(cohortId)?.weeks.find((item) => item.id === weekId);
  if (!week) return null;
  week.title = title;
  return week;
}

export function deleteWeek(cohortId: number, weekId: number) {
  const cohort = getCohortById(cohortId);
  if (!cohort) return false;
  const initialLength = cohort.weeks.length;
  cohort.weeks = cohort.weeks.filter((week) => week.id !== weekId);
  return cohort.weeks.length !== initialLength;
}

export function reorderWeeks(cohortId: number, orderedIds: number[]) {
  const cohort = getCohortById(cohortId);
  if (!cohort) return null;
  const ordered = orderedIds
    .map((weekId) => cohort.weeks.find((week) => week.id === weekId))
    .filter(Boolean) as MockWeek[];
  if (ordered.length !== cohort.weeks.length) return cohort.weeks;
  cohort.weeks = ordered;
  return cohort.weeks;
}

export function createLesson(
  cohortId: number,
  weekId: number,
  input: { title: string; type: MockLesson["type"] }
) {
  const week = getCohortById(cohortId)?.weeks.find((item) => item.id === weekId);
  if (!week) return null;
  const lesson: MockLesson = {
    id: nextLessonId++,
    title: input.title,
    type: input.type,
    status: "pending",
  };
  week.lessons.push(lesson);
  return lesson;
}

export function updateLesson(
  cohortId: number,
  weekId: number,
  lessonId: number,
  input: Partial<MockLesson>
) {
  const lesson = getCohortById(cohortId)?.weeks
    .find((week) => week.id === weekId)
    ?.lessons.find((item) => item.id === lessonId);
  if (!lesson) return null;
  Object.assign(lesson, input);
  return lesson;
}

export function deleteLesson(cohortId: number, weekId: number, lessonId: number) {
  const week = getCohortById(cohortId)?.weeks.find((item) => item.id === weekId);
  if (!week) return false;
  const initialLength = week.lessons.length;
  week.lessons = week.lessons.filter((lesson) => lesson.id !== lessonId);
  return week.lessons.length !== initialLength;
}

export function reorderLessons(cohortId: number, weekId: number, orderedIds: number[]) {
  const week = getCohortById(cohortId)?.weeks.find((item) => item.id === weekId);
  if (!week) return null;
  const ordered = orderedIds
    .map((lessonId) => week.lessons.find((lesson) => lesson.id === lessonId))
    .filter(Boolean) as MockLesson[];
  if (ordered.length !== week.lessons.length) return week.lessons;
  week.lessons = ordered;
  return week.lessons;
}
