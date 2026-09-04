import { describe, it, expect } from 'vitest';
import { parseUserImport } from '../import';

describe('parseUserImport', () => {
  it('reads a CSV with a header row, in any column order', () => {
    const { rows, errors } = parseUserImport('email,name\nada@x.io,Ada Lovelace\n', 'r.csv');
    expect(errors).toEqual([]);
    expect(rows).toEqual([{ name: 'Ada Lovelace', email: 'ada@x.io' }]);
  });

  it('derives a name when the column is absent or blank', () => {
    const { rows, counts } = parseUserImport('email\ngrace@x.io\n', 'r.csv');
    expect(rows[0].name).toBe('Grace');
    expect(counts.derived).toBe(1);
  });

  it('reads a JSON array', () => {
    const { rows } = parseUserImport('[{"email":"ada@x.io","name":"Ada"}]', 'r.json');
    expect(rows).toEqual([{ name: 'Ada', email: 'ada@x.io' }]);
  });

  it('reports extra columns rather than dropping them silently', () => {
    const { notes } = parseUserImport('name,email,cohort\nAda,ada@x.io,C1\n', 'r.csv');
    expect(notes.join(' ')).toContain('cohort');
  });

  it('refuses a file with no email column', () => {
    const { errors } = parseUserImport('name\nAda\n', 'r.csv');
    expect(errors.join(' ')).toMatch(/email/i);
  });

  it('skips an invalid address and says which', () => {
    const { rows, notes } = parseUserImport('email\nada@x.io\nnope\n', 'r.csv');
    expect(rows).toHaveLength(1);
    expect(notes.join(' ')).toContain('nope');
  });

  it('de-duplicates within the file, keeping the first', () => {
    const { rows, counts } = parseUserImport('name,email\nAda,ada@x.io\nOther,ADA@x.io\n', 'r.csv');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Ada');
    expect(counts.duplicates).toBe(1);
  });
});
