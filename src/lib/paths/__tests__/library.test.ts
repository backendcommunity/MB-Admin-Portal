import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/api/axios', () => ({
  axiosInstance: { get: (...args: unknown[]) => get(...args) },
}));

import { searchLibrary } from '@/lib/api/paths';

/**
 * The rows below are the real shapes these endpoints return, not invented ones.
 *
 * Each admin list reshapes its model on the way out — `/admin/bootcamps`
 * answers `name: b.title` and carries no `slug` — so a client that reads the
 * wrong key renders every row as "Untitled" while still returning the right
 * ids. That is what happened, and it is invisible to a type check because the
 * responses are untyped JSON.
 */
const RESPONSES: Record<string, Record<string, unknown>> = {
  '/admin/bootcamps': {
    id: 'b1',
    name: 'Backend Intensive — Q3',
    location: 'Advanced',
    active: true,
    cohortCount: 3,
  },
  // Keyed on the exact URL (including `scope=attachable`) rather than just the
  // path, so a regression that drops the scope param fails this fixture
  // instead of silently matching via `startsWith` on the bare path.
  '/admin/mock-interview-templates?scope=attachable': {
    id: 'm1',
    name: 'Mid-level Backend Engineer — Coding Interview',
    format: 'CHAT',
    difficulty: 'Medium',
  },
  '/admin/projects': { id: 'p1', title: 'Ship a job queue', difficulty: 'Advanced' },
  '/admin/courses': { id: 'c1', title: 'Node.js Fundamentals', slug: 'nodejs-fundamentals' },
  '/admin/library': { id: 'q1', title: 'Testing & Quality Quiz', meta: '6 questions' },
};

beforeEach(() => {
  get.mockReset();
  get.mockImplementation((url: string) => {
    const base = Object.keys(RESPONSES).find((key) => url.startsWith(key));
    return Promise.resolve({ data: { data: base ? [RESPONSES[base]] : [] } });
  });
});

describe('searchLibrary — the title every kind shows', () => {
  it.each([
    ['bootcamp', 'Backend Intensive — Q3'],
    ['mock', 'Mid-level Backend Engineer — Coding Interview'],
    ['project', 'Ship a job queue'],
    ['course', 'Node.js Fundamentals'],
    ['quiz', 'Testing & Quality Quiz'],
  ])('resolves a real %s row to its name, never "Untitled"', async (kind, expected) => {
    const [row] = await searchLibrary(kind, '');
    expect(row.title).toBe(expected);
    expect(row.title).not.toBe('Untitled');
  });

  it('reads a bootcamp through `name`, which is what that endpoint returns', async () => {
    // The regression: the client asked for `title`, the endpoint sends `name`.
    const [row] = await searchLibrary('bootcamp', '');
    expect(row.title).toBe('Backend Intensive — Q3');
    expect(row.meta).toBe('3'); // cohortCount, a field that endpoint actually has
  });

  it('omits meta rather than printing "undefined" when the field is absent', async () => {
    get.mockResolvedValueOnce({ data: { data: [{ id: 'b2', name: 'No cohorts yet' }] } });
    const [row] = await searchLibrary('bootcamp', '');
    expect(row.title).toBe('No cohorts yet');
    expect(row.meta).toBeUndefined();
  });

  it('still says Untitled when a row genuinely has no name', async () => {
    get.mockResolvedValueOnce({ data: { data: [{ id: 'x1' }] } });
    const [row] = await searchLibrary('bootcamp', '');
    expect(row.title).toBe('Untitled');
  });

  it('passes the search term through to the endpoint', async () => {
    await searchLibrary('bootcamp', 'backend');
    expect(get.mock.calls[0][0]).toContain('q=backend');
  });

  it('asks only for bootcamps that have cohorts, without losing its own query', async () => {
    // The bootcamp source carries its own filter, so the search params have to
    // be appended with & rather than ? or the url is malformed.
    await searchLibrary('bootcamp', 'backend');
    const url = get.mock.calls[0][0] as string;
    expect(url).toContain('hasCohorts=true');
    expect(url).toContain('q=backend');
    expect(url.split('?').length).toBe(2); // exactly one query string
  });
});
