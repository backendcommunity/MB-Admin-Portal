import { describe, it, expect } from 'vitest';

import { fillFromJson, itemSample, itemPrompt } from '@/lib/courses/item-fill';
import type { ItemKind } from '@/lib/courses/items';

const KINDS: ItemKind[] = ['video', 'article', 'quiz', 'exercise'];

describe('fillFromJson — refusing what it cannot use', () => {
  it('asks for JSON rather than reporting a parse error on an empty box', () => {
    const result = fillFromJson('video', '   ');
    expect(result.error).toMatch(/paste/i);
    expect(result.patch).toEqual({});
  });

  it('quotes the parser when the JSON is malformed', () => {
    const result = fillFromJson('video', '{ "title": }');
    expect(result.error).toBeTruthy();
    expect(result.patch).toEqual({});
  });

  it('refuses a JSON array — a form is filled from one object, not a list', () => {
    const result = fillFromJson('video', '[{ "title": "A" }]');
    expect(result.error).toMatch(/one .*object|object/i);
    expect(result.patch).toEqual({});
  });

  it('refuses a document whose kind is a different item, naming both', () => {
    const result = fillFromJson('video', '{ "kind": "quiz", "title": "Mismatched" }');
    // Filling a video form from a quiz payload would half-fill it and leave
    // the author to work out why — better to say so than to guess.
    expect(result.error).toMatch(/quiz/i);
    expect(result.error).toMatch(/video/i);
    expect(result.patch).toEqual({});
  });

  it('accepts a bare object with no kind at all', () => {
    const result = fillFromJson('video', '{ "title": "No envelope" }');
    expect(result.error).toBeUndefined();
    expect(result.patch).toEqual({ title: 'No envelope' });
  });

  it('accepts the matching envelope and does not write kind into the form', () => {
    const result = fillFromJson('video', '{ "kind": "video", "title": "Enveloped" }');
    expect(result.patch).toEqual({ title: 'Enveloped' });
    expect(result.ignored).not.toContain('kind');
  });
});

describe('fillFromJson — only what was actually provided', () => {
  it('writes just the keys present, so nothing already typed is clobbered', () => {
    const result = fillFromJson('video', '{ "title": "Only a title" }');
    // No duration, no summary, no isPremium — a merge, not a reset.
    expect(result.patch).toEqual({ title: 'Only a title' });
    expect(result.filled).toEqual(['title']);
  });

  it('keeps an explicit falsy value — 0 and false are data, not absence', () => {
    const result = fillFromJson('video', '{ "duration": 0, "isPremium": false }');
    expect(result.patch).toEqual({ duration: 0, isPremium: false });
  });

  it('treats an explicit null as absent rather than writing null into the form', () => {
    const result = fillFromJson('video', '{ "title": "Kept", "summary": null }');
    expect(result.patch).toEqual({ title: 'Kept' });
  });

  it('reports keys it does not know instead of dropping them silently', () => {
    const result = fillFromJson('video', '{ "title": "T", "durationSeconds": 90, "nope": 1 }');
    expect(result.patch).toEqual({ title: 'T' });
    expect(result.ignored).toEqual(['durationSeconds', 'nope']);
    expect(result.error).toBeUndefined();
  });
});

describe('fillFromJson — video', () => {
  it('coerces a stringified number into the number the form holds', () => {
    const result = fillFromJson('video', '{ "duration": "720", "day": "2", "mb": "8" }');
    expect(result.patch).toEqual({ duration: 720, day: 2, mb: 8 });
  });

  it('ignores a duration that is not a number rather than writing NaN', () => {
    const result = fillFromJson('video', '{ "title": "T", "duration": "twelve" }');
    expect(result.patch).toEqual({ title: 'T' });
    expect(result.ignored).toContain('duration');
  });

  it('takes technologies as an array of strings', () => {
    const result = fillFromJson('video', '{ "technologies": ["Go", "Redis"] }');
    expect(result.patch).toEqual({ technologies: ['Go', 'Redis'] });
  });

  it('snaps difficulty to a value the form offers, noting the change', () => {
    const result = fillFromJson('video', '{ "difficulty": "advanced" }');
    expect(result.patch).toEqual({ difficulty: 'Advanced' });

    const bogus = fillFromJson('video', '{ "title": "T", "difficulty": "Impossible" }');
    expect(bogus.patch).toEqual({ title: 'T' });
    expect(bogus.notes.join(' ')).toMatch(/difficulty/i);
  });
});

describe('fillFromJson — article', () => {
  it('turns a plain content string into one prose block, so the editor shows it', () => {
    const result = fillFromJson('article', '{ "content": "Events decouple availability." }');
    // The block editor is what renders an article body — filling only
    // `content` would leave the author staring at an empty editor.
    expect(result.patch.blocks).toEqual([
      { type: 'html', html: expect.stringContaining('Events decouple availability.') },
    ]);
    expect(result.patch.content).toEqual(expect.stringContaining('Events decouple availability.'));
  });

  it('prefers declared blocks over a content string and derives content from them', () => {
    const raw = JSON.stringify({
      blocks: [{ type: 'html', html: '<p>From blocks</p>' }],
      content: 'ignored prose',
    });
    const result = fillFromJson('article', raw);
    expect(result.patch.blocks).toHaveLength(1);
    expect(String(result.patch.content)).toContain('From blocks');
    expect(String(result.patch.content)).not.toContain('ignored prose');
  });

  it('drops blocks of an unknown type and says so', () => {
    const raw = JSON.stringify({
      blocks: [{ type: 'html', html: '<p>Kept</p>' }, { type: 'hologram' }],
    });
    const result = fillFromJson('article', raw);
    expect(result.patch.blocks).toHaveLength(1);
    expect(result.notes.join(' ')).toMatch(/block/i);
  });

  it('carries the flat article fields through', () => {
    const raw = JSON.stringify({
      excerpt: 'Short',
      readingTime: 8,
      tags: ['events'],
      is_public: true,
    });
    const result = fillFromJson('article', raw);
    expect(result.patch).toMatchObject({
      excerpt: 'Short',
      readingTime: 8,
      tags: ['events'],
      is_public: true,
    });
  });
});

describe('fillFromJson — quiz', () => {
  it('normalises questions to the shape the form edits', () => {
    const raw = JSON.stringify({
      questions: [{ question: 'Pick one', options: ['a', 'b'], answer: 1 }],
    });
    const result = fillFromJson('quiz', raw);
    expect(result.patch.questions).toEqual([
      { prompt: 'Pick one', options: ['a', 'b'], answer: 1 },
    ]);
  });

  it('resolves a correctAnswer given as text to its option index', () => {
    const raw = JSON.stringify({
      questions: [{ prompt: 'Which?', options: ['Kafka', 'Redis'], correctAnswer: 'Redis' }],
    });
    const result = fillFromJson('quiz', raw);
    // Reading only `answer` here would silently mark option 0 correct for
    // every text-shaped payload — a wrong answer, filled without complaint.
    expect(result.patch.questions).toEqual([
      { prompt: 'Which?', options: ['Kafka', 'Redis'], answer: 1 },
    ]);
  });

  it('leaves an answer unmarked, and says so, when it names an option that is not there', () => {
    const raw = JSON.stringify({
      questions: [{ prompt: 'Which?', options: ['Kafka'], correctAnswer: 'Postgres' }],
    });
    const result = fillFromJson('quiz', raw);
    expect((result.patch.questions as { answer: number }[])[0].answer).toBe(-1);
    expect(result.notes.join(' ')).toMatch(/answer/i);
  });

  it('pads a question to the two options the form requires', () => {
    const raw = JSON.stringify({ questions: [{ prompt: 'Sparse', options: ['only'] }] });
    const result = fillFromJson('quiz', raw);
    expect((result.patch.questions as { options: string[] }[])[0].options).toHaveLength(2);
  });

  it('ignores a questions value that is not a list', () => {
    const result = fillFromJson('quiz', '{ "title": "T", "questions": "three of them" }');
    expect(result.patch).toEqual({ title: 'T' });
    expect(result.ignored).toContain('questions');
  });
});

describe('fillFromJson — exercise', () => {
  it('normalises test cases to input and expectedOutput', () => {
    const raw = JSON.stringify({
      testCases: [{ input: '2 3', expectedOutput: '5' }, { input: '0 0' }],
    });
    const result = fillFromJson('exercise', raw);
    expect(result.patch.testCases).toEqual([
      { input: '2 3', expectedOutput: '5' },
      { input: '0 0', expectedOutput: '' },
    ]);
  });

  it('snaps graderType to a supported grader', () => {
    const result = fillFromJson('exercise', '{ "graderType": "test_cases" }');
    expect(result.patch).toEqual({ graderType: 'TEST_CASES' });
  });

  it('keeps graderConfig as the object the editor expects', () => {
    const result = fillFromJson('exercise', '{ "graderConfig": { "command": "python3 main.py" } }');
    expect(result.patch).toEqual({ graderConfig: { command: 'python3 main.py' } });
  });

  it('carries languages, points and pass mark', () => {
    const raw = JSON.stringify({ languages: ['python'], points: 20, passMark: 80 });
    const result = fillFromJson('exercise', raw);
    expect(result.patch).toMatchObject({ languages: ['python'], points: 20, passMark: 80 });
  });
});

describe('samples and prompts', () => {
  it.each(KINDS)('offers a %s sample that fills its own form cleanly', (kind) => {
    const result = fillFromJson(kind, itemSample(kind));
    // A sample that its own parser rejects is worse than no sample at all.
    expect(result.error).toBeUndefined();
    expect(result.ignored).toEqual([]);
    expect(result.filled.length).toBeGreaterThan(2);
  });

  it.each(KINDS)('offers a %s prompt naming the kind and demanding JSON only', (kind) => {
    const prompt = itemPrompt(kind);
    expect(prompt.toLowerCase()).toContain(kind);
    expect(prompt).toMatch(/only .*json|json only/i);
    // The schema has to be in the prompt, or the model is guessing.
    expect(prompt).toContain('title');
  });
});
