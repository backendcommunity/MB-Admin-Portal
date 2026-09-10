import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();

vi.mock('@/lib/api/axios', () => ({
  axiosInstance: {
    get: (...a: any[]) => get(...a),
  },
}));

import { fetchUserTeams, type UserTeam } from '@/lib/api/users';

beforeEach(() => {
  get.mockReset();
});

describe('fetchUserTeams', () => {
  it('passes through the seat-usage object and seatGap, not a bare seat count', async () => {
    const seats: UserTeam['seats'] = {
      subscribed: true,
      paidSeats: 5,
      activeMembers: 3,
      pendingInvites: 1,
      used: 4,
      available: 1,
    };
    const row: UserTeam = {
      teamId: 'tm1',
      name: 'Kuda',
      isOwner: false,
      role: 'MEMBER',
      status: 'ACTIVE',
      memberId: 'mm1',
      joinedAt: '2026-01-01T00:00:00.000Z',
      owner: { id: 'u1', name: 'Owner', email: 'o@kuda.com' },
      seats,
      seatGap: -2,
      subscription: { id: 'sub1', plan: 'Team', status: 'ACTIVE' },
      counts: { members: 3, invites: 1, groups: 0, assignments: 0 },
    };
    get.mockResolvedValue({ data: { data: [row] } });

    const result = await fetchUserTeams('u1');

    expect(get).toHaveBeenCalledWith('/admin/users/u1/teams');
    expect(result[0].seats).toEqual(seats);
    expect(result[0].seatGap).toBe(-2);
  });
});
