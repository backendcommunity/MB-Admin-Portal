import { normalizeRichText } from '@/lib/richtext';
import {
  blocksToContent,
  blocksTextLength,
  parseBlocks,
  type ArticleBlock,
} from '@/lib/courses/blocks';
import { questionGaps, type DraftQuestion } from '@/lib/courses/quiz';
import type {
  Category,
  ChapterType,
  CourseInput,
  CourseType,
  Level,
  Modality,
} from '@/lib/api/courses';

/**
 * A whole course from one JSON document: record, category, chapters, videos,
 * articles, quizzes, exercises, capstone, and whether to publish.
 *
 * Validation happens before anything is written, and splits in two:
 *   errors — malformed input that would produce a broken course. Import blocked.
 *   notes  — recoverable input. The importer picks a default and says so.
 *
 * Projects and mock interviews are never created by an import: they are separate
 * products with their own authoring, so a document can only reference existing
 * ones by title or id.
 */

export const COURSE_TYPES: CourseType[] = ['VIDEO', 'TEXT', 'WORKSHOP'];
export const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced'];
export const CHAPTER_TYPES: ChapterType[] = ['MIXED', 'VIDEO', 'QUIZ', 'PLAYGROUND', 'EXERCISE'];
export const MODALITIES: Modality[] = ['CHAT', 'AUDIO', 'VIDEO'];

export type ImportItem =
  | {
      kind: 'video';
      title: string;
      slug: string;
      video: string;
      duration: number;
      summary: string;
      description: string;
      isPremium: boolean;
      complete: boolean;
      missing: string[];
    }
  | {
      kind: 'article';
      title: string;
      slug: string;
      content: string;
      blocks: ArticleBlock[];
      excerpt: string;
      readingTime: number;
      isPremium: boolean;
      complete: boolean;
      missing: string[];
    }
  | {
      kind: 'quiz';
      title: string;
      slug: string;
      description: string;
      passingScore: number;
      timeLimit: number;
      maxAttempts: number;
      difficulty: string;
      questions: DraftQuestion[];
      complete: boolean;
      missing: string[];
    }
  | {
      kind: 'exercise';
      title: string;
      slug: string;
      description: string;
      instructions: string;
      solution: string;
      starterCode: string;
      languages: string[];
      graderType: string;
      testCases: Array<{ input: string; expectedOutput: string }>;
      points: number;
      passMark: number;
      difficulty: string;
      complete: boolean;
      missing: string[];
    };

export type ImportChapter = {
  title: string;
  summary: string;
  description: string;
  slug: string;
  type: ChapterType;
  isPremium: boolean;
  items: ImportItem[];
};

export type ImportCapstone = {
  kind: 'project' | 'mock';
  id: string;
  title: string;
  isOptional: boolean;
  modality?: Modality;
};

export type ImportDocument = {
  course: CourseInput & { title: string };
  newCategory?: string;
  chapters: ImportChapter[];
  capstone: ImportCapstone[];
  publish: boolean;
};

export type ImportResult = {
  ok: boolean;
  errors: string[];
  notes: string[];
  doc: ImportDocument | null;
  counts: {
    chapters: number;
    video: number;
    article: number;
    quiz: number;
    exercise: number;
    capstone: number;
    incomplete: number;
  };
};

export type ImportCatalog = {
  categories: Category[];
  projects: Array<{ id: string; title: string }>;
  mockInterviews: Array<{ id: string; title: string }>;
  /** Slugs already taken, so a collision can be reported before the request. */
  takenSlugs?: string[];
};

export type ImportMode = 'course' | 'curriculum';

const KNOWN_COURSE_KEYS = new Set([
  'title',
  'slug',
  'summary',
  'description',
  'type',
  'category',
  'categoryId',
  'level',
  'tags',
  'languages',
  'isPublic',
  'isPremium',
  'amount',
  'paddlePriceId',
  'paddle_price_id',
  'paddlePlanCode',
  'banner',
  'preview',
  'vimeoFolderId',
  'isWaiting',
  'waitingLink',
  'chapters',
  'capstone',
  'publish',
]);

export function slugify(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : [];
}

function pickEnum<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
  path: string,
  notes: string[],
): T {
  if (value === undefined || value === null || value === '') return fallback;
  const upper = String(value).toUpperCase();
  const hit = options.find((option) => option.toUpperCase() === upper);
  if (hit) return hit;
  notes.push(`${path}: "${value}" is not one of ${options.join(', ')} — using ${fallback}`);
  return fallback;
}

function parseItem(
  raw: Record<string, unknown>,
  where: string,
  errors: string[],
  notes: string[],
): ImportItem | null {
  const kind = String(raw.kind ?? '').toLowerCase();
  const title = String(raw.title ?? '').trim();

  if (!kind) {
    errors.push(`${where} needs a kind (video, article, quiz or exercise).`);
    return null;
  }
  if (!['video', 'article', 'quiz', 'exercise'].includes(kind)) {
    errors.push(`${where}: unknown kind "${raw.kind}".`);
    return null;
  }
  if (!title) {
    errors.push(`${where}.title is required.`);
    return null;
  }

  const slug = slugify(String(raw.slug ?? title));

  if (kind === 'video') {
    const video = String(raw.video ?? '').trim();
    const duration = Number(raw.duration ?? 0);
    const missing: string[] = [];
    if (!video) missing.push('video source');
    if (!(duration > 0)) missing.push('duration');
    return {
      kind: 'video',
      title,
      slug,
      video,
      duration: Number.isFinite(duration) ? duration : 0,
      summary: String(raw.summary ?? ''),
      description: normalizeRichText(String(raw.description ?? '')),
      isPremium: raw.isPremium === undefined ? false : Boolean(raw.isPremium),
      complete: missing.length === 0,
      missing,
    };
  }

  if (kind === 'article') {
    // A document may bring a block body, or the older single content string.
    const declared = parseBlocks(raw.blocks);
    if (Array.isArray(raw.blocks) && declared.length !== (raw.blocks as unknown[]).length) {
      notes.push(`${where}: dropped block(s) with an unknown type.`);
    }
    const blocks = declared.map((block) =>
      block.type === 'html' ? { ...block, html: normalizeRichText(block.html) } : block,
    );
    const content = blocks.length
      ? blocksToContent(blocks)
      : normalizeRichText(String(raw.content ?? ''));

    const missing: string[] = [];
    if (blocks.length) {
      if (blocksTextLength(blocks) < 40) missing.push('prose in at least one block');
    } else if (content.replace(/<[^>]*>/g, '').trim().length < 40) {
      missing.push('a body');
    }

    return {
      kind: 'article',
      title,
      slug,
      content,
      blocks,
      excerpt: String(raw.excerpt ?? ''),
      readingTime: Number(raw.readingTime ?? 0) || 0,
      isPremium: raw.isPremium === undefined ? false : Boolean(raw.isPremium),
      complete: missing.length === 0,
      missing,
    };
  }

  if (kind === 'quiz') {
    const questions = (Array.isArray(raw.questions) ? raw.questions : []).map(
      (entry: unknown, index: number) => {
        const question = (entry ?? {}) as Record<string, unknown>;
        const options = asStringArray(question.options);
        while (options.length < 2) options.push('');

        // A payload may name the correct option either way. Reading only the
        // index used to silently mark option 0 correct for every text-shaped
        // payload — a wrong answer, imported without complaint.
        const text = String(question.question ?? question.prompt ?? '');
        const correct =
          typeof question.correctAnswer === 'string' ? question.correctAnswer.trim() : '';
        const matched = correct ? options.findIndex((option) => option.trim() === correct) : -1;

        let answer: number;
        if (matched >= 0) {
          answer = matched;
        } else if (correct) {
          // Named an answer that is not one of its own options.
          notes.push(
            `${where}.questions[${index}].correctAnswer is not one of its options — left unmarked.`,
          );
          answer = -1;
        } else {
          answer = Number(question.answer ?? -1);
          if (!Number.isFinite(answer) || answer < 0 || answer >= options.length) {
            notes.push(`${where}.questions[${index}] has no usable answer — left unmarked.`);
            answer = -1;
          }
        }

        return { prompt: text, options, answer };
      },
    );

    const description = String(raw.description ?? '');
    const missing: string[] = [];
    if (!description) missing.push('description');
    const questionGap = questionGaps(questions);
    if (questionGap) missing.push(questionGap);

    return {
      kind: 'quiz',
      title,
      slug,
      description,
      passingScore: Number(raw.passingScore ?? 60),
      timeLimit: Number(raw.timeLimit ?? 15),
      maxAttempts: Number(raw.maxAttempts ?? 5),
      difficulty: pickEnum(
        raw.difficulty,
        ['Easy', 'Medium', 'Hard'] as const,
        'Easy',
        `${where}.difficulty`,
        notes,
      ),
      questions,
      complete: missing.length === 0,
      missing,
    };
  }

  const testCases = (Array.isArray(raw.testCases) ? raw.testCases : []).map((entry: unknown) => {
    const testCase = (entry ?? {}) as Record<string, unknown>;
    return {
      input: String(testCase.input ?? ''),
      expectedOutput: String(testCase.expectedOutput ?? ''),
    };
  });
  const languages = asStringArray(raw.languages);
  const description = String(raw.description ?? '');
  const instructions = normalizeRichText(String(raw.instructions ?? ''));
  const solution = String(raw.solution ?? '');

  const missing: string[] = [];
  if (!description) missing.push('description');
  if (!instructions) missing.push('instructions');
  if (!languages.length) missing.push('a language');
  if (!testCases.some((testCase) => testCase.expectedOutput)) {
    missing.push('one test case with expected output');
  }
  if (!solution) missing.push('reference solution');

  return {
    kind: 'exercise',
    title,
    slug,
    description,
    instructions,
    solution,
    starterCode: String(raw.starterCode ?? ''),
    languages,
    graderType: pickEnum(
      raw.graderType,
      ['OUTPUT_MATCH', 'FUNCTION_CALL', 'TEST_CASES', 'CUSTOM'] as const,
      'OUTPUT_MATCH',
      `${where}.graderType`,
      notes,
    ),
    testCases,
    points: Number(raw.points ?? 10),
    passMark: Number(raw.passMark ?? 60),
    difficulty: pickEnum(
      raw.difficulty,
      ['Easy', 'Medium', 'Hard'] as const,
      'Easy',
      `${where}.difficulty`,
      notes,
    ),
    complete: missing.length === 0,
    missing,
  };
}

export function parseImport(
  text: string,
  catalog: ImportCatalog,
  mode: ImportMode = 'course',
): ImportResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const counts = {
    chapters: 0,
    video: 0,
    article: 0,
    quiz: 0,
    exercise: 0,
    capstone: 0,
    incomplete: 0,
  };

  if (!text || !text.trim()) {
    return { ok: false, errors: ['Paste a JSON document first.'], notes, doc: null, counts };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [`Invalid JSON — ${(error as Error).message}`],
      notes,
      doc: null,
      counts,
    };
  }

  if (Array.isArray(raw)) {
    if (mode === 'curriculum') raw = { chapters: raw };
    else {
      return {
        ok: false,
        errors: ['The document must be a single course object, not an array.'],
        notes,
        doc: null,
        counts,
      };
    }
  }
  if (!raw || typeof raw !== 'object') {
    return {
      ok: false,
      errors: ['The document must be a single course object.'],
      notes,
      doc: null,
      counts,
    };
  }

  const source = raw as Record<string, unknown>;
  Object.keys(source).forEach((key) => {
    if (!KNOWN_COURSE_KEYS.has(key)) notes.push(`Unknown field "${key}" — ignored.`);
  });

  const title = String(source.title ?? '').trim();
  if (mode === 'course' && !title) errors.push('title is required.');
  if (mode === 'curriculum' && !Array.isArray(source.chapters)) {
    errors.push('Needs a chapters array.');
  }

  let slug = slugify(String(source.slug ?? title));
  if (mode === 'course' && slug && catalog.takenSlugs?.includes(slug)) {
    const suffixed = `${slug}-2`;
    notes.push(`Slug "${slug}" is taken — importing as "${suffixed}".`);
    slug = suffixed;
  }

  let categoryId: string | null = null;
  let newCategory: string | undefined;
  if (source.categoryId) {
    categoryId = String(source.categoryId);
  } else if (source.category) {
    const wanted = String(source.category);
    const found = catalog.categories.find(
      (category) => category.name.toLowerCase() === wanted.toLowerCase(),
    );
    if (found) categoryId = found.id;
    else {
      newCategory = wanted;
      notes.push(`No category named "${wanted}" yet — it will be created.`);
    }
  }

  const course: CourseInput & { title: string } = {
    title,
    slug,
    summary: String(source.summary ?? ''),
    description: normalizeRichText(String(source.description ?? '')),
    type: pickEnum(source.type, COURSE_TYPES, 'VIDEO', 'type', notes),
    level: source.level ? pickEnum(source.level, LEVELS, 'Beginner', 'level', notes) : null,
    categoryId,
    tags: asStringArray(source.tags),
    languages: asStringArray(source.languages),
    isPremium: Boolean(source.isPremium),
    amount: Number(source.amount ?? 0) || 0,
    paddle_price_id: String(source.paddle_price_id ?? source.paddlePriceId ?? '') || null,
    banner: String(source.banner ?? ''),
    preview: String(source.preview ?? '') || null,
    vimeoFolderId: String(source.vimeoFolderId ?? '') || null,
    isWaiting: Boolean(source.isWaiting),
    waitingLink: String(source.waitingLink ?? '') || null,
  };

  const chapters: ImportChapter[] = [];
  (Array.isArray(source.chapters) ? source.chapters : []).forEach((entry, index) => {
    const where = `chapters[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${where} is not an object.`);
      return;
    }
    const rawChapter = entry as Record<string, unknown>;
    const chapterTitle = String(rawChapter.title ?? '').trim();
    if (!chapterTitle) errors.push(`${where}.title is required.`);

    const items: ImportItem[] = [];
    (Array.isArray(rawChapter.items) ? rawChapter.items : []).forEach((rawItem, itemIndex) => {
      const item = parseItem(
        (rawItem ?? {}) as Record<string, unknown>,
        `${where}.items[${itemIndex}]`,
        errors,
        notes,
      );
      if (!item) return;
      counts[item.kind] += 1;
      if (!item.complete) {
        counts.incomplete += 1;
        notes.push(
          `${where}.items[${itemIndex}] ("${item.title}") imports incomplete: needs ${item.missing.join(', ')}.`,
        );
      }
      items.push(item);
    });

    chapters.push({
      title: chapterTitle,
      summary: String(rawChapter.summary ?? ''),
      description: normalizeRichText(String(rawChapter.description ?? '')),
      slug: slugify(String(rawChapter.slug ?? chapterTitle)),
      type: pickEnum(rawChapter.type, CHAPTER_TYPES, 'MIXED', `${where}.type`, notes),
      isPremium: rawChapter.isPremium === undefined ? true : Boolean(rawChapter.isPremium),
      items,
    });
    counts.chapters += 1;
  });

  const capstone: ImportCapstone[] = [];
  (Array.isArray(source.capstone) ? source.capstone : []).forEach((entry, index) => {
    const where = `capstone[${index}]`;
    if (!entry || typeof entry !== 'object') {
      errors.push(`${where} needs a kind of project or mock.`);
      return;
    }
    const rawLink = entry as Record<string, unknown>;
    const kind = String(rawLink.kind ?? '').toLowerCase();
    if (kind !== 'project' && kind !== 'mock') {
      errors.push(`${where}: unknown kind "${rawLink.kind}".`);
      return;
    }
    const pool = kind === 'project' ? catalog.projects : catalog.mockInterviews;
    const wanted = String(rawLink.title ?? rawLink.id ?? '');
    const found = pool.find(
      (candidate) =>
        candidate.id === rawLink.id || candidate.title.toLowerCase() === wanted.toLowerCase(),
    );
    if (!found) {
      notes.push(
        `${where}: no ${kind} named "${wanted}" exists — skipped. Create it first, then attach.`,
      );
      return;
    }
    capstone.push({
      kind,
      id: found.id,
      title: found.title,
      isOptional: rawLink.isOptional === undefined ? kind === 'mock' : Boolean(rawLink.isOptional),
      ...(kind === 'mock'
        ? {
            modality: pickEnum(rawLink.modality, MODALITIES, 'CHAT', `${where}.modality`, notes),
          }
        : {}),
    });
    counts.capstone += 1;
  });

  let publish = Boolean(source.publish || source.isPublic);
  if (publish && mode === 'course') {
    // Readiness is probed against the course as it *will* exist: a document that
    // brings a brand new category is judged as already having one.
    const hasContent = chapters.some((chapter) =>
      chapter.items.some((item) => item.kind === 'video' || item.kind === 'article'),
    );
    const blockers: string[] = [];
    if (!course.summary || course.summary.length < 40) blockers.push('summary');
    if (!course.banner) blockers.push('banner');
    if (!categoryId && !newCategory) blockers.push('category');
    if (!course.level) blockers.push('level');
    if (!hasContent) blockers.push('a chapter with content');
    if (course.isPremium && (!course.amount || !course.paddle_price_id)) {
      blockers.push('premium pricing');
    }
    if (blockers.length) {
      notes.push(
        `"publish": true — but ${blockers.join(', ')} still missing, so it imports as a draft.`,
      );
      publish = false;
    }
  }

  const ok = errors.length === 0;
  return {
    ok,
    errors,
    notes,
    counts,
    doc: ok ? { course, newCategory, chapters, capstone, publish } : null,
  };
}

/** A complete document that exercises every path, used by "Load sample". */
export function importSample(): string {
  return JSON.stringify(
    {
      title: 'Event-Driven Architecture',
      publish: true,
      summary:
        'Design systems that talk through events instead of calls — queues, brokers, idempotency, and the failure modes each one hides.',
      description: 'A practical tour, built around one order-processing system you refactor twice.',
      type: 'VIDEO',
      category: 'Architecture',
      level: 'Advanced',
      tags: ['events', 'queues', 'kafka'],
      languages: ['Go'],
      isPremium: true,
      amount: 59,
      paddlePriceId: 'pri_01hzz9k3',
      banner: 'https://cdn.masteringbackend.com/courses/event-driven.jpg',
      chapters: [
        {
          title: 'Why events',
          summary: 'The failure that makes teams reach for a broker.',
          type: 'MIXED',
          isPremium: false,
          items: [
            {
              kind: 'video',
              title: 'The call that never returns',
              video: 'vimeo:912334455',
              duration: 720,
            },
            {
              kind: 'article',
              title: 'Sync versus async, honestly',
              content:
                'Synchronous calls couple availability: your service is only as up as everything it calls. Events break that chain, and hand you three new problems in exchange.',
              readingTime: 8,
            },
            {
              kind: 'quiz',
              title: 'Coupling check',
              description: 'Two questions on availability coupling.',
              passingScore: 70,
              questions: [
                {
                  prompt: 'A synchronous call couples which property?',
                  options: ['Availability', 'Storage', 'Encoding', 'Latency only'],
                  answer: 0,
                },
                {
                  prompt: 'What does an event bus NOT give you for free?',
                  options: ['Ordering across partitions', 'Fan-out', 'Decoupling', 'Buffering'],
                  answer: 0,
                },
              ],
            },
          ],
        },
        {
          title: 'Idempotency',
          summary: 'At-least-once delivery means you will see it twice.',
          type: 'EXERCISE',
          isPremium: true,
          items: [
            {
              kind: 'video',
              title: 'Exactly-once is a lie',
              video: 'vimeo:912334477',
              duration: 880,
            },
            {
              kind: 'exercise',
              title: 'Make the handler idempotent',
              description: 'Given a duplicate-prone consumer, make it safe.',
              instructions:
                'Add a dedupe key so processing the same message twice has no extra effect.',
              solution:
                'func handle(m Msg) error { if seen(m.ID) { return nil }; return process(m) }',
              languages: ['Go'],
              graderType: 'TEST_CASES',
              points: 25,
              testCases: [{ input: 'msg-1\nmsg-1', expectedOutput: 'processed:1' }],
            },
          ],
        },
      ],
      capstone: [
        { kind: 'project', title: 'Ship a job queue', isOptional: false },
        { kind: 'mock', title: 'Backend systems screen', modality: 'VIDEO', isOptional: true },
      ],
    },
    null,
    2,
  );
}
