import { describe, it, expect } from 'vitest';
import { evaluateReadiness, isReady, failuresToRules } from '../readiness';
import type { Chapter } from '@/lib/api/courses';

const chapterWith = (kinds: Array<'video' | 'article' | 'quiz'>): Chapter => ({
  id: 'ch1',
  title: 'Ch',
  summary: null,
  description: null,
  banner: null,
  slug: 'ch',
  type: 'MIXED',
  isPremium: true,
  order: 0,
  items: kinds.map((kind, index) => ({ id: `i${index}`, kind, title: 'x' })),
});

const ready = {
  title: 'Node.js Fundamentals',
  summary: 'A long enough summary to satisfy the catalogue card minimum length rule.',
  type: 'VIDEO' as const,
  banner: 'https://cdn/a.jpg',
  categoryId: 'cat-1',
  level: 'Beginner' as const,
  isPremium: false,
  isWaiting: false,
  chapters: [chapterWith(['video'])],
};

describe('evaluateReadiness', () => {
  it('passes a complete free course', () => {
    expect(isReady(ready)).toBe(true);
  });

  it('fails a summary under the minimum', () => {
    const rules = evaluateReadiness({ ...ready, summary: 'too short' });
    expect(rules.find((rule) => rule.field === 'title')?.ok).toBe(false);
    expect(isReady({ ...ready, summary: 'too short' })).toBe(false);
  });

  it('measures the summary as text, so markup cannot pad it', () => {
    const padded = '<p></p><p></p><p></p><p></p><p></p><p></p>';
    expect(isReady({ ...ready, summary: padded })).toBe(false);
  });

  it('fails without a banner, category or level', () => {
    expect(isReady({ ...ready, banner: '' })).toBe(false);
    expect(isReady({ ...ready, categoryId: null })).toBe(false);
    expect(isReady({ ...ready, level: null })).toBe(false);
  });

  it('needs a chapter that actually holds a video or article', () => {
    expect(isReady({ ...ready, chapters: [] })).toBe(false);
    expect(isReady({ ...ready, chapters: [chapterWith([])] })).toBe(false);
    // a chapter holding only an attached quiz is not content
    expect(isReady({ ...ready, chapters: [chapterWith(['quiz'])] })).toBe(false);
    expect(isReady({ ...ready, chapters: [chapterWith(['article'])] })).toBe(true);
  });

  it('adds pricing rules only for premium courses', () => {
    const free = evaluateReadiness(ready);
    expect(free.find((rule) => rule.field === 'paddle_price_id')).toBeUndefined();
    expect(free.find((rule) => rule.field === 'amount')?.na).toBe(true);

    const premium = evaluateReadiness({ ...ready, isPremium: true, amount: 0 });
    expect(premium.find((rule) => rule.field === 'amount')?.ok).toBe(false);
    expect(premium.find((rule) => rule.field === 'paddle_price_id')?.ok).toBe(false);

    expect(isReady({ ...ready, isPremium: true, amount: 49, paddle_price_id: 'pri_1' })).toBe(true);
  });

  it('requires a valid link in waitlist mode', () => {
    expect(isReady({ ...ready, isWaiting: true, waitingLink: 'nope' })).toBe(false);
    expect(isReady({ ...ready, isWaiting: true, waitingLink: 'https://mb.dev/wait' })).toBe(true);
  });
});

describe('failuresToRules', () => {
  it('turns the API 422 payload back into panel rows', () => {
    const rules = failuresToRules([{ field: 'chapters', message: 'Add a chapter' }]);
    expect(rules).toEqual([{ field: 'chapters', label: 'Add a chapter', ok: false }]);
  });
});
