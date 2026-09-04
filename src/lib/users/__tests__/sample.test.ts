import { describe, it, expect } from 'vitest';
import { userSample } from '../sample';
import { parseUserImport } from '../import';

describe('userSample', () => {
  it('parses without errors', () => {
    const { errors } = parseUserImport(userSample, 'sample.json');
    expect(errors).toEqual([]);
  });

  it('exercises the not-obvious paths: a derived name, a case-only duplicate, and a malformed address', () => {
    const { counts } = parseUserImport(userSample, 'sample.json');
    // Locked to specific numbers on purpose — an edit that "cleans up" the
    // deliberately broken rows should fail this test, not slip through.
    expect(counts.derived).toBe(1);
    expect(counts.duplicates).toBe(1);
    expect(counts.invalid).toBe(1);
    expect(counts.total).toBe(3);
  });

  it('never uses a fake TLD or a real-looking gmail.com address', () => {
    expect(userSample).not.toMatch(/\.test\b/i);
    expect(userSample).not.toMatch(/\.local\b/i);
    expect(userSample).not.toMatch(/\.invalid\b/i);
    expect(userSample.toLowerCase()).not.toContain('gmail.com');
  });
});
