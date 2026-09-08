import { describe, it, expect } from 'vitest';
import { fromApiQuestions, toApiQuestions, questionGaps } from '@/lib/courses/quiz';

describe('toApiQuestions', () => {
  it('renames the editor prompt to the field the API stores', () => {
    // `prompt` appears in no stored quiz row; sending it was a flat 422.
    const [question] = toApiQuestions([
      { prompt: 'Which is horizontal scaling?', options: ['More CPU', 'More servers'], answer: 1 },
    ]);

    expect(question.question).toBe('Which is horizontal scaling?');
    expect(question).not.toHaveProperty('prompt');
  });

  it('resolves the index to the option text the learner side grades against', () => {
    const [question] = toApiQuestions([{ prompt: 'Pick', options: ['wrong', 'right'], answer: 1 }]);

    expect(question.correctAnswer).toBe('right');
  });

  it('resolves the index before empty options are dropped', () => {
    // Trimming first would shift index 3 down to 1 and mark "b" correct.
    const [question] = toApiQuestions([
      { prompt: 'Pick', options: ['a', '', 'b', 'correct'], answer: 3 },
    ]);

    expect(question.correctAnswer).toBe('correct');
    expect(question.options).toEqual(['a', 'b', 'correct']);
  });

  it('keeps an explicit correctAnswer over an index', () => {
    const [question] = toApiQuestions([
      { question: 'Pick', options: ['a', 'b'], answer: 0, correctAnswer: 'b' },
    ]);

    expect(question.correctAnswer).toBe('b');
  });

  it('leaves correctAnswer empty when nothing is marked, rather than guessing', () => {
    const [question] = toApiQuestions([{ prompt: 'Pick', options: ['a', 'b'], answer: -1 }]);

    expect(question.correctAnswer).toBe('');
  });

  it('carries explanation and points only when present', () => {
    const [bare] = toApiQuestions([{ prompt: 'q', options: ['a', 'b'], answer: 0 }]);
    expect(bare).not.toHaveProperty('explanation');
    expect(bare).not.toHaveProperty('points');

    const [full] = toApiQuestions([
      { prompt: 'q', options: ['a', 'b'], answer: 0, explanation: 'because', points: 5 },
    ]);
    expect(full.explanation).toBe('because');
    expect(full.points).toBe(5);
  });
});

describe('fromApiQuestions', () => {
  it('resolves the stored text back to the index the editor radio needs', () => {
    const [question] = fromApiQuestions([
      { question: 'Pick', options: ['a', 'b', 'c'], correctAnswer: 'c' },
    ]);
    expect(question.answer).toBe(2);
    expect(question.prompt).toBe('Pick');
    expect(question.options).toEqual(['a', 'b', 'c']);
  });

  it('marks nothing correct when the stored text does not match one of its own options', () => {
    // A corrupted or externally-edited row — guessing would silently mark
    // the wrong option correct.
    const [question] = fromApiQuestions([
      { question: 'Pick', options: ['a', 'b'], correctAnswer: 'not an option' },
    ]);
    expect(question.answer).toBe(-1);
  });

  it('round-trips through toApiQuestions back to the same correct text', () => {
    const draft = fromApiQuestions([
      { question: 'Pick', options: ['a', 'b', 'c'], correctAnswer: 'b' },
    ]);
    const [api] = toApiQuestions(draft);
    expect(api.correctAnswer).toBe('b');
  });
});

describe('questionGaps', () => {
  it('accepts a complete question', () => {
    expect(questionGaps([{ prompt: 'q', options: ['a', 'b'], answer: 0 }])).toBeNull();
  });

  it('reports an empty list', () => {
    expect(questionGaps([])).toBe('at least one question');
  });

  it('reports a question with no marked answer, which the API would reject', () => {
    expect(questionGaps([{ prompt: 'q', options: ['a', 'b'], answer: -1 }])).toMatch(
      /marked answer/,
    );
  });

  it('reports fewer than two real options', () => {
    expect(questionGaps([{ prompt: 'q', options: ['a', '  '], answer: 0 }])).toMatch(/two options/);
  });
});
