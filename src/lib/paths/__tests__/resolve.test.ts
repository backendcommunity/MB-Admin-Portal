import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/api/axios', () => ({ axiosInstance: { get: (...a: unknown[]) => get(...a) } }));

import { resolveImportItems, resolvedId } from '@/lib/paths/resolve';
import type { ImportTopic } from '@/lib/paths/import';

const topic = (items: Array<{ kind: string; title: string; link?: string }>): ImportTopic =>
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

beforeEach(() => get.mockReset());

describe('resolveImportItems', () => {
  it('resolves an exact title match', async () => {
    get.mockResolvedValue({ data: { data: [{ id: 'c1', title: 'Node.js Fundamentals' }] } });
    const res = await resolveImportItems([
      topic([{ kind: 'course', title: 'Node.js Fundamentals' }]),
    ]);
    expect(res.found).toBe(1);
    expect(res.missing).toEqual([]);
    expect(resolvedId(res, 'course', 'Node.js Fundamentals')).toBe('c1');
  });

  it('matches case-insensitively, the way an author types it', async () => {
    get.mockResolvedValue({ data: { data: [{ id: 'c1', title: 'Node.js Fundamentals' }] } });
    const res = await resolveImportItems([
      topic([{ kind: 'course', title: 'node.js FUNDAMENTALS' }]),
    ]);
    expect(res.found).toBe(1);
  });

  it('reports a title that is not in the library instead of failing mid-import', async () => {
    get.mockResolvedValue({ data: { data: [] } });
    const res = await resolveImportItems([topic([{ kind: 'course', title: 'Nope' }])]);
    expect(res.found).toBe(0);
    expect(res.missing).toEqual([{ kind: 'course', title: 'Nope' }]);
    expect(resolvedId(res, 'course', 'Nope')).toBeNull();
  });

  it('counts a resource with a link as creatable, not missing', async () => {
    get.mockResolvedValue({ data: { data: [] } });
    const res = await resolveImportItems([
      topic([{ kind: 'resource', title: 'The Twelve-Factor App', link: 'https://12factor.net' }]),
    ]);
    // A resource is a title and a link, so the import can make it.
    expect(res.creatable).toEqual([{ kind: 'resource', title: 'The Twelve-Factor App' }]);
    expect(res.missing).toEqual([]);
  });

  it('counts a resource with no link as missing — a link is what makes it real', async () => {
    get.mockResolvedValue({ data: { data: [] } });
    const res = await resolveImportItems([topic([{ kind: 'resource', title: 'Dead label' }])]);
    expect(res.creatable).toEqual([]);
    expect(res.missing).toHaveLength(1);
  });

  it('never counts another kind as creatable, however much detail it carries', async () => {
    get.mockResolvedValue({ data: { data: [] } });
    const res = await resolveImportItems([
      topic([{ kind: 'quiz', title: 'Q', link: 'https://x.test' }]),
    ]);
    // A quiz needs questions; a title and a link cannot supply them.
    expect(res.creatable).toEqual([]);
    expect(res.missing).toHaveLength(1);
  });

  it('does not guess when several rows match and none is exact', async () => {
    get.mockResolvedValue({
      data: {
        data: [
          { id: 'p1', title: 'Test Project' },
          { id: 'p2', title: 'Test Project II' },
        ],
      },
    });
    const res = await resolveImportItems([topic([{ kind: 'project', title: 'Test' }])]);
    expect(res.missing).toHaveLength(1);
  });

  it('looks a repeated title up once, however many topics use it', async () => {
    get.mockResolvedValue({ data: { data: [{ id: 'c1', title: 'Shared' }] } });
    await resolveImportItems([
      topic([{ kind: 'course', title: 'Shared' }]),
      topic([{ kind: 'course', title: 'Shared' }]),
    ]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
