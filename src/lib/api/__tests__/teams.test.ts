import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();

vi.mock('@/lib/api/axios', () => ({
  axiosInstance: {
    get: (...a: any[]) => get(...a),
    post: (...a: any[]) => post(...a),
    patch: (...a: any[]) => patch(...a),
  },
}));

import {
  fetchTeams,
  fetchTeam,
  createTeam,
  archiveTeam,
  restoreTeam,
  formatCurrency,
} from '@/lib/api/teams';

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  get.mockResolvedValue({
    data: { success: true, data: { teams: [], total: 0, page: 1, limit: 25 } },
  });
  post.mockResolvedValue({ data: { success: true, data: { id: 'tm1' } } });
});

describe('teams api client', () => {
  it('lists from /admin/teams, not /teams', async () => {
    await fetchTeams({ page: 1 });
    expect(get).toHaveBeenCalledWith('/admin/teams', expect.anything());
  });

  it('fetches detail from /admin/teams/:id, not /teams/:id/admin', async () => {
    get.mockResolvedValue({ data: { success: true, data: { id: 'tm1' } } });
    await fetchTeam('tm1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1');
  });

  it('archives via POST /admin/teams/:id/archive', async () => {
    await archiveTeam('tm1');
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/archive');
  });

  it('restores via POST /admin/teams/:id/restore', async () => {
    await restoreTeam('tm1');
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/restore');
  });

  it('omits empty and ALL filters from the query', async () => {
    await fetchTeams({ page: 1, q: '', status: 'ALL', processor: 'Paddle' });
    const params = get.mock.calls[0][1].params;
    expect(params).not.toHaveProperty('q');
    expect(params).not.toHaveProperty('status');
    expect(params.processor).toBe('Paddle');
  });

  it('creates without seats when no subscription is chosen', async () => {
    await createTeam({ name: 'Kuda', ownerEmail: 'a@kuda.com' });
    expect(post).toHaveBeenCalledWith('/admin/teams', { name: 'Kuda', ownerEmail: 'a@kuda.com' });
  });

  it('never labels an amount USD when the currency is unknown', () => {
    expect(formatCurrency(180, null)).toBe('180');
    expect(formatCurrency(null, 'USD')).toBe('—');
  });
});
