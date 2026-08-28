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
