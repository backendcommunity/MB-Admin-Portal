import { toDisplayName, toExecutorCode, STATIC_LANGUAGES } from '../exercise-languages';

describe('toExecutorCode', () => {
  it('maps a display name to its executor code', () => {
    expect(toExecutorCode('Java')).toBe('java');
  });

  it('is idempotent on a code already', () => {
    expect(toExecutorCode('java')).toBe('java');
  });

  it('maps a multi-word display name to its code', () => {
    expect(toExecutorCode('Node.js')).toBe('node');
  });

  it('passes through a value that already looks like a code', () => {
    expect(toExecutorCode('cpp')).toBe('cpp');
  });

  it('leaves an unrecognised value unchanged', () => {
    expect(toExecutorCode('COBOL')).toBe('COBOL');
  });
});

describe('toDisplayName', () => {
  it('maps a code back to its picker display name', () => {
    expect(toDisplayName('java')).toBe('Java');
  });

  it('maps the node code back to its display name', () => {
    expect(toDisplayName('node')).toBe('Node.js');
  });

  it('leaves an unrecognised code unchanged, so off-list values still show', () => {
    expect(toDisplayName('cobol')).toBe('cobol');
  });
});

describe('STATIC_LANGUAGES', () => {
  it('lists the languages that need a typed FUNCTION_CALL signature', () => {
    expect(STATIC_LANGUAGES).toContain('java');
    expect(STATIC_LANGUAGES).toContain('c');
    expect(STATIC_LANGUAGES).toContain('cpp');
    expect(STATIC_LANGUAGES).not.toContain('python');
    expect(STATIC_LANGUAGES).not.toContain('node');
  });
});
