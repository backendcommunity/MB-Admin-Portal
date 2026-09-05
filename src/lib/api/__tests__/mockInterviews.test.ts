import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();

vi.mock('@/lib/api/axios', () => ({
  axiosInstance: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    put: (...args: unknown[]) => put(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));

import { fetchTemplates, fetchTemplate, createTemplate } from '@/lib/api/mockInterviews';
import { STANDARD_RUBRIC, STYLES } from '@/lib/mockInterviews/constants';

beforeEach(() => vi.clearAllMocks());

describe('fetchTemplates', () => {
  it('sends the scope through so the list is the caller’s own rows', async () => {
    get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 25 } });
    await fetchTemplates({ page: 1, limit: 25, scope: 'mine' });
    expect(get).toHaveBeenCalledWith('/admin/mock-interview-templates', {
      params: { page: 1, limit: 25, scope: 'mine' },
    });
  });
});

describe('fetchTemplate', () => {
  it('unwraps the envelope', async () => {
    get.mockResolvedValue({ data: { success: true, data: { id: 't-1', name: 'Go' } } });
    expect(await fetchTemplate('t-1')).toEqual({ id: 't-1', name: 'Go' });
  });
});

describe('createTemplate', () => {
  it('unwraps the envelope', async () => {
    post.mockResolvedValue({ data: { success: true, data: { id: 't-9' } } });
    expect(await createTemplate({ name: 'Go', duration: 30 })).toEqual({ id: 't-9' });
  });
});

describe('fetchTemplate — candidate shape', () => {
  // `personRow` is an allowlist: a staff caller gets ten fields, an
  // instructor gets only the first five — genuinely absent, not null.
  it('carries all ten fields for a staff (admin) caller', async () => {
    const candidate = {
      name: 'Ada Lovelace',
      avatar: null,
      progress: 42,
      score: 900,
      createdAt: '2026-01-01T00:00:00.000Z',
      id: 'u-1',
      email: 'ada@example.com',
      username: 'ada',
      country: 'NG',
      isPremium: true,
    };
    get.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 't-1',
          attempts: { stats: {}, recent: [{ id: 'a-1', candidate }] },
        },
      },
    });

    const detail = await fetchTemplate('t-1');
    const seen = detail.attempts.recent[0].candidate;

    expect(Object.keys(seen).sort()).toEqual(
      [
        'name',
        'avatar',
        'progress',
        'score',
        'createdAt',
        'id',
        'email',
        'username',
        'country',
        'isPremium',
      ].sort(),
    );
  });

  it('carries exactly the five shared fields for an instructor caller, with staff keys absent (not null)', async () => {
    const candidate = {
      name: 'Ada Lovelace',
      avatar: null,
      progress: 42,
      score: 900,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    get.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 't-1',
          attempts: { stats: {}, recent: [{ id: 'a-1', candidate }] },
        },
      },
    });

    const detail = await fetchTemplate('t-1');
    const seen = detail.attempts.recent[0].candidate;

    expect(Object.keys(seen).sort()).toEqual(
      ['name', 'avatar', 'progress', 'score', 'createdAt'].sort(),
    );
    expect(seen).not.toHaveProperty('id');
    expect(seen).not.toHaveProperty('email');
    expect(seen).not.toHaveProperty('username');
    expect(seen).not.toHaveProperty('country');
    expect(seen).not.toHaveProperty('isPremium');
  });
});

describe('constants', () => {
  it('the standard rubric totals 100 and every weight is positive', () => {
    expect(STANDARD_RUBRIC.reduce((n, r) => n + r.weight, 0)).toBe(100);
    expect(STANDARD_RUBRIC.every((r) => r.weight > 0)).toBe(true);
  });

  it('lists the six styles the API accepts', () => {
    expect([...STYLES]).toEqual([
      'Technical',
      'System Design',
      'Coding',
      'Behavioral',
      'Mixed',
      'Case Study',
    ]);
  });
});
