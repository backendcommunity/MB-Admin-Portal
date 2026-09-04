/**
 * The importer's job is to refuse a payload the API would reject, before the
 * first write — a bootcamp with three cohorts written and the fourth rejected
 * is worse than one that never started.
 */
import { describe, it, expect } from 'vitest';

import { parseBootcampImport, slugify } from '../import';
import { bootcampSample } from '../sample';

const minimal = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ title: 'Test Bootcamp', ...over });

describe('parseBootcampImport', () => {
  it('reads the whole sample, counting every level', () => {
    const { doc, errors, counts } = parseBootcampImport(bootcampSample);

    expect(errors).toEqual([]);
    expect(doc?.title).toBe('Node.js Backend Engineering Bootcamp');
    expect(counts).toMatchObject({
      topics: 2,
      cohorts: 1,
      weeks: 2,
      lessons: 4,
      events: 2,
      bonuses: 1,
      students: 2,
    });
  });

  it('rejects a document that is not JSON, without throwing', () => {
    const { doc, errors } = parseBootcampImport('{ nope');
    expect(doc).toBeNull();
    expect(errors[0]).toContain('not valid JSON');
  });

  it('requires a title', () => {
    const { errors } = parseBootcampImport(JSON.stringify({ summary: 'no title' }));
    expect(errors).toContain('The bootcamp needs a title.');
  });

  it('derives a slug from the title', () => {
    const { doc } = parseBootcampImport(minimal());
    expect(doc?.slug).toBe('test-bootcamp');
    expect(slugify('Node.js & Go!')).toBe('nodejs-go');
  });

  it('falls back on an unknown level rather than failing', () => {
    const { doc, notes } = parseBootcampImport(minimal({ level: 'Expert' }));
    expect(doc?.level).toBe('Beginner');
    expect(notes.join(' ')).toContain('Expert');
  });

  it('accepts topics as bare strings, which is what every stored bootcamp holds', () => {
    const { doc } = parseBootcampImport(
      minimal({ topics: ['Queues', { title: 'Caching', summary: 'Redis' }] }),
    );
    expect(doc?.topics).toEqual([
      { title: 'Queues', summary: '' },
      { title: 'Caching', summary: 'Redis' },
    ]);
  });

  it('refuses a cohort with no start date, because the API requires one', () => {
    const { errors } = parseBootcampImport(minimal({ cohorts: [{ name: 'C1' }] }));
    expect(errors.join(' ')).toContain('startsAt');
  });

  it('refuses an end date before the start', () => {
    const { errors } = parseBootcampImport(
      minimal({ cohorts: [{ name: 'C1', startsAt: '2026-10-05', endsAt: '2026-09-01' }] }),
    );
    expect(errors.join(' ')).toContain('endsAt is before startsAt');
  });

  it('drops a library reference from a lesson type that cannot carry one', () => {
    const { doc, notes } = parseBootcampImport(
      minimal({
        cohorts: [
          {
            name: 'C1',
            startsAt: '2026-10-05',
            weeks: [{ title: 'W1', lessons: [{ title: 'L', type: 'ASSIGNMENT', item: 'Redis' }] }],
          },
        ],
      }),
    );
    expect(doc?.cohorts[0].weeks[0].lessons[0].item).toBeUndefined();
    expect(notes.join(' ')).toContain('links nothing');
  });

  it('refuses an event pointing at a week that does not exist', () => {
    const { errors } = parseBootcampImport(
      minimal({
        cohorts: [
          {
            name: 'C1',
            startsAt: '2026-10-05',
            weeks: [{ title: 'W1' }],
            events: [
              { title: 'Kickoff', date: '2026-10-05', start: '17:00', end: '18:00', week: 3 },
            ],
          },
        ],
      }),
    );
    expect(errors.join(' ')).toContain('week 3 does not exist');
  });

  it('unpins an event whose lesson is not in that week, rather than failing it', () => {
    const { doc, notes } = parseBootcampImport(
      minimal({
        cohorts: [
          {
            name: 'C1',
            startsAt: '2026-10-05',
            weeks: [{ title: 'W1', lessons: [{ title: 'Real lesson' }] }],
            events: [
              {
                title: 'Kickoff',
                date: '2026-10-05',
                start: '17:00',
                end: '18:00',
                week: 1,
                lesson: 'Ghost',
              },
            ],
          },
        ],
      }),
    );
    expect(doc?.cohorts[0].events[0].lesson).toBeUndefined();
    expect(notes.join(' ')).toContain('left unpinned');
  });

  it('catches two sessions overlapping in one cohort, which the API answers with a 409', () => {
    const { errors } = parseBootcampImport(
      minimal({
        cohorts: [
          {
            name: 'C1',
            startsAt: '2026-10-05',
            weeks: [{ title: 'W1' }],
            events: [
              { title: 'One', date: '2026-10-05', start: '17:00', end: '18:00', week: 1 },
              { title: 'Two', date: '2026-10-05', start: '17:30', end: '18:30', week: 1 },
            ],
          },
        ],
      }),
    );
    expect(errors.join(' ')).toContain('overlap');
  });

  it('allows the same hour on a different day', () => {
    const { errors } = parseBootcampImport(
      minimal({
        cohorts: [
          {
            name: 'C1',
            startsAt: '2026-10-05',
            weeks: [{ title: 'W1' }],
            events: [
              { title: 'One', date: '2026-10-05', start: '17:00', end: '18:00', week: 1 },
              { title: 'Two', date: '2026-10-06', start: '17:00', end: '18:00', week: 1 },
            ],
          },
        ],
      }),
    );
    expect(errors).toEqual([]);
  });

  it('refuses a bonus with no item, which would store a row pointing at nothing', () => {
    const { errors } = parseBootcampImport(
      minimal({ cohorts: [{ name: 'C1', startsAt: '2026-10-05', bonuses: [{ kind: 'course' }] }] }),
    );
    expect(errors.join(' ')).toContain('needs the title');
  });

  it('skips an address that is not an email instead of failing the batch', () => {
    const { doc, notes } = parseBootcampImport(
      minimal({
        cohorts: [{ name: 'C1', startsAt: '2026-10-05', students: ['ada@x.com', 'nope'] }],
      }),
    );
    expect(doc?.cohorts[0].students).toEqual(['ada@x.com']);
    expect(notes.join(' ')).toContain('not an email');
  });

  it('reports fields it does not know rather than dropping them silently', () => {
    const { notes } = parseBootcampImport(minimal({ isPublic: true, colour: 'red' }));
    expect(notes.join(' ')).toContain('isPublic');
    expect(notes.join(' ')).toContain('colour');
  });

  it('says so when there are no cohorts', () => {
    const { doc, notes } = parseBootcampImport(minimal());
    expect(doc).not.toBeNull();
    expect(notes.join(' ')).toContain('nobody can join');
  });

  it('returns no document at all while an error stands', () => {
    const { doc, counts } = parseBootcampImport(minimal({ cohorts: [{ name: 'C1' }] }));
    expect(doc).toBeNull();
    // The counts still describe what was read, so the panel can show scale.
    expect(counts.cohorts).toBe(0);
  });
});
