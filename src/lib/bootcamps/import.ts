import {
  BONUS_KINDS,
  COHORT_STATUSES,
  EVENT_STATUSES,
  EVENT_TYPES,
  LESSON_ITEM_KIND,
  LESSON_TYPES,
  LEVELS,
  type BonusKind,
  type CohortStatus,
  type EventStatus,
  type EventType,
  type LessonType,
} from '@/lib/api/bootcamps';

/**
 * Parse a pasted JSON payload into a whole bootcamp.
 *
 * Same contract as the course and path importers: `errors` block the import,
 * `notes` are recoverable and imported anyway, and `counts` say exactly what
 * will be created before anything is written.
 *
 * The shape mirrors where things actually live. A bootcamp carries identity and
 * topics; everything a learner works through — weeks, lessons, schedule,
 * bonuses, roster — hangs off a COHORT, because two cohorts of one bootcamp can
 * run completely different curricula.
 */

const KNOWN_BOOTCAMP = ['title', 'slug', 'summary', 'banner', 'level', 'topics', 'cohorts'];
const KNOWN_TOPIC = ['title', 'summary'];
const KNOWN_COHORT = [
  'name',
  'startsAt',
  'endsAt',
  'duration',
  'amount',
  'maxStudent',
  'status',
  'completed',
  'studyGroupLink',
  'paddle_price_id',
  'asyncpay_plan_id',
  'allowsSubscription',
  'weeks',
  'events',
  'bonuses',
  'students',
];
const KNOWN_WEEK = ['title', 'summary', 'lessons'];
const KNOWN_LESSON = ['title', 'summary', 'description', 'type', 'mb', 'item'];
const KNOWN_EVENT = [
  'title',
  'description',
  'eventType',
  'status',
  'date',
  'start',
  'end',
  'timezone',
  'week',
  'lesson',
  'location',
  'meetingUrl',
  'recordingUrl',
];
const KNOWN_BONUS = ['kind', 'item', 'topic', 'summary'];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^\d{2}:\d{2}$/;
const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

export type ImportLesson = {
  title: string;
  summary: string;
  description: string;
  type: LessonType;
  mb: number;
  /** A library title, resolved before anything is written. */
  item?: string;
};

export type ImportWeek = {
  title: string;
  summary: string;
  lessons: ImportLesson[];
};

export type ImportEvent = {
  title: string;
  description: string;
  eventType: EventType;
  status: EventStatus;
  date: string;
  start: string;
  end: string;
  timezone: string;
  /** 1-based position in this cohort's weeks. */
  week: number;
  /** A lesson title within that week. Optional — a kickoff belongs to no lesson. */
  lesson?: string;
  location: string;
  meetingUrl: string;
  recordingUrl: string;
};

export type ImportBonus = {
  kind: BonusKind;
  item: string;
  topic: string;
  summary: string;
};

export type ImportCohort = {
  name: string;
  startsAt: string;
  endsAt: string | null;
  duration: number;
  amount: number;
  maxStudent: number;
  status: CohortStatus;
  completed: boolean;
  studyGroupLink: string;
  paddle_price_id: string;
  asyncpay_plan_id: string;
  allowsSubscription: boolean;
  weeks: ImportWeek[];
  events: ImportEvent[];
  bonuses: ImportBonus[];
  students: string[];
};

export type ImportDocument = {
  title: string;
  slug: string;
  summary: string;
  banner: string;
  level: string;
  topics: Array<{ title: string; summary: string }>;
  cohorts: ImportCohort[];
};

export type ImportResult = {
  doc: ImportDocument | null;
  /** Blocking. Nothing is written while any of these stand. */
  errors: string[];
  /** Recoverable — the value was dropped or defaulted, and the import proceeds. */
  notes: string[];
  counts: {
    cohorts: number;
    weeks: number;
    lessons: number;
    events: number;
    bonuses: number;
    students: number;
    topics: number;
  };
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const str = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;
const bool = (value: unknown, fallback = false) => (typeof value === 'boolean' ? value : fallback);
const num = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Anything the schema does not know about is reported, not silently dropped. */
function unknownKeys(
  obj: Record<string, unknown>,
  known: string[],
  where: string,
  notes: string[],
) {
  const strays = Object.keys(obj).filter((key) => !known.includes(key));
  if (strays.length) notes.push(`${where}: ignored unknown field(s) ${strays.join(', ')}.`);
}

export function parseBootcampImport(raw: string): ImportResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const empty: ImportResult['counts'] = {
    cohorts: 0,
    weeks: 0,
    lessons: 0,
    events: 0,
    bonuses: 0,
    students: 0,
    topics: 0,
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      doc: null,
      errors: [`That is not valid JSON — ${(error as Error).message}`],
      notes,
      counts: empty,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      doc: null,
      errors: ['The document must be a single JSON object.'],
      notes,
      counts: empty,
    };
  }

  const root = parsed as Record<string, unknown>;
  unknownKeys(root, KNOWN_BOOTCAMP, 'bootcamp', notes);

  const title = str(root.title);
  if (!title) errors.push('The bootcamp needs a title.');
  if (title.length > 100)
    errors.push('The title is longer than the 100 characters the column holds.');

  let level = str(root.level, 'Beginner');
  if (!LEVELS.includes(level as (typeof LEVELS)[number])) {
    notes.push(`level "${level}" is not one of ${LEVELS.join(', ')} — using Beginner.`);
    level = 'Beginner';
  }

  const slug = str(root.slug) || slugify(title);

  const topics = Array.isArray(root.topics)
    ? root.topics.flatMap((entry, index): Array<{ title: string; summary: string }> => {
        // Bare strings are what every stored bootcamp holds today.
        if (typeof entry === 'string') {
          const text = entry.trim();
          return text ? [{ title: text, summary: '' }] : [];
        }
        if (!entry || typeof entry !== 'object') return [];
        const topic = entry as Record<string, unknown>;
        unknownKeys(topic, KNOWN_TOPIC, `topic ${index + 1}`, notes);
        const topicTitle = str(topic.title);
        if (!topicTitle) {
          notes.push(`topic ${index + 1}: no title, skipped.`);
          return [];
        }
        return [{ title: topicTitle, summary: str(topic.summary) }];
      })
    : [];

  const cohorts: ImportCohort[] = [];
  const rawCohorts = Array.isArray(root.cohorts) ? root.cohorts : [];
  if (!rawCohorts.length) {
    notes.push(
      'No cohorts. The bootcamp is created, but nobody can join it and there is nowhere to put a curriculum.',
    );
  }

  rawCohorts.forEach((entry, index) => {
    const where = `cohort ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${where}: must be an object.`);
      return;
    }
    const raw = entry as Record<string, unknown>;
    unknownKeys(raw, KNOWN_COHORT, where, notes);

    const name = str(raw.name);
    if (!name) {
      errors.push(`${where}: needs a name.`);
      return;
    }

    const startsAt = str(raw.startsAt);
    if (!DATE.test(startsAt)) {
      errors.push(`${where} "${name}": startsAt must be a YYYY-MM-DD date. The API requires it.`);
      return;
    }
    const endsAt = str(raw.endsAt) || null;
    if (endsAt && !DATE.test(endsAt)) {
      errors.push(`${where} "${name}": endsAt must be a YYYY-MM-DD date.`);
      return;
    }
    if (endsAt && endsAt < startsAt) {
      errors.push(`${where} "${name}": endsAt is before startsAt.`);
      return;
    }

    let status = str(raw.status, 'OPEN').toUpperCase();
    if (!COHORT_STATUSES.includes(status as CohortStatus)) {
      notes.push(
        `${where} "${name}": status "${status}" is not one of ${COHORT_STATUSES.join(', ')} — using OPEN.`,
      );
      status = 'OPEN';
    }

    const weeks = parseWeeks(raw.weeks, `${where} "${name}"`, errors, notes);
    const events = parseEvents(raw.events, `${where} "${name}"`, weeks, errors, notes);
    const bonuses = parseBonuses(raw.bonuses, `${where} "${name}"`, errors, notes);

    const students = (Array.isArray(raw.students) ? raw.students : [])
      .map((value) => str(value).toLowerCase())
      .filter((email) => {
        if (!email) return false;
        if (!EMAIL.test(email)) {
          notes.push(`${where} "${name}": "${email}" is not an email address, skipped.`);
          return false;
        }
        return true;
      });

    cohorts.push({
      name,
      startsAt,
      endsAt,
      duration: num(raw.duration),
      amount: num(raw.amount),
      maxStudent: num(raw.maxStudent),
      status: status as CohortStatus,
      completed: bool(raw.completed),
      studyGroupLink: str(raw.studyGroupLink),
      paddle_price_id: str(raw.paddle_price_id),
      asyncpay_plan_id: str(raw.asyncpay_plan_id),
      allowsSubscription: bool(raw.allowsSubscription, true),
      weeks,
      events,
      bonuses,
      students,
    });
  });

  const counts = {
    cohorts: cohorts.length,
    topics: topics.length,
    weeks: cohorts.reduce((n, c) => n + c.weeks.length, 0),
    lessons: cohorts.reduce((n, c) => n + c.weeks.reduce((m, w) => m + w.lessons.length, 0), 0),
    events: cohorts.reduce((n, c) => n + c.events.length, 0),
    bonuses: cohorts.reduce((n, c) => n + c.bonuses.length, 0),
    students: cohorts.reduce((n, c) => n + c.students.length, 0),
  };

  if (errors.length) return { doc: null, errors, notes, counts };

  return {
    doc: {
      title,
      slug,
      summary: str(root.summary),
      banner: str(root.banner),
      level,
      topics,
      cohorts,
    },
    errors,
    notes,
    counts,
  };
}

function parseWeeks(
  value: unknown,
  where: string,
  errors: string[],
  notes: string[],
): ImportWeek[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index): ImportWeek[] => {
    const at = `${where}, week ${index + 1}`;
    if (!entry || typeof entry !== 'object') {
      errors.push(`${at}: must be an object.`);
      return [];
    }
    const raw = entry as Record<string, unknown>;
    unknownKeys(raw, KNOWN_WEEK, at, notes);

    const title = str(raw.title);
    if (!title) {
      errors.push(`${at}: needs a title.`);
      return [];
    }

    const lessons = (Array.isArray(raw.lessons) ? raw.lessons : []).flatMap(
      (lessonEntry, lessonIndex): ImportLesson[] => {
        const lessonAt = `${at}, lesson ${lessonIndex + 1}`;
        if (!lessonEntry || typeof lessonEntry !== 'object') {
          errors.push(`${lessonAt}: must be an object.`);
          return [];
        }
        const lesson = lessonEntry as Record<string, unknown>;
        unknownKeys(lesson, KNOWN_LESSON, lessonAt, notes);

        const lessonTitle = str(lesson.title);
        if (!lessonTitle) {
          errors.push(`${lessonAt}: needs a title.`);
          return [];
        }

        let type = str(lesson.type, 'VIDEO').toUpperCase();
        if (!LESSON_TYPES.includes(type as LessonType)) {
          notes.push(
            `${lessonAt}: type "${type}" is not one of ${LESSON_TYPES.join(', ')} — using VIDEO.`,
          );
          type = 'VIDEO';
        }

        let item = str(lesson.item);
        // Only four of the seven types carry a library row; the API refuses the
        // rest, so the reference is dropped here rather than failing the write.
        if (item && !LESSON_ITEM_KIND[type as LessonType]) {
          notes.push(`${lessonAt}: a ${type} lesson links nothing, so "${item}" is ignored.`);
          item = '';
        }

        return [
          {
            title: lessonTitle,
            summary: str(lesson.summary),
            description: str(lesson.description),
            type: type as LessonType,
            mb: num(lesson.mb),
            ...(item ? { item } : {}),
          },
        ];
      },
    );

    return [{ title, summary: str(raw.summary), lessons }];
  });
}

function parseEvents(
  value: unknown,
  where: string,
  weeks: ImportWeek[],
  errors: string[],
  notes: string[],
): ImportEvent[] {
  if (!Array.isArray(value)) return [];

  const events = value.flatMap((entry, index): ImportEvent[] => {
    const at = `${where}, event ${index + 1}`;
    if (!entry || typeof entry !== 'object') {
      errors.push(`${at}: must be an object.`);
      return [];
    }
    const raw = entry as Record<string, unknown>;
    unknownKeys(raw, KNOWN_EVENT, at, notes);

    const title = str(raw.title);
    if (title.length < 3) {
      errors.push(`${at}: needs a title of at least 3 characters.`);
      return [];
    }

    let eventType = str(raw.eventType, 'LIVE_SESSION').toUpperCase();
    if (!EVENT_TYPES.includes(eventType as EventType)) {
      notes.push(`${at}: eventType "${eventType}" is unknown — using LIVE_SESSION.`);
      eventType = 'LIVE_SESSION';
    }
    let status = str(raw.status, 'SCHEDULED').toUpperCase();
    if (!EVENT_STATUSES.includes(status as EventStatus)) {
      notes.push(`${at}: status "${status}" is unknown — using SCHEDULED.`);
      status = 'SCHEDULED';
    }

    const date = str(raw.date);
    if (!DATE.test(date)) {
      errors.push(`${at}: date must be YYYY-MM-DD.`);
      return [];
    }
    const start = str(raw.start, '17:00');
    const end = str(raw.end, '18:00');
    if (!CLOCK.test(start) || !CLOCK.test(end)) {
      errors.push(`${at}: start and end must be HH:MM.`);
      return [];
    }
    if (end <= start) {
      errors.push(`${at}: end is not after start.`);
      return [];
    }

    // An event belongs to a week of this cohort, by position.
    const week = num(raw.week, 1);
    if (!weeks.length) {
      errors.push(`${at}: the cohort has no weeks, so there is nothing to attach it to.`);
      return [];
    }
    if (!Number.isInteger(week) || week < 1 || week > weeks.length) {
      errors.push(`${at}: week ${week} does not exist — this cohort has ${weeks.length}.`);
      return [];
    }

    let lesson = str(raw.lesson);
    if (lesson && !weeks[week - 1].lessons.some((l) => l.title === lesson)) {
      notes.push(
        `${at}: no lesson called "${lesson}" in week ${week} — the event is left unpinned.`,
      );
      lesson = '';
    }

    return [
      {
        title,
        description: str(raw.description),
        eventType: eventType as EventType,
        status: status as EventStatus,
        date,
        start,
        end,
        timezone: str(raw.timezone, 'UTC'),
        week,
        ...(lesson ? { lesson } : {}),
        location: str(raw.location),
        meetingUrl: str(raw.meetingUrl),
        recordingUrl: str(raw.recordingUrl),
      },
    ];
  });

  // The API refuses overlapping sessions in one cohort with a 409, so a payload
  // that would collide is caught here instead of failing halfway through.
  events.forEach((a, i) => {
    events.slice(i + 1).forEach((b) => {
      if (a.date !== b.date) return;
      if (a.start < b.end && b.start < a.end) {
        errors.push(
          `${where}: “${a.title}” and “${b.title}” overlap on ${a.date}. Two sessions in one cohort cannot.`,
        );
      }
    });
  });

  return events;
}

function parseBonuses(
  value: unknown,
  where: string,
  errors: string[],
  notes: string[],
): ImportBonus[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index): ImportBonus[] => {
    const at = `${where}, bonus ${index + 1}`;
    if (!entry || typeof entry !== 'object') {
      errors.push(`${at}: must be an object.`);
      return [];
    }
    const raw = entry as Record<string, unknown>;
    unknownKeys(raw, KNOWN_BONUS, at, notes);

    const kind = str(raw.kind).toLowerCase();
    if (!BONUS_KINDS.includes(kind as BonusKind)) {
      errors.push(`${at}: kind must be one of ${BONUS_KINDS.join(', ')}.`);
      return [];
    }
    const item = str(raw.item);
    if (!item) {
      errors.push(`${at}: needs the title of the ${kind} it points at.`);
      return [];
    }

    return [
      {
        kind: kind as BonusKind,
        item,
        topic: str(raw.topic),
        summary: str(raw.summary),
      },
    ];
  });
}
