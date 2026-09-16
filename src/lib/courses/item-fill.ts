import { normalizeRichText } from '@/lib/richtext';
import { blocksToContent, parseBlocks } from '@/lib/courses/blocks';
import { slugify } from '@/lib/courses/import';
import { ITEM_LABELS, type ItemKind } from '@/lib/courses/items';

/**
 * Fills ONE open item form from a pasted JSON object.
 *
 * Deliberately not `parseImport`'s `parseItem`: that builds a complete item,
 * defaulting every absent key (`passingScore ?? 60`), which is right when a
 * document is creating a row from nothing and wrong here. This form is
 * already on screen, possibly half-typed, so an absent key must mean "leave
 * that field alone" — a defaulted value is indistinguishable from a provided
 * one by the time it reaches the form, and would quietly overwrite work.
 *
 * The vocabulary is the importer's, so one document shape serves both.
 */

export type FillResult = {
  /** Only the fields the JSON actually provided, coerced to the form's types. */
  patch: Record<string, unknown>;
  /** Field names written, for the "filled N fields" confirmation. */
  filled: string[];
  /** Keys in the JSON this form has no field for — surfaced, never silent. */
  ignored: string[];
  /** Coercions worth mentioning: a snapped enum, an unresolvable answer. */
  notes: string[];
  /** Set when nothing could be filled at all; `patch` is then empty. */
  error?: string;
};

type Coerced = { value?: unknown; note?: string; reject?: boolean };

/** A field's reader: turns one raw JSON value into what the form holds. */
type Reader = (raw: unknown, notes: string[]) => Coerced;

const asText: Reader = (raw) => ({ value: typeof raw === 'string' ? raw : String(raw) });

const asRichText: Reader = (raw) => ({
  value: normalizeRichText(typeof raw === 'string' ? raw : String(raw)),
});

const asNumber: Reader = (raw) => {
  const value = Number(raw);
  // A non-numeric duration is rejected rather than written as NaN — NaN in a
  // number input renders as an empty box that claims to hold a value.
  if (!Number.isFinite(value)) return { reject: true };
  return { value };
};

const asBool: Reader = (raw) => ({ value: Boolean(raw) });

const asSlug: Reader = (raw) => ({ value: slugify(String(raw)) });

const asStringList: Reader = (raw) => {
  if (!Array.isArray(raw)) return { reject: true };
  return { value: raw.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()) };
};

const asObject: Reader = (raw) => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { reject: true };
  return { value: raw };
};

/**
 * Snaps a free-text value onto one of the options the form offers. A value
 * that matches nothing is rejected with a note rather than written through —
 * the form's select would show it as blank, which reads as "not provided".
 */
function asEnum(options: readonly string[], label: string): Reader {
  return (raw) => {
    const wanted = String(raw)
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    const match = options.find((option) => option.toLowerCase().replace(/[\s-]+/g, '_') === wanted);
    if (!match) {
      return {
        reject: true,
        note: `"${raw}" is not a ${label} this form offers (${options.join(', ')}) — left as it was.`,
      };
    }
    return { value: match };
  };
}

const DIFFICULTY_TIERS = ['Easy', 'Medium', 'Hard'] as const;
const VIDEO_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
const GRADERS = ['OUTPUT_MATCH', 'FUNCTION_CALL', 'TEST_CASES', 'CUSTOM'] as const;

/**
 * Quiz questions, normalised to the `{prompt, options, answer}` triple the
 * form edits. The correct option may be named as text (`correctAnswer`) or as
 * an index (`answer`); text wins, because reading only the index would mark
 * option 0 correct for every text-shaped payload — a wrong answer, filled in
 * without complaint.
 */
const asQuestions: Reader = (raw, notes) => {
  if (!Array.isArray(raw)) return { reject: true };

  const value = raw.map((entry, index) => {
    const question = (entry ?? {}) as Record<string, unknown>;
    const options = Array.isArray(question.options)
      ? question.options.map((option) => String(option ?? ''))
      : [];
    // The form always renders at least two option inputs.
    while (options.length < 2) options.push('');

    const prompt = String(question.question ?? question.prompt ?? '');
    const correct = typeof question.correctAnswer === 'string' ? question.correctAnswer.trim() : '';
    const matched = correct ? options.findIndex((option) => option.trim() === correct) : -1;

    let answer: number;
    if (matched >= 0) {
      answer = matched;
    } else if (correct) {
      notes.push(
        `Question ${index + 1} names "${correct}", which is not one of its options — its answer is left unmarked.`,
      );
      answer = -1;
    } else {
      answer = Number(question.answer ?? -1);
      if (!Number.isFinite(answer) || answer < 0 || answer >= options.length) {
        notes.push(`Question ${index + 1} has no usable answer — left unmarked.`);
        answer = -1;
      }
    }

    return { prompt, options, answer };
  });

  return { value };
};

const asTestCases: Reader = (raw) => {
  if (!Array.isArray(raw)) return { reject: true };
  const value = raw.map((entry) => {
    const testCase = (entry ?? {}) as Record<string, unknown>;
    return {
      input: String(testCase.input ?? ''),
      expectedOutput: String(testCase.expectedOutput ?? ''),
    };
  });
  return { value };
};

/**
 * What each form accepts, keyed by the JSON key. The keys are the importer's,
 * so a document written for one works in the other.
 */
const FIELDS: Record<ItemKind, Record<string, Reader>> = {
  video: {
    title: asText,
    video: asText,
    duration: asNumber,
    summary: asText,
    description: asRichText,
    isPremium: asBool,
    slug: asSlug,
    difficulty: asEnum(VIDEO_LEVELS, 'difficulty'),
    day: asNumber,
    mb: asNumber,
    technologies: asStringList,
  },
  article: {
    title: asText,
    excerpt: asText,
    readingTime: asNumber,
    isPremium: asBool,
    slug: asSlug,
    tags: asStringList,
    categories: asStringList,
    featured_image: asText,
    image: asText,
    color: asText,
    type: asText,
    is_public: asBool,
    is_locked: asBool,
    // `blocks` and `content` are handled together, below.
  },
  quiz: {
    title: asText,
    description: asText,
    passingScore: asNumber,
    timeLimit: asNumber,
    maxAttempts: asNumber,
    difficulty: asEnum(DIFFICULTY_TIERS, 'difficulty'),
    questions: asQuestions,
  },
  exercise: {
    title: asText,
    description: asText,
    instructions: asRichText,
    solution: asText,
    starterCode: asText,
    hint: asText,
    languages: asStringList,
    graderType: asEnum(GRADERS, 'grader'),
    graderConfig: asObject,
    testCases: asTestCases,
    points: asNumber,
    passMark: asNumber,
    difficulty: asEnum(DIFFICULTY_TIERS, 'difficulty'),
  },
};

/**
 * An article body may arrive as structured `blocks` or as one `content`
 * string. The editor renders blocks, so a `content`-only payload becomes a
 * single prose block — otherwise the paste would report success and leave the
 * author looking at an empty editor.
 */
function fillArticleBody(
  source: Record<string, unknown>,
  patch: Record<string, unknown>,
  filled: string[],
  notes: string[],
) {
  const hasBlocks = source.blocks !== undefined && source.blocks !== null;
  const hasContent = source.content !== undefined && source.content !== null;
  if (!hasBlocks && !hasContent) return;

  const declared = parseBlocks(source.blocks);
  if (Array.isArray(source.blocks) && declared.length !== source.blocks.length) {
    notes.push('Dropped block(s) with an unknown type.');
  }

  const blocks = declared.length
    ? declared.map((block) =>
        block.type === 'html' ? { ...block, html: normalizeRichText(block.html) } : block,
      )
    : hasContent
      ? [{ type: 'html' as const, html: normalizeRichText(String(source.content)) }]
      : [];

  if (!blocks.length) return;

  patch.blocks = blocks;
  patch.content = blocksToContent(blocks);
  filled.push('body');
}

export function fillFromJson(kind: ItemKind, raw: string): FillResult {
  const empty: FillResult = { patch: {}, filled: [], ignored: [], notes: [] };

  if (!raw.trim()) {
    return { ...empty, error: 'Paste some JSON first.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ...empty, error: `That is not valid JSON — ${(err as Error).message}` };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      ...empty,
      error: 'Paste one JSON object — a whole course document goes through Import, not here.',
    };
  }

  const source = parsed as Record<string, unknown>;

  // An envelope naming a different item would half-fill this form and leave
  // the author to work out why.
  const declaredKind = typeof source.kind === 'string' ? source.kind.trim().toLowerCase() : '';
  if (declaredKind && declaredKind !== kind) {
    return {
      ...empty,
      error: `This JSON is for a ${declaredKind}, but you are editing a ${ITEM_LABELS[kind].toLowerCase()}.`,
    };
  }

  const readers = FIELDS[kind];
  const patch: Record<string, unknown> = {};
  const filled: string[] = [];
  const ignored: string[] = [];
  const notes: string[] = [];

  if (kind === 'article') fillArticleBody(source, patch, filled, notes);

  for (const [key, value] of Object.entries(source)) {
    if (key === 'kind') continue;
    if (kind === 'article' && (key === 'blocks' || key === 'content')) continue;
    // `null` reads as "no value", not as a value to write.
    if (value === undefined || value === null) continue;

    const reader = readers[key];
    if (!reader) {
      ignored.push(key);
      continue;
    }

    const result = reader(value, notes);
    if (result.note) notes.push(result.note);
    if (result.reject) {
      ignored.push(key);
      continue;
    }
    patch[key] = result.value;
    filled.push(key);
  }

  if (!filled.length) {
    return {
      ...empty,
      ignored,
      notes,
      error: ignored.length
        ? `Nothing here matches a ${ITEM_LABELS[kind].toLowerCase()} field. Unrecognised: ${ignored.join(', ')}.`
        : `That JSON has no ${ITEM_LABELS[kind].toLowerCase()} fields in it.`,
    };
  }

  return { patch, filled, ignored, notes };
}

const SAMPLES: Record<ItemKind, unknown> = {
  video: {
    kind: 'video',
    title: 'Exactly-once is a lie',
    video: 'vimeo:912334477',
    duration: 880,
    summary: 'Why at-least-once delivery is the only honest guarantee, and what it costs you.',
    description: 'Walks through a broker redelivering the same message mid-outage.',
    difficulty: 'Advanced',
    technologies: ['Kafka', 'Go'],
    isPremium: true,
  },
  article: {
    kind: 'article',
    title: 'Sync versus async, honestly',
    content:
      'Synchronous calls couple availability: your service is only as up as everything it calls. Events break that chain, and hand you three new problems in exchange.',
    excerpt: 'Events break the availability chain, and hand you three new problems.',
    readingTime: 8,
    tags: ['events', 'queues'],
    isPremium: false,
  },
  quiz: {
    kind: 'quiz',
    title: 'Idempotency basics',
    description: 'Checks that the reader can tell a safe retry from an unsafe one.',
    passingScore: 60,
    timeLimit: 15,
    maxAttempts: 5,
    difficulty: 'Medium',
    questions: [
      {
        prompt: 'A consumer sees the same message twice. What makes that safe?',
        options: [
          'The broker guarantees exactly-once',
          'The handler is idempotent',
          'The producer retries',
          'The queue is FIFO',
        ],
        correctAnswer: 'The handler is idempotent',
      },
    ],
  },
  exercise: {
    kind: 'exercise',
    title: 'Deduplicate a message stream',
    description: 'Drop messages already seen, keeping the first of each id.',
    instructions:
      'Read one JSON message per line from stdin. Print each message the first time its id appears, in order, and drop every repeat.',
    starterCode: 'import sys, json\n\nfor line in sys.stdin:\n    pass\n',
    solution:
      'import sys, json\n\nseen = set()\nfor line in sys.stdin:\n    msg = json.loads(line)\n    if msg["id"] in seen:\n        continue\n    seen.add(msg["id"])\n    print(line.strip())\n',
    hint: 'A set of ids you have already printed is enough.',
    languages: ['python'],
    graderType: 'OUTPUT_MATCH',
    testCases: [
      {
        input: '{"id":1,"body":"a"}\n{"id":1,"body":"a"}\n{"id":2,"body":"b"}',
        expectedOutput: '{"id":1,"body":"a"}\n{"id":2,"body":"b"}',
      },
    ],
    points: 20,
    passMark: 60,
    difficulty: 'Medium',
  },
};

export function itemSample(kind: ItemKind): string {
  return JSON.stringify(SAMPLES[kind], null, 2);
}

/**
 * A ready-made instruction for an author to paste into an assistant, so what
 * comes back fills this form without hand-editing. The schema is the sample:
 * a prompt that describes fields in prose invites a model to invent near-miss
 * key names, which land in `ignored` and look like the feature is broken.
 */
export function itemPrompt(kind: ItemKind): string {
  const label = ITEM_LABELS[kind].toLowerCase();
  return [
    `Write one ${label} for a backend-engineering course.`,
    '',
    'TOPIC: <replace this with your topic>',
    '',
    `Return ONLY a single JSON object in exactly this shape — no prose, no markdown fence, no commentary:`,
    '',
    itemSample(kind),
    '',
    'Rules:',
    `- Keep every key name exactly as above. Omit a key rather than inventing a new one.`,
    kind === 'quiz'
      ? '- Give each question 4 options, and set correctAnswer to the exact text of the right one.'
      : kind === 'exercise'
        ? '- Give at least 3 test cases, and make sure the solution really produces each expectedOutput.'
        : '- Write real content, not placeholders.',
    '- Omit any field you are unsure about; the form keeps its current value.',
  ].join('\n');
}
