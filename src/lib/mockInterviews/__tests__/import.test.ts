import { describe, it, expect } from 'vitest';
import { parseTemplateImport } from '../import';
import { templateSample } from '../sample';

const ok = { name: 'Go Backend', duration: 30 };
const parse = (v: unknown, canPublish = true) =>
  parseTemplateImport(JSON.stringify(v), { canPublish });

describe('blocking errors', () => {
  it('reports invalid JSON and writes nothing', () => {
    const r = parseTemplateImport('{ not json', { canPublish: true });
    expect(r.errors[0]).toMatch(/not valid json/i);
    expect(r.docs).toHaveLength(0);
  });

  it('rejects a row that is not an object', () => {
    expect(parse(['a string']).errors[0]).toMatch(/not an object/i);
  });

  it('rejects a row with no name', () => {
    expect(parse([{ duration: 30 }]).errors[0]).toMatch(/no name/i);
  });

  it('rejects a row with no usable duration', () => {
    expect(parse([{ name: 'x' }]).errors[0]).toMatch(/duration/i);
    expect(parse([{ name: 'x', duration: 0 }]).errors[0]).toMatch(/duration/i);
    expect(parse([{ name: 'x', duration: 'thirty' }]).errors[0]).toMatch(/duration/i);
  });

  it('rejects two rows sharing a name, case-insensitively', () => {
    const r = parse([ok, { ...ok, name: 'GO BACKEND' }]);
    expect(r.errors[0]).toMatch(/more than once/i);
  });

  it('accepts a bare object as a single row', () => {
    const r = parse(ok);
    expect(r.errors).toHaveLength(0);
    expect(r.docs).toHaveLength(1);
  });

  it('clears docs entirely when a later row blocks, even if an earlier row was valid', () => {
    const r = parse([ok, { name: 'Bad row, no duration' }]);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.docs).toHaveLength(0);
  });
});

describe('coercions — reported, then imported', () => {
  it('moves a known style out of `format` and forces Chat (old seed convention)', () => {
    const r = parse([{ ...ok, format: 'System Design' }]);
    expect(r.docs[0].style).toBe('System Design');
    expect(r.docs[0].format).toBe('Chat');
    expect(r.notes.join(' ')).toMatch(/moved to style/i);
  });

  it('does not move `format` when a style is already set', () => {
    const r = parse([{ ...ok, style: 'Coding', format: 'Behavioral' }]);
    expect(r.docs[0].style).toBe('Coding');
    expect(r.docs[0].format).toBe('Chat');
  });

  it('forces an unshipped format to Chat', () => {
    const r = parse([{ ...ok, format: 'Audio' }]);
    expect(r.docs[0].format).toBe('Chat');
    expect(r.notes.join(' ')).toMatch(/not shipped/i);
  });

  it('replaces an unknown difficulty with Medium', () => {
    const r = parse([{ ...ok, difficulty: 'Expert' }]);
    expect(r.docs[0].difficulty).toBe('Medium');
    expect(r.notes.join(' ')).toMatch(/Expert/);
  });

  it('drops a rubric criterion whose weight is not positive, loudly', () => {
    const r = parse([
      {
        ...ok,
        evaluationRubric: [
          { criterion: 'Real', weight: 40 },
          { criterion: 'Fake', weight: 0 },
        ],
      },
    ]);
    expect(r.docs[0].evaluationRubric).toEqual([
      { criterion: 'Real', weight: 40, description: '' },
    ]);
    expect(r.notes.join(' ')).toMatch(/Fake/);
    expect(r.notes.join(' ')).toMatch(/silently/i);
  });

  it('drops a rubric entry with no criterion', () => {
    const r = parse([{ ...ok, evaluationRubric: [{ weight: 40 }] }]);
    expect(r.docs[0].evaluationRubric).toHaveLength(0);
    expect(r.notes.join(' ')).toMatch(/no criterion/i);
  });

  it('de-duplicates topics and drops non-strings', () => {
    const r = parse([{ ...ok, topics: ['a', 'a', 7, ' b '] }]);
    expect(r.docs[0].topics).toEqual(['a', 'b']);
    expect(r.notes.join(' ')).toMatch(/duplicate/i);
    expect(r.notes.join(' ')).toMatch(/not a string/i);
  });

  it('names server-owned and dead fields rather than dropping them silently', () => {
    const r = parse([{ ...ok, level: 'Senior', addedBy: 'x', isCustom: true, sourceJd: 'jd' }]);
    for (const field of ['level', 'addedBy', 'isCustom', 'sourceJd']) {
      expect(r.notes.join(' ')).toContain(field);
      expect(r.docs[0]).not.toHaveProperty(field);
    }
  });

  it('names an unknown field', () => {
    const r = parse([{ ...ok, estimatedSalary: '$180k' }]);
    expect(r.notes.join(' ')).toMatch(/estimatedSalary/);
  });

  it('downgrades isPublic to a draft when the caller cannot publish', () => {
    const r = parse([{ ...ok, isPublic: true }], false);
    expect(r.docs[0].isPublic).toBe(false);
    expect(r.notes.join(' ')).toMatch(/draft/i);
  });

  it('keeps isPublic when the caller can publish', () => {
    expect(parse([{ ...ok, isPublic: true }], true).docs[0].isPublic).toBe(true);
  });
});

describe('counts', () => {
  it('summarises what will be written', () => {
    const r = parse([
      { ...ok, topics: ['a'], evaluationRubric: [{ criterion: 'c', weight: 10 }], isPublic: true },
      { ...ok, name: 'Second' },
    ]);
    expect(r.counts).toEqual({ total: 2, withTopics: 1, withRubric: 1, published: 1 });
  });
});

describe('the shipped sample', () => {
  it('parses with no blocking errors and exercises every coercion', () => {
    const r = parseTemplateImport(templateSample, { canPublish: true });
    expect(r.errors).toHaveLength(0);
    expect(r.docs).toHaveLength(2);

    const notes = r.notes.join(' ');
    expect(notes).toMatch(/moved to style/i); // old convention
    expect(notes).toMatch(/Expert/); // bad difficulty
    expect(notes).toMatch(/duplicate/i); // repeated topic
    expect(notes).toMatch(/level/); // dead column
    expect(notes).toMatch(/estimatedSalary/); // unknown key
    expect(notes).toMatch(/silently/i); // zero weight
  });
});
