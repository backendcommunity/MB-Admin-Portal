import { describe, it, expect } from 'vitest';
import { parsePathImport, importSample } from '@/lib/paths/import';

describe('parsePathImport — the sample', () => {
  it('validates clean and reports what it will create', () => {
    const result = parsePathImport(importSample({ course: 'Real Course' }));

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.counts).toMatchObject({ topics: 2, items: 5, skipped: 0, emptyTopics: 0 });
    expect(result.doc?.topics[0].title).toBe('Failure is the normal case');

    // The sample doubles as the documentation, so it must exercise every field
    // the parser understands — including the awkward ones.
    const path = result.doc!.path;
    for (const field of [
      'title',
      'slug',
      'summary',
      'description',
      'banner',
      'preview',
      'level',
      'difficulty',
      'timeframe',
      'instructor',
      'prerequisites',
      'skills',
      'languages',
      'estimatedWeeks',
      'hoursPerWeek',
      'isPremium',
      'amount',
      'paddlePlanCode',
      'paddle_price_id',
      'isWaiting',
      'waitingLink',
    ]) {
      expect(path, `sample is missing ${field}`).toHaveProperty(field);
    }

    const topic = result.doc!.topics[0];
    for (const field of [
      'title',
      'slug',
      'summary',
      'description',
      'banner',
      'level',
      'duration',
      'outcomes',
      'recommendation',
      'reference',
      'isPremium',
      'items',
    ]) {
      expect(topic, `sample topic is missing ${field}`).toHaveProperty(field);
    }

    // order, isOptional and a mock modality all appear somewhere in it.
    const items = result.doc!.topics.flatMap((t) => t.items);
    expect(items.some((i) => i.order !== undefined)).toBe(true);
    expect(items.some((i) => i.isOptional === true)).toBe(true);
    expect(items.some((i) => i.type === 'VIDEO')).toBe(true);
    // and a resource the import can create outright
    expect(items.some((i) => i.kind === 'resource' && i.link)).toBe(true);
  });
});

describe('parsePathImport — blocking errors', () => {
  it('rejects malformed JSON', () => {
    const result = parsePathImport('{nope');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Invalid JSON');
  });

  it('rejects an array, null, and a bare string', () => {
    for (const raw of ['[]', 'null', '"a path"']) {
      const result = parsePathImport(raw);
      expect(result.ok).toBe(false);
      expect(result.doc).toBeNull();
    }
  });

  it('requires a title', () => {
    expect(parsePathImport(JSON.stringify({ summary: 'x' })).errors).toContain(
      'title is required.',
    );
  });

  it('requires a title on every topic', () => {
    const result = parsePathImport(JSON.stringify({ title: 'T', topics: [{ duration: 3 }] }));
    expect(result.errors).toContain('topics[0].title is required.');
  });

  it('rejects a topic that is not an object', () => {
    const result = parsePathImport(JSON.stringify({ title: 'T', topics: ['nope'] }));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('must be an object');
  });
});

describe('parsePathImport — recoverable notes', () => {
  it('drops ownerTeamId rather than letting an import mint a team path', () => {
    // The editor locks this field. Honouring it here would make the importer
    // the way around that lock.
    const result = parsePathImport(
      JSON.stringify({ title: 'T', ownerTeamId: 'Acme Corp', topics: [] }),
    );
    expect(result.ok).toBe(true);
    expect(result.doc?.path).not.toHaveProperty('ownerTeamId');
    expect(result.notes.some((n) => n.includes('ownerTeamId'))).toBe(true);
  });

  it('drops isPublic — an imported path starts as a draft', () => {
    const result = parsePathImport(JSON.stringify({ title: 'T', isPublic: false, topics: [] }));
    expect(result.doc?.path).not.toHaveProperty('isPublic');
    expect(result.notes.some((n) => n.includes('isPublic'))).toBe(true);
  });

  it('skips an unknown kind and names the twelve that are valid', () => {
    const result = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [{ title: 'A', items: [{ kind: 'podcast', title: 'x' }] }],
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.counts.skipped).toBe(1);
    expect(result.notes[0]).toContain('unknown kind');
    expect(result.notes[0]).toContain('course');
  });

  it('keeps isOptional on every kind, now that every link can store it', () => {
    // A quiz link had no isOptional column until
    // 20260829140000_optional_on_every_topic_link, so this used to be dropped
    // with a note.
    const result = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [{ title: 'A', items: [{ kind: 'quiz', title: 'Q', isOptional: true }] }],
      }),
    );
    expect(result.doc?.topics[0].items[0].isOptional).toBe(true);
    expect(result.notes.some((n) => n.includes('cannot be optional'))).toBe(false);
  });

  it('keeps isOptional on a kind that supports it', () => {
    const result = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [{ title: 'A', items: [{ kind: 'mock', title: 'M', isOptional: true }] }],
      }),
    );
    expect(result.doc?.topics[0].items[0].isOptional).toBe(true);
  });

  it('downgrades publish when a topic has no content', () => {
    const result = parsePathImport(
      JSON.stringify({ title: 'T', publish: true, topics: [{ title: 'Empty' }] }),
    );
    expect(result.doc?.publish).toBe(false);
    expect(result.notes.some((n) => n.includes('importing as a draft'))).toBe(true);
  });

  it('reports unknown fields rather than dropping them silently', () => {
    const result = parsePathImport(JSON.stringify({ title: 'T', mystery: 1 }));
    expect(result.notes.some((n) => n.includes('mystery'))).toBe(true);
  });

  it('refuses a cohort, which is no longer attachable on its own', () => {
    const result = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [{ title: 'A', items: [{ kind: 'cohort', title: 'Q3 2026' }] }],
      }),
    );
    // A cohort IS a bootcamp's cohort — the API refuses new links, so the
    // importer must not create one either.
    expect(result.counts.skipped).toBe(1);
    expect(result.notes.some((n) => n.includes('bootcamp'))).toBe(true);
  });

  it('carries paddlePlanCode and createdById, which used to be silently dropped', () => {
    // Both were in KNOWN_PATH — so no "unknown field" note — but never emitted.
    // That reads as a clean import that quietly lost two fields.
    const result = parsePathImport(
      JSON.stringify({
        title: 'T',
        paddlePlanCode: 4321,
        createdById: 'user-1',
        topics: [],
      }),
    );
    expect(result.doc?.path.paddlePlanCode).toBe(4321);
    expect(result.doc?.path.createdById).toBe('user-1');
    expect(result.notes.some((n) => n.includes('paddlePlanCode'))).toBe(false);
  });

  it('keeps an explicit item order, and falls back to array position', () => {
    const result = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [
          {
            title: 'A',
            items: [
              { kind: 'quiz', title: 'Q', order: 5 },
              { kind: 'course', title: 'C' },
            ],
          },
        ],
      }),
    );
    expect(result.doc?.topics[0].items[0].order).toBe(5);
    expect(result.doc?.topics[0].items[1].order).toBeUndefined();
  });

  it('rejects a nonsense order rather than writing it', () => {
    const result = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [{ title: 'A', items: [{ kind: 'quiz', title: 'Q', order: 'first' }] }],
      }),
    );
    expect(result.doc?.topics[0].items[0].order).toBeUndefined();
    expect(result.notes.some((n) => n.includes('not a whole number'))).toBe(true);
  });

  it('takes a mock modality, and refuses one anywhere else', () => {
    const ok = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [{ title: 'A', items: [{ kind: 'mock', title: 'M', type: 'audio' }] }],
      }),
    );
    expect(ok.doc?.topics[0].items[0].type).toBe('AUDIO'); // case-insensitive

    const wrongKind = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [{ title: 'A', items: [{ kind: 'quiz', title: 'Q', type: 'VIDEO' }] }],
      }),
    );
    expect(wrongKind.doc?.topics[0].items[0].type).toBeUndefined();
    expect(wrongKind.notes.some((n) => n.includes('only a mock interview'))).toBe(true);

    const badValue = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [{ title: 'A', items: [{ kind: 'mock', title: 'M', type: 'HOLOGRAM' }] }],
      }),
    );
    expect(badValue.doc?.topics[0].items[0].type).toBeUndefined();
    expect(badValue.notes.some((n) => n.includes('HOLOGRAM'))).toBe(true);
  });

  it('reports an unknown field on an item rather than dropping it silently', () => {
    const result = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [{ title: 'A', items: [{ kind: 'quiz', title: 'Q', colour: 'red' }] }],
      }),
    );
    expect(result.notes.some((n) => n.includes('colour'))).toBe(true);
  });

  it('keeps a link on a resource, and refuses one anywhere else', () => {
    const ok = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [
          {
            title: 'A',
            items: [{ kind: 'resource', title: 'Twelve-Factor', link: 'https://12factor.net' }],
          },
        ],
      }),
    );
    expect(ok.doc?.topics[0].items[0].link).toBe('https://12factor.net');

    const wrong = parsePathImport(
      JSON.stringify({
        title: 'T',
        topics: [{ title: 'A', items: [{ kind: 'quiz', title: 'Q', link: 'https://x.test' }] }],
      }),
    );
    expect(wrong.doc?.topics[0].items[0].link).toBeUndefined();
    expect(wrong.notes.some((n) => n.includes('only a resource carries a link'))).toBe(true);
  });

  it('does not pollute Object.prototype', () => {
    parsePathImport('{"title":"T","__proto__":{"polluted":1},"topics":[]}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('survives deep nesting without throwing', () => {
    const deep = `{"title":"T","topics":${'['.repeat(200)}${']'.repeat(200)}}`;
    expect(() => parsePathImport(deep)).not.toThrow();
  });
});
