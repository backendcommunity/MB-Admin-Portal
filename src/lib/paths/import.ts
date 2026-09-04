import { ITEM_KINDS, kindTakesOptional, type ItemKind } from '@/lib/api/paths';

/**
 * Parse a pasted JSON payload into a path we can create.
 *
 * Same contract as the course importer: `errors` block the whole import,
 * `notes` are recoverable and imported anyway, and `counts` say exactly what
 * will be created before anything is written.
 *
 * Two fields are dropped rather than honoured. `ownerTeamId` and `isPublic`
 * decide who a path belongs to and who can see it, and the editor locks both —
 * accepting them here would make the importer the way around that lock. The API
 * rejects them too; this reports it rather than letting the request 422.
 */

const KIND_IDS = ITEM_KINDS.map((k) => k.id) as readonly string[];

const KNOWN_PATH = [
  'title',
  'slug',
  'summary',
  'description',
  'banner',
  'preview',
  'level',
  'difficulty',
  'timeframe',
  'prerequisites',
  'skills',
  'languages',
  'instructor',
  'estimatedWeeks',
  'hoursPerWeek',
  'isPremium',
  'amount',
  'paddlePlanCode',
  'paddle_price_id',
  'isWaiting',
  'waitingLink',
  'createdById',
  'topics',
  'publish',
];
const KNOWN_TOPIC = [
  'title',
  'slug',
  'summary',
  'description',
  'banner',
  'level',
  'duration',
  'outcomes',
  'recommendation',
  'reference',
  'isPremium',
  'items',
];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const MODALITIES = ['CHAT', 'AUDIO', 'VIDEO'];
const KNOWN_ITEM = ['kind', 'title', 'isOptional', 'order', 'type', 'link'];

export type ImportItem = {
  kind: ItemKind;
  title: string;
  isOptional?: boolean;
  /** Explicit position. Falls back to the array's own order when absent. */
  order?: number;
  /** Mock interviews only. */
  type?: 'CHAT' | 'AUDIO' | 'VIDEO';
  /**
   * Resources only. A resource with a link can be created on import; without
   * one it is a dead label, so it is skipped like any other missing item.
   */
  link?: string;
};

export type ImportTopic = {
  title: string;
  slug?: string;
  summary: string;
  description: string;
  banner: string;
  level: string;
  duration: number;
  outcomes: string[];
  recommendation: number;
  reference: string;
  isPremium: boolean;
  items: ImportItem[];
};

export type ImportDocument = {
  path: Record<string, unknown> & { title: string };
  topics: ImportTopic[];
  publish: boolean;
};

export type ImportResult = {
  ok: boolean;
  errors: string[];
  notes: string[];
  doc: ImportDocument | null;
  counts: { topics: number; items: number; skipped: number; emptyTopics: number };
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];
}
function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function str(value: unknown): string {
  return value == null ? '' : String(value);
}

export function parsePathImport(raw: string): ImportResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const counts = { topics: 0, items: 0, skipped: 0, emptyTopics: 0 };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      errors: [`Invalid JSON — ${(error as Error).message}`],
      notes: [],
      doc: null,
      counts,
    };
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      errors: ['The payload must be an object describing one path.'],
      notes: [],
      doc: null,
      counts,
    };
  }

  const body = data as Record<string, unknown>;

  Object.keys(body).forEach((key) => {
    if (!KNOWN_PATH.includes(key)) notes.push(`Unknown field “${key}” was ignored.`);
  });

  if (!str(body.title).trim()) errors.push('title is required.');

  if (str(body.ownerTeamId).trim()) {
    notes.push(
      '“ownerTeamId” was ignored — a path becomes team-owned from the team workspace, never from an import.',
    );
  }
  if (body.isPublic === false) {
    notes.push(
      '“isPublic” was ignored — an imported path starts as a draft and is published from the editor.',
    );
  }

  const level = str(body.level).trim();
  if (level && !LEVELS.includes(level) && level !== 'Beginner to Advanced') {
    notes.push(`level: “${level}” is not one of ${LEVELS.join(', ')} — imported as written.`);
  }

  const rawTopics = Array.isArray(body.topics) ? body.topics : [];

  const topics: ImportTopic[] = rawTopics
    .map((entry, index): ImportTopic | null => {
      const where = `topics[${index}]`;
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push(`${where} must be an object.`);
        return null;
      }
      const topic = entry as Record<string, unknown>;

      Object.keys(topic).forEach((key) => {
        if (!KNOWN_TOPIC.includes(key)) {
          notes.push(`Unknown field “${key}” on ${where} was ignored.`);
        }
      });
      if (!str(topic.title).trim()) errors.push(`${where}.title is required.`);

      const items = (Array.isArray(topic.items) ? topic.items : [])
        .map((rawItem, j): ImportItem | null => {
          const iw = `${where}.items[${j}]`;
          if (rawItem === null || typeof rawItem !== 'object') {
            notes.push(`${iw} is not an object — skipped.`);
            counts.skipped += 1;
            return null;
          }
          const item = rawItem as Record<string, unknown>;

          Object.keys(item).forEach((key) => {
            if (!KNOWN_ITEM.includes(key)) {
              notes.push(`Unknown field “${key}” on ${iw} was ignored.`);
            }
          });

          const kind = str(item.kind).trim();
          // A cohort is a bootcamp's cohort; the API refuses new links, so an
          // import must not create one either.
          const attachable = ITEM_KINDS.find((k) => k.id === kind)?.attachable;
          if (KIND_IDS.includes(kind) && attachable === false) {
            notes.push(
              `${iw}: a ${kind} cannot be attached on its own — attach its bootcamp instead. Skipped.`,
            );
            counts.skipped += 1;
            return null;
          }
          if (!KIND_IDS.includes(kind)) {
            notes.push(
              `${iw}: unknown kind “${kind}” — skipped. Expected one of ${KIND_IDS.join(', ')}.`,
            );
            counts.skipped += 1;
            return null;
          }
          const title = str(item.title).trim();
          if (!title) {
            notes.push(`${iw} has no title — skipped.`);
            counts.skipped += 1;
            return null;
          }

          let isOptional: boolean | undefined;
          if (item.isOptional !== undefined) {
            if (kindTakesOptional(kind)) isOptional = Boolean(item.isOptional);
            else {
              notes.push(
                `${iw}: a ${kind} cannot be optional — that link has no isOptional column.`,
              );
            }
          }

          // Explicit order wins; otherwise the array's own sequence is the
          // order, which is how a hand-written payload reads.
          let order: number | undefined;
          if (item.order !== undefined) {
            const n = Number(item.order);
            if (Number.isInteger(n) && n >= 0) order = n;
            else notes.push(`${iw}.order is not a whole number — using its position instead.`);
          }

          let type: 'CHAT' | 'AUDIO' | 'VIDEO' | undefined;
          if (item.type !== undefined) {
            const wanted = str(item.type).trim().toUpperCase();
            if (kind !== 'mock') {
              notes.push(`${iw}: only a mock interview carries a modality — “type” ignored.`);
            } else if (MODALITIES.includes(wanted)) {
              type = wanted as 'CHAT' | 'AUDIO' | 'VIDEO';
            } else {
              notes.push(
                `${iw}.type: “${str(item.type)}” is not one of ${MODALITIES.join(', ')} — using CHAT.`,
              );
            }
          }

          let link: string | undefined;
          if (item.link !== undefined) {
            if (kind !== 'resource') {
              notes.push(`${iw}: only a resource carries a link — “link” ignored.`);
            } else {
              link = str(item.link).trim() || undefined;
            }
          }

          counts.items += 1;
          return {
            kind: kind as ItemKind,
            title,
            ...(link !== undefined ? { link } : {}),
            ...(isOptional !== undefined ? { isOptional } : {}),
            ...(order !== undefined ? { order } : {}),
            ...(type !== undefined ? { type } : {}),
          };
        })
        .filter((item): item is ImportItem => item !== null);

      if (!items.length) counts.emptyTopics += 1;
      counts.topics += 1;

      return {
        title: str(topic.title),
        slug: str(topic.slug).trim() || undefined,
        summary: str(topic.summary),
        description: str(topic.description),
        banner: str(topic.banner),
        level: str(topic.level),
        duration: num(topic.duration, 0),
        outcomes: asStringArray(topic.outcomes),
        recommendation: num(topic.recommendation, 1),
        reference: str(topic.reference),
        isPremium: Boolean(topic.isPremium),
        items,
      };
    })
    .filter((topic): topic is ImportTopic => topic !== null);

  if (errors.length) return { ok: false, errors, notes, doc: null, counts };

  const wantsPublish = body.publish === true;
  if (wantsPublish && counts.emptyTopics > 0) {
    notes.push(
      `Asked to publish, but ${counts.emptyTopics} topic(s) have no content — importing as a draft.`,
    );
  }

  return {
    ok: true,
    errors,
    notes,
    counts,
    doc: {
      path: {
        title: str(body.title),
        slug: str(body.slug).trim() || undefined,
        summary: str(body.summary),
        description: str(body.description),
        banner: str(body.banner),
        preview: str(body.preview),
        level: str(body.level),
        difficulty: str(body.difficulty),
        timeframe: str(body.timeframe),
        instructor: str(body.instructor),
        prerequisites: asStringArray(body.prerequisites),
        skills: asStringArray(body.skills),
        languages: asStringArray(body.languages),
        estimatedWeeks: num(body.estimatedWeeks, 0),
        hoursPerWeek: num(body.hoursPerWeek, 0),
        isPremium: Boolean(body.isPremium),
        amount: num(body.amount, 0),
        // Both were accepted without complaint and then dropped, which reads as
        // a successful import that quietly lost two fields.
        paddlePlanCode:
          body.paddlePlanCode === undefined || body.paddlePlanCode === null
            ? null
            : num(body.paddlePlanCode, 0),
        createdById: str(body.createdById).trim(),
        paddle_price_id: str(body.paddle_price_id),
        isWaiting: Boolean(body.isWaiting),
        waitingLink: str(body.waitingLink),
      },
      topics,
      publish: wantsPublish && counts.emptyTopics === 0 && topics.length > 0,
    },
  };
}

/**
 * Every field the importer understands, in one payload.
 *
 * It doubles as the documentation — "Load sample" is how an author finds out
 * what can be set — so it deliberately shows the awkward ones too: an explicit
 * item `order`, an optional item, and a mock interview's modality.
 */
export type SampleContent = Partial<Record<'course' | 'article' | 'project' | 'mock', string>>;

/**
 * Every field the importer understands, in one payload.
 *
 * It doubles as the documentation — "Load sample" is how an author finds out
 * what can be set. Its item titles are filled from content that actually exists
 * in THIS install, because an import can only link what is already there: a
 * sample of invented titles imports a path with nothing attached and reads as a
 * broken feature.
 */
export function importSample(content: SampleContent = {}): string {
  return JSON.stringify(
    {
      title: 'Distributed Systems in Practice',
      slug: 'distributed-systems-in-practice',
      summary: 'Design, build and operate services that keep working when parts of them do not.',
      description: '<p>A queue, a cache, and a service that survives losing both.</p>',
      banner: 'https://images.masteringbackend.com/paths/distributed/banner.png',
      preview: 'distributed-preview',
      level: 'Advanced',
      difficulty: 'Hard',
      timeframe: '8 weeks',
      estimatedWeeks: 8,
      hoursPerWeek: 6,
      instructor: 'Solomon Eseme',
      skills: ['Queues', 'Caching', 'Resilience'],
      prerequisites: ['REST API design'],
      languages: ['Go', 'Node.js'],
      isPremium: true,
      amount: 79,
      paddlePlanCode: 12345,
      paddle_price_id: 'pri_distributed_01',
      isWaiting: false,
      waitingLink: '',
      publish: false,
      topics: [
        {
          title: 'Failure is the normal case',
          slug: 'failure-is-the-normal-case',
          summary: 'Why a healthy system still drops requests.',
          description: '<p>Timeouts, retries and the thundering herd.</p>',
          banner: '',
          level: 'Intermediate',
          duration: 5,
          outcomes: ['Name the failure modes of a two-service call'],
          recommendation: 2,
          reference: '',
          isPremium: false,
          items: [
            { kind: 'course', title: content.course ?? 'A course that exists', order: 0 },
            {
              kind: 'article',
              title: content.article ?? 'An article that exists',
              order: 1,
              isOptional: true,
            },
          ],
        },
        {
          title: 'Queues and back pressure',
          level: 'Advanced',
          duration: 8,
          isPremium: true,
          items: [
            { kind: 'project', title: content.project ?? 'A project that exists', order: 0 },
            {
              kind: 'mock',
              title: content.mock ?? 'A mock interview that exists',
              order: 1,
              isOptional: true,
              type: 'VIDEO',
            },
            // A resource needs no counterpart in the library: give it a link and
            // the import creates it. Nothing else can be created this way.
            {
              kind: 'resource',
              title: 'The Twelve-Factor App',
              link: 'https://12factor.net',
              order: 2,
              isOptional: true,
            },
          ],
        },
      ],
    },
    null,
    2,
  );
}
