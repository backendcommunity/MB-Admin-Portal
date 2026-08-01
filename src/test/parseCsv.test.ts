import { describe, it, expect } from 'vitest';
import { parseAttendeeCsv } from '@/lib/certificates/parseCsv';

describe('parseAttendeeCsv', () => {
  it('parses valid name,email rows', () => {
    const { rows, errors } = parseAttendeeCsv('name,email\nAda,ada@x.com\nAlan,alan@x.com');
    expect(rows).toEqual([
      { name: 'Ada', email: 'ada@x.com' },
      { name: 'Alan', email: 'alan@x.com' },
    ]);
    expect(errors).toHaveLength(0);
  });

  it('flags invalid emails and missing names', () => {
    const { rows, errors } = parseAttendeeCsv('name,email\nAda,not-an-email\n,bob@x.com');
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(2);
  });

  it('errors when required columns are missing', () => {
    const { errors } = parseAttendeeCsv('fullname,mail\nAda,ada@x.com');
    expect(errors[0]).toMatch(/name.*email/i);
  });
});
