import { DIFFICULTIES, SERVER_LIMITS, STYLES } from '@/lib/mockInterviews/constants';
import type { TemplateInput } from '@/lib/api/mockInterviews';

/**
 * Parse one document, or an array, into template payloads.
 *
 * The coercions below are not invented for the importer — they are what
 * `normalizeSeedTemplate()` already does to seed rows, so a file written
 * against the OLD convention (genre in `format`, no `style`) imports as
 * intended rather than producing a template with no genre.
 *
 * Errors block the whole payload; coercions are reported and proceed. The
 * importer replays one POST per row, so a doc the server's Joi schema would
 * refuse has to be caught here first — otherwise a batch can write some rows
 * before the schema stops it on a later one, which is exactly what "nothing
 * is written until you press Import" promises won't happen. Every bound
 * checked below mirrors `SERVER_LIMITS` (constants.ts) field for field. The
 * rubric weight is the one exception that's DROPPED rather than refused,
 * matching how a too-low weight was always handled — see the rubric section.
 */

/** Server-owned or dead (`level` is NULL on every row and aliased to `seniority`). */
const IGNORED = ['id', 'createdAt', 'createdById', 'isCustom', 'sourceJd', 'level'];

const KNOWN = [
  'name',
  'summary',
  'description',
  'company',
  'position',
  'seniority',
  'style',
  'format',
  'category',
  'difficulty',
  'duration',
  'questions',
  'topics',
  'evaluationRubric',
  'isPublic',
];

export type ImportResult = {
  docs: TemplateInput[];
  errors: string[];
  notes: string[];
  counts: { total: number; withTopics: number; withRubric: number; published: number };
};

const empty = (): ImportResult => ({
  docs: [],
  errors: [],
  notes: [],
  counts: { total: 0, withTopics: 0, withRubric: 0, published: 0 },
});

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Pushes a blocking error and reports `true` when `value` is over `max` characters. */
function tooLong(
  out: ImportResult,
  at: string,
  field: string,
  value: string,
  max: number,
): boolean {
  if (value.length <= max) return false;
  out.errors.push(`${at}: "${field}" is ${value.length} characters — the limit is ${max}.`);
  return true;
}

export function parseTemplateImport(
  text: string,
  { canPublish }: { canPublish: boolean },
): ImportResult {
  const out = empty();
  if (!text.trim()) return out;

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    out.errors.push(`Not valid JSON — ${(error as Error).message}`);
    return out;
  }

  const rows = Array.isArray(raw) ? raw : [raw];
  if (!rows.length) out.errors.push('The array is empty.');

  const seen = new Set<string>();

  rows.forEach((row: any, i) => {
    const at = `Row ${i + 1}`;

    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      out.errors.push(`${at} is not an object.`);
      return;
    }

    const name = str(row.name);
    if (!name) {
      out.errors.push(`${at} has no name.`);
      return;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      out.errors.push(`${at}: "${name}" appears more than once in this payload.`);
      return;
    }
    seen.add(key);

    // ── duration: the server requires an INTEGER in [1, 600] ──
    const duration = Number(row.duration);
    if (!Number.isFinite(duration)) {
      out.errors.push(`${at} ("${name}") has no usable duration.`);
      return;
    }
    if (
      !Number.isInteger(duration) ||
      duration < SERVER_LIMITS.DURATION_MIN ||
      duration > SERVER_LIMITS.DURATION_MAX
    ) {
      out.errors.push(
        `${at} ("${name}"): duration must be a whole number of minutes from ${SERVER_LIMITS.DURATION_MIN} to ${SERVER_LIMITS.DURATION_MAX} (got ${row.duration}).`,
      );
      return;
    }

    // ── questions: optional, but the server requires an INTEGER in [1, 100] when present ──
    let questions: number | null = null;
    if (row.questions !== undefined && row.questions !== null) {
      const q = Number(row.questions);
      if (
        !Number.isFinite(q) ||
        !Number.isInteger(q) ||
        q < SERVER_LIMITS.QUESTIONS_MIN ||
        q > SERVER_LIMITS.QUESTIONS_MAX
      ) {
        out.errors.push(
          `${at} ("${name}"): questions must be a whole number from ${SERVER_LIMITS.QUESTIONS_MIN} to ${SERVER_LIMITS.QUESTIONS_MAX} (got ${row.questions}).`,
        );
        return;
      }
      questions = q;
    }

    // ── string length caps — every one of these mirrors the server's Joi
    // `.max()` exactly. Refusing is deliberate: truncating a description to
    // fit would lose text the caller would never know was dropped. ──
    const summary = str(row.summary);
    const description = str(row.description);
    const company = str(row.company);
    const position = str(row.position);
    const seniorityValue = str(row.seniority);
    const category = str(row.category);

    if (
      tooLong(out, at, 'name', name, SERVER_LIMITS.NAME_MAX) ||
      tooLong(out, at, 'summary', summary, SERVER_LIMITS.SUMMARY_MAX) ||
      tooLong(out, at, 'description', description, SERVER_LIMITS.DESCRIPTION_MAX) ||
      tooLong(out, at, 'company', company, SERVER_LIMITS.COMPANY_MAX) ||
      tooLong(out, at, 'position', position, SERVER_LIMITS.POSITION_MAX) ||
      tooLong(out, at, 'seniority', seniorityValue, SERVER_LIMITS.SENIORITY_MAX) ||
      tooLong(out, at, 'category', category, SERVER_LIMITS.CATEGORY_MAX)
    ) {
      return;
    }

    for (const field of Object.keys(row)) {
      if (IGNORED.includes(field))
        out.notes.push(`${at}: "${field}" is set by the server — ignored.`);
      else if (!KNOWN.includes(field)) out.notes.push(`${at}: unknown field "${field}" — ignored.`);
    }

    // ── the style/format repair, as normalizeSeedTemplate does it ──
    let style = str(row.style);
    let format = str(row.format);

    if (!style && (STYLES as readonly string[]).includes(format)) {
      style = format;
      format = 'Chat';
      out.notes.push(
        `${at}: "${style}" was in the format field — moved to style, and format set to Chat (old seed convention).`,
      );
    }
    if (style && !(STYLES as readonly string[]).includes(style)) {
      out.notes.push(
        `${at}: style "${style}" is not one of ${STYLES.join(', ')} — set to Technical.`,
      );
      style = 'Technical';
    }
    if (format && format !== 'Chat') {
      out.notes.push(`${at}: format "${format}" is not shipped — set to Chat.`);
    }
    format = 'Chat';

    let difficulty = str(row.difficulty);
    if (difficulty && !(DIFFICULTIES as readonly string[]).includes(difficulty)) {
      out.notes.push(`${at}: difficulty "${difficulty}" is not Easy/Medium/Hard — set to Medium.`);
      difficulty = 'Medium';
    }

    // ── topics: de-duplicate, drop non-strings, and refuse one over the cap ──
    let topics: string[] = [];
    if (Array.isArray(row.topics)) {
      const strings: string[] = [];
      let nonStringCount = 0;
      let lengthError: string | null = null;

      for (const t of row.topics) {
        if (typeof t !== 'string' || !t.trim()) {
          nonStringCount += 1;
          continue;
        }
        const trimmed = t.trim();
        if (trimmed.length > SERVER_LIMITS.TOPIC_MAX) {
          lengthError = `${at}: topic "${trimmed}" is ${trimmed.length} characters — the limit is ${SERVER_LIMITS.TOPIC_MAX}.`;
          break;
        }
        strings.push(trimmed);
      }

      if (lengthError) {
        out.errors.push(lengthError);
        return;
      }

      if (nonStringCount) {
        out.notes.push(
          `${at}: ${nonStringCount} topic entr${nonStringCount === 1 ? 'y was' : 'ies were'} not a string — dropped.`,
        );
      }
      topics = [...new Set(strings)];
      if (topics.length !== strings.length) out.notes.push(`${at}: duplicate topics removed.`);
    } else if (row.topics !== undefined) {
      out.notes.push(`${at}: "topics" is not an array — ignored.`);
    }

    // ── rubric ──
    // A weight below the server's minimum is DROPPED and named — the one
    // exception to "blocking, not silent" in this function. `parseRubric` on
    // the server filters on `weight >= RUBRIC_MIN_WEIGHT` and discards
    // anything else without saying so, which would leave a criterion that
    // looks saved and is never scored. Criterion and description length,
    // like every other bound, BLOCK the payload instead — truncating text
    // without telling anyone loses it silently, which is worse than refusing
    // the file.
    const evaluationRubric: Array<{ criterion: string; weight: number; description: string }> = [];
    if (Array.isArray(row.evaluationRubric)) {
      let blockingError: string | null = null;

      for (let j = 0; j < row.evaluationRubric.length; j += 1) {
        const c = row.evaluationRubric[j];
        const criterion = str(c?.criterion);
        if (!criterion) {
          out.notes.push(`${at}: rubric entry ${j + 1} has no criterion — dropped.`);
          continue;
        }
        if (criterion.length > SERVER_LIMITS.RUBRIC_CRITERION_MAX) {
          blockingError = `${at}: rubric entry ${j + 1} ("${criterion}") is ${criterion.length} characters — the limit is ${SERVER_LIMITS.RUBRIC_CRITERION_MAX}.`;
          break;
        }
        const rubricDescription = str(c?.description);
        if (rubricDescription.length > SERVER_LIMITS.RUBRIC_DESCRIPTION_MAX) {
          blockingError = `${at}: "${criterion}"'s description is ${rubricDescription.length} characters — the limit is ${SERVER_LIMITS.RUBRIC_DESCRIPTION_MAX}.`;
          break;
        }
        const weight = Number(c?.weight);
        if (!(weight >= SERVER_LIMITS.RUBRIC_MIN_WEIGHT)) {
          out.notes.push(
            `${at}: "${criterion}" has weight ${c?.weight ?? 'none'} — dropped, the server requires at least ${SERVER_LIMITS.RUBRIC_MIN_WEIGHT} and the scorer discards anything less silently.`,
          );
          continue;
        }
        evaluationRubric.push({ criterion, weight, description: rubricDescription });
      }

      if (blockingError) {
        out.errors.push(blockingError);
        return;
      }
    } else if (row.evaluationRubric !== undefined) {
      out.notes.push(`${at}: "evaluationRubric" is not an array — ignored.`);
    }

    let isPublic = Boolean(row.isPublic);
    if (isPublic && !canPublish) {
      out.notes.push(`${at}: imported as a draft — an instructor submits, an admin publishes.`);
      isPublic = false;
    }

    out.docs.push({
      name,
      summary,
      description,
      company,
      position,
      seniority: seniorityValue,
      style: (style || 'Technical') as TemplateInput['style'],
      format,
      category,
      difficulty: (difficulty || 'Medium') as TemplateInput['difficulty'],
      duration,
      questions,
      topics,
      evaluationRubric,
      isPublic,
    });
  });

  if (out.errors.length) out.docs = [];

  out.counts = {
    total: out.docs.length,
    withTopics: out.docs.filter((d) => (d.topics ?? []).length > 0).length,
    withRubric: out.docs.filter((d) => (d.evaluationRubric ?? []).length > 0).length,
    published: out.docs.filter((d) => d.isPublic).length,
  };

  return out;
}
