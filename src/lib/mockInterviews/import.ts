import { DIFFICULTIES, STYLES } from '@/lib/mockInterviews/constants';
import type { TemplateInput } from '@/lib/api/mockInterviews';

/**
 * Parse one document, or an array, into template payloads.
 *
 * The coercions below are not invented for the importer — they are what
 * `normalizeSeedTemplate()` already does to seed rows, so a file written
 * against the OLD convention (genre in `format`, no `style`) imports as
 * intended rather than producing a template with no genre.
 *
 * Errors block the whole payload; coercions are reported and proceed. Nothing
 * here writes: the caller replays the same POST the form makes, once per row,
 * so there is one validation path and a partial failure is visible at the row
 * that failed.
 */

/** Server-owned or dead (`level` is NULL on every row and aliased to `seniority`). */
const IGNORED = ['id', 'createdAt', 'addedBy', 'isCustom', 'sourceJd', 'level'];

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

    const duration = Number(row.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      out.errors.push(`${at} ("${name}") has no usable duration.`);
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

    // ── topics ──
    let topics: string[] = [];
    if (Array.isArray(row.topics)) {
      const strings = row.topics.filter((t: unknown) => typeof t === 'string' && t.trim());
      const lost = row.topics.length - strings.length;
      if (lost) {
        out.notes.push(
          `${at}: ${lost} topic entr${lost === 1 ? 'y was' : 'ies were'} not a string — dropped.`,
        );
      }
      topics = [...new Set(strings.map((t: string) => t.trim()))];
      if (topics.length !== strings.length) out.notes.push(`${at}: duplicate topics removed.`);
    } else if (row.topics !== undefined) {
      out.notes.push(`${at}: "topics" is not an array — ignored.`);
    }

    // ── rubric ──
    // A non-positive weight is DROPPED and named. `parseRubric` on the server
    // discards it silently, which would leave a criterion that looks saved
    // and is never scored.
    const evaluationRubric: Array<{ criterion: string; weight: number; description: string }> = [];
    if (Array.isArray(row.evaluationRubric)) {
      row.evaluationRubric.forEach((c: any, j: number) => {
        const criterion = str(c?.criterion);
        const weight = Number(c?.weight);
        if (!criterion) {
          out.notes.push(`${at}: rubric entry ${j + 1} has no criterion — dropped.`);
          return;
        }
        if (!(weight > 0)) {
          out.notes.push(
            `${at}: "${criterion}" has weight ${c?.weight ?? 'none'} — dropped, the scorer discards it silently.`,
          );
          return;
        }
        evaluationRubric.push({ criterion, weight, description: str(c?.description) });
      });
    } else if (row.evaluationRubric !== undefined) {
      out.notes.push(`${at}: "evaluationRubric" is not an array — ignored.`);
    }

    let isPublic = Boolean(row.isPublic);
    if (isPublic && !canPublish) {
      out.notes.push(`${at}: imported as a draft — an instructor submits, an admin publishes.`);
      isPublic = false;
    }

    const questions = Number(row.questions);

    out.docs.push({
      name,
      summary: str(row.summary),
      description: str(row.description),
      company: str(row.company),
      position: str(row.position),
      seniority: str(row.seniority),
      style: (style || 'Technical') as TemplateInput['style'],
      format,
      category: str(row.category),
      difficulty: (difficulty || 'Medium') as TemplateInput['difficulty'],
      duration,
      questions: Number.isFinite(questions) && questions > 0 ? questions : null,
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
