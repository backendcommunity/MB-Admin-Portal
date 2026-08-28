import { richTextLength } from '@/lib/richtext';
import { blockGaps, blocksTextLength, parseBlocks } from '@/lib/courses/blocks';
import type { ChapterItem } from '@/lib/api/courses';

/**
 * What makes a chapter item finished. One source of truth: the builder's
 * "incomplete" badge, the drawer's status banner and the JSON importer all read
 * these, so they cannot drift apart and tell an author different stories.
 *
 * Incomplete is a legitimate saved state — it blocks publish, never a save.
 */
export type ItemKind = 'video' | 'article' | 'quiz' | 'exercise';

export const ITEM_LABELS: Record<ItemKind, string> = {
  video: 'Video',
  article: 'Article',
  quiz: 'Quiz',
  exercise: 'Exercise',
};

/**
 * Videos and articles carry a required chapterId — they are born in the chapter
 * and die with it. Quizzes and exercises are library rows joined to it.
 */
export const ITEM_OWNED: Record<ItemKind, boolean> = {
  video: true,
  article: true,
  quiz: false,
  exercise: false,
};

export const ITEM_BLURB: Record<ItemKind, string> = {
  video: 'created in this chapter',
  article: 'created in this chapter',
  quiz: 'library item · reusable',
  exercise: 'library item · reusable',
};

type Draftish = Record<string, unknown>;

function str(source: Draftish, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function missingFor(kind: ItemKind, source: Draftish): string[] {
  const gaps: string[] = [];
  if (!str(source, 'title').trim()) gaps.push('title');

  if (kind === 'video') {
    if (!str(source, 'video').trim()) gaps.push('video source');
    if (!(Number(source.duration ?? 0) > 0)) gaps.push('duration');
    return gaps;
  }

  if (kind === 'article') {
    // Bodies are blocks now; `content` is only the fallback for older articles.
    const blocks = parseBlocks(source.blocks);
    if (blocks.length) {
      if (blocksTextLength(blocks) < 40) gaps.push('prose in at least one block');
      gaps.push(...blockGaps(blocks));
    } else if (richTextLength(str(source, 'content')) < 40) {
      gaps.push('a body — add at least one block');
    }
    return gaps;
  }

  if (kind === 'quiz') {
    if (!str(source, 'description').trim()) gaps.push('description');
    const questions = (source.questions as Array<{ prompt?: string; options?: string[] }>) ?? [];
    if (!questions.length) gaps.push('at least one question');
    else if (
      !questions.every(
        (question) =>
          question.prompt && (question.options ?? []).filter((option) => option.trim()).length >= 2,
      )
    ) {
      gaps.push('a prompt and two options on every question');
    }
    return gaps;
  }

  if (!str(source, 'description').trim()) gaps.push('description');
  if (!str(source, 'instructions').trim()) gaps.push('instructions');
  if (!((source.languages as string[]) ?? []).length) gaps.push('a language');
  const cases = (source.testCases as Array<{ expectedOutput?: string }>) ?? [];
  if (!cases.some((testCase) => testCase.expectedOutput)) gaps.push('one test case with output');
  if (!str(source, 'solution').trim()) gaps.push('reference solution');
  return gaps;
}

/**
 * For a row already on the server. Attached library items are validated where
 * they are authored, so the builder only judges what the course owns — it has no
 * copy of the quiz's questions to check against.
 */
export function itemMissing(item: ChapterItem): string[] {
  if (!ITEM_OWNED[item.kind as ItemKind]) return [];
  return missingFor(item.kind as ItemKind, item as unknown as Draftish);
}

export function itemComplete(item: ChapterItem): boolean {
  return itemMissing(item).length === 0;
}
