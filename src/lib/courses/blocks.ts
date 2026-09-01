import { richTextLength } from '@/lib/richtext';

/**
 * The article body format the learner app renders (`path-article.tsx`): prose
 * interleaved with runnable playgrounds and inline checkpoints. `content` remains
 * as a plain-prose fallback for anything still reading the old column — the
 * renderer prefers `blocks` whenever it is non-empty.
 */
export type ArticleBlock =
  | { type: 'html'; html: string }
  | { type: 'playground'; language?: string | null; code?: string; title?: string | null }
  | {
      type: 'quiz';
      question: string;
      options: string[];
      answer: number;
      explanation?: string | null;
    };

/**
 * D1 (instructor-authoring-fixes plan): the playground block's Language field
 * was free text, so an instructor could type anything the runner cannot
 * execute. This list is a manual, one-time mirror of `enum ProgrammingLanguage`
 * in `academy/prisma/schema.prisma` — verified against
 * `mb-executor/src/config/constants.ts`'s `LANGUAGES` map, which supports all
 * thirteen (node/python/php/ruby/java/c/cpp/go/rust/csharp/kotlin/scala/perl),
 * so nothing here needs to be excluded as a broken choice.
 *
 * The two repos are not wired together, so this list CAN drift from the
 * schema enum if a language is ever added or removed there — that is a
 * deliberate, visible cost, not a bug. Do not build a sync mechanism for it;
 * just keep this comment (and this file) in view when the enum changes.
 *
 * Values are the human-readable strings articles already store (the sample
 * data in `v3-masteringbackend/app/preview/article/page.tsx` uses `"Python"`
 * — not the enum's `PYTHON` key, and not the executor's lowercase `python`),
 * so this is a stricter INPUT on the same free-text column, not a new format.
 */
export const PLAYGROUND_LANGUAGES = [
  { value: 'Node.js', enumKey: 'NODEJS' },
  { value: 'Python', enumKey: 'PYTHON' },
  { value: 'PHP', enumKey: 'PHP' },
  { value: 'Ruby', enumKey: 'RUBY' },
  { value: 'Java', enumKey: 'JAVA' },
  { value: 'C', enumKey: 'C' },
  { value: 'C++', enumKey: 'CPP' },
  { value: 'Go', enumKey: 'GO' },
  { value: 'Rust', enumKey: 'RUST' },
  { value: 'C#', enumKey: 'CSHARP' },
  { value: 'Kotlin', enumKey: 'KOTLIN' },
  { value: 'Scala', enumKey: 'SCALA' },
  { value: 'Perl', enumKey: 'PERL' },
] as const;

export function isArticleBlock(value: unknown): value is ArticleBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as { type?: unknown };
  return block.type === 'html' || block.type === 'playground' || block.type === 'quiz';
}

export function parseBlocks(value: unknown): ArticleBlock[] {
  return Array.isArray(value) ? value.filter(isArticleBlock) : [];
}

/** Prose only — what the legacy `content` column holds when blocks are authored. */
export function blocksToContent(blocks: ArticleBlock[]): string {
  return blocks
    .filter((block): block is Extract<ArticleBlock, { type: 'html' }> => block.type === 'html')
    .map((block) => block.html)
    .join('\n');
}

/** Rendered prose length across every html block, for the completeness rule. */
export function blocksTextLength(blocks: ArticleBlock[]): number {
  return blocks.reduce(
    (total, block) => total + (block.type === 'html' ? richTextLength(block.html) : 0),
    0,
  );
}

/**
 * What a half-finished block is missing. Reported per block so an author can see
 * which one needs attention rather than a single "article incomplete".
 */
export function blockGaps(blocks: ArticleBlock[]): string[] {
  const gaps: string[] = [];
  blocks.forEach((block, index) => {
    const where = `block ${index + 1}`;
    if (block.type === 'html' && richTextLength(block.html) === 0) {
      gaps.push(`${where} (prose) is empty`);
    }
    if (block.type === 'playground' && !(block.code ?? '').trim()) {
      gaps.push(`${where} (playground) has no code`);
    }
    if (block.type === 'quiz') {
      if (!block.question.trim()) gaps.push(`${where} (checkpoint) has no question`);
      else if (block.options.filter((option) => option.trim()).length < 2) {
        gaps.push(`${where} (checkpoint) needs two options`);
      }
    }
  });
  return gaps;
}
