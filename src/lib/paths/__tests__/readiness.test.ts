import { describe, it, expect } from 'vitest';
import { evaluatePathReadiness, isReady } from '@/lib/paths/readiness';
import type { Topic } from '@/lib/api/paths';

const topic = (over: Partial<Topic> = {}): Topic => ({
  id: 't1',
  title: 'How the Internet Works',
  slug: 'how-the-internet-works',
  summary: '',
  description: '',
  banner: '',
  level: 'Beginner',
  duration: 6,
  outcomes: [],
  recommendation: 1,
  reference: '',
  isPremium: false,
  order: 0,
  items: [{ kind: 'course', id: 'c1', title: 'Node.js Fundamentals', order: 0 }],
  ...over,
});

const path = {
  title: 'Backend Engineering',
  slug: 'backend-engineering',
  summary: 'A summary comfortably past the forty character minimum for publishing.',
  estimatedWeeks: 12,
  isPremium: false,
  amount: 0,
};

describe('evaluatePathReadiness', () => {
  it('passes a complete path', () => {
    expect(isReady(evaluatePathReadiness(path, [topic()]))).toBe(true);
  });

  it('fails a summary too short for the catalogue card', () => {
    const rules = evaluatePathReadiness({ ...path, summary: 'Too short.' }, [topic()]);
    expect(rules.find((r) => r.id === 'summary')?.ok).toBe(false);
  });

  it('fails a path with no topics', () => {
    const rules = evaluatePathReadiness(path, []);
    expect(rules.find((r) => r.id === 'topics')?.ok).toBe(false);
  });

  it('fails a topic with no content, and names it', () => {
    // An empty topic is a dead end: the learner opens it and there is nothing
    // to do, and compile-path emits a group with no steps.
    const rules = evaluatePathReadiness(path, [topic({ title: 'Empty one', items: [] })]);
    const rule = rules.find((r) => r.id === 'content');
    expect(rule?.ok).toBe(false);
    expect(rule?.detail).toContain('Empty one');
  });

  it('fails an untitled topic', () => {
    const rules = evaluatePathReadiness(path, [topic({ title: '  ' })]);
    expect(rules.find((r) => r.id === 'titled')?.ok).toBe(false);
  });

  it('requires a price on a premium path', () => {
    const paid = evaluatePathReadiness({ ...path, isPremium: true, amount: 0 }, [topic()]);
    expect(paid.find((r) => r.id === 'price')?.ok).toBe(false);

    const priced = evaluatePathReadiness({ ...path, isPremium: true, amount: 79 }, [topic()]);
    expect(priced.find((r) => r.id === 'price')?.ok).toBe(true);
  });

  it('requires a timeframe', () => {
    const rules = evaluatePathReadiness({ ...path, estimatedWeeks: 0 }, [topic()]);
    expect(rules.find((r) => r.id === 'estimatedWeeks')?.ok).toBe(false);
  });
});
