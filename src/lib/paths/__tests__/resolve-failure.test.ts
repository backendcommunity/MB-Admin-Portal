import { describe, it, expect, vi } from 'vitest';

/**
 * Mocked at the module boundary rather than at axios, so the rejection is
 * created and consumed inside the unit under test. Rejecting the HTTP layer
 * instead leaves the runner observing a raw error it attributes to the test.
 */
const searchLibrary = vi.fn();
vi.mock('@/lib/api/paths', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/paths')>('@/lib/api/paths');
  return { ...actual, searchLibrary: (...args: unknown[]) => searchLibrary(...args) };
});

import { resolveImportItems } from '@/lib/paths/resolve';
import type { ImportTopic } from '@/lib/paths/import';

const topic = (items: Array<{ kind: string; title: string }>): ImportTopic =>
  ({
    title: 'T',
    summary: '',
    description: '',
    banner: '',
    level: '',
    duration: 0,
    outcomes: [],
    recommendation: 1,
    reference: '',
    isPremium: false,
    items: items as ImportTopic['items'],
  }) as ImportTopic;

describe('resolveImportItems — when a lookup fails', () => {
  it('treats it as not-found rather than crashing the plan panel', async () => {
    searchLibrary.mockRejectedValue(new Error('network'));

    const res = await resolveImportItems([topic([{ kind: 'course', title: 'X' }])]);

    // One bad lookup must not take the whole panel down — the author still
    // gets a plan, with that item reported as missing.
    expect(res.missing).toEqual([{ kind: 'course', title: 'X' }]);
    expect(res.found).toBe(0);
  });

  it('keeps the rows that did resolve when only one lookup fails', async () => {
    searchLibrary.mockImplementation((kind: string) =>
      kind === 'course'
        ? Promise.reject(new Error('network'))
        : Promise.resolve([{ id: 'q1', title: 'Quiz' }]),
    );

    const res = await resolveImportItems([
      topic([
        { kind: 'course', title: 'X' },
        { kind: 'quiz', title: 'Quiz' },
      ]),
    ]);

    expect(res.found).toBe(1);
    expect(res.missing).toEqual([{ kind: 'course', title: 'X' }]);
  });
});
