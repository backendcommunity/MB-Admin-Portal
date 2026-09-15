import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
const put = vi.fn();

vi.mock('@/lib/api/axios', () => ({
  axiosInstance: {
    get: (...a: any[]) => get(...a),
    post: (...a: any[]) => post(...a),
    patch: (...a: any[]) => patch(...a),
    delete: (...a: any[]) => del(...a),
    put: (...a: any[]) => put(...a),
  },
}));

import * as teamsApi from '@/lib/api/teams';
import {
  fetchTeams,
  fetchTeam,
  createTeam,
  archiveTeam,
  restoreTeam,
  formatCurrency,
  adminSetTeamSeats,
  setTeamMemberRole,
  removeTeamMember,
  fetchTeamMemberProgress,
  fetchTeamInvites,
  inviteTeamMember,
  resendTeamInvite,
  revokeTeamInvite,
  fetchTeamGroups,
  createTeamGroup,
  renameTeamGroup,
  deleteTeamGroup,
  setTeamGroupMembers,
  fetchTeamAssignments,
  fetchTeamAssignment,
  createTeamAssignment,
  updateTeamAssignment,
  deleteTeamAssignment,
  setTeamAssignmentItems,
  fetchAssignableContent,
  fetchTeamPaths,
  createTeamPath,
  fetchTeamPath,
  updateTeamPath,
  archiveTeamPath,
  restoreTeamPath,
  attachTeamSubscription,
  detachTeamSubscription,
  recordManualTeamPayment,
  updateManualTeamPayment,
  dismissTeamSeatGap,
  fetchTeamOverview,
  fetchTeamReport,
  exportTeamReportCsv,
  fetchTeamProgress,
  fetchTeamLeaderboard,
  fetchTeamAuditLog,
  compTeam,
  uncompTeam,
  addTeamMember,
  isEntitlingSubscriptionStatus,
} from '@/lib/api/teams';

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  del.mockReset();
  put.mockReset();
  get.mockResolvedValue({
    data: { success: true, data: { teams: [], total: 0, page: 1, limit: 25 } },
  });
  post.mockResolvedValue({ data: { success: true, data: { id: 'tm1' } } });
  patch.mockResolvedValue({ data: { success: true, data: { id: 'tm1' } } });
  del.mockResolvedValue({ data: { success: true, data: { id: 'tm1' } } });
  put.mockResolvedValue({ data: { success: true, data: { id: 'tm1' } } });
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

describe('seats', () => {
  it('adjusts seats via PATCH /admin/teams/:id/seats and unwraps the full team row PATCH /:id/seats actually returns — not a bare seat-usage object', async () => {
    const teamRow = {
      id: 'tm1',
      name: 'Kuda',
      owner: null,
      processor: 'PADDLE',
      subscriptionStatus: 'active',
      seats: {
        subscribed: true,
        paidSeats: 20,
        activeMembers: 12,
        pendingInvites: 1,
        used: 13,
        available: 7,
      },
      seatGap: null,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    patch.mockResolvedValueOnce({ data: { success: true, data: teamRow } });
    const result = await adminSetTeamSeats('tm1', 20);
    expect(patch).toHaveBeenCalledWith('/admin/teams/tm1/seats', { seats: 20 });
    expect(result).toEqual(teamRow);
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('owner');
  });
});

describe('members', () => {
  it('sets a member role via PATCH /admin/teams/:id/members/:memberId', async () => {
    patch.mockResolvedValueOnce({ data: { success: true, data: { id: 'mem1', role: 'ADMIN' } } });
    const result = await setTeamMemberRole('tm1', 'mem1', 'ADMIN');
    expect(patch).toHaveBeenCalledWith('/admin/teams/tm1/members/mem1', { role: 'ADMIN' });
    expect(result).toEqual({ id: 'mem1', role: 'ADMIN' });
  });

  it('removes a member via DELETE /admin/teams/:id/members/:memberId and unwraps data.data', async () => {
    del.mockResolvedValueOnce({ data: { success: true, data: { id: 'mem1' } } });
    const result = await removeTeamMember('tm1', 'mem1');
    expect(del).toHaveBeenCalledWith('/admin/teams/tm1/members/mem1');
    expect(result).toEqual({ id: 'mem1' });
  });

  it('fetches member progress via GET /admin/teams/:id/members/:memberId/progress', async () => {
    await fetchTeamMemberProgress('tm1', 'mem1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/members/mem1/progress');
  });

  it('unwraps the real nested { user, stats, courses, paths } shape from resolveMemberProgress, not a flat record', async () => {
    const progress = {
      user: { id: 'u1', name: 'Ada', email: 'ada@x.com', avatar: null },
      stats: { points: 120, level: 3, currentStreak: 4, longestStreak: 9, lastActivityAt: null },
      courses: [
        { id: 'c1', title: 'Node basics', slug: 'node-basics', isCompleted: false, percent: 40 },
      ],
      paths: [{ id: 'p1', title: 'Backend path', completedItems: 2, totalItems: 5 }],
      projects: [],
      quizzes: { taken: 2, passed: 1 },
      mockInterviews: { taken: 1, completed: 1, lastTakenAt: null },
      activity: [],
    };
    get.mockResolvedValueOnce({ data: { success: true, data: progress } });
    const result = await fetchTeamMemberProgress('tm1', 'mem1');
    expect(result).toEqual(progress);
  });
});

describe('invites', () => {
  it('fetches pending+history via GET /admin/teams/:id/invites', async () => {
    get.mockResolvedValueOnce({ data: { success: true, data: { pending: [], history: [] } } });
    const result = await fetchTeamInvites('tm1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/invites');
    expect(result).toEqual({ pending: [], history: [] });
  });

  it('invites via POST /admin/teams/:id/invites with {email}', async () => {
    await inviteTeamMember('tm1', 'new@kuda.com');
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/invites', { email: 'new@kuda.com' });
  });

  it('resends via POST /admin/teams/:id/invites/:inviteId/resend with no body', async () => {
    await resendTeamInvite('tm1', 'inv1');
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/invites/inv1/resend');
  });

  it('revokes via DELETE /admin/teams/:id/invites/:inviteId and unwraps data.data', async () => {
    del.mockResolvedValueOnce({ data: { success: true, data: { id: 'inv1' } } });
    const result = await revokeTeamInvite('tm1', 'inv1');
    expect(del).toHaveBeenCalledWith('/admin/teams/tm1/invites/inv1');
    expect(result).toEqual({ id: 'inv1' });
  });
});

describe('groups', () => {
  it('fetches via GET /admin/teams/:id/groups', async () => {
    await fetchTeamGroups('tm1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/groups');
  });

  it('creates via POST /admin/teams/:id/groups with {name}', async () => {
    await createTeamGroup('tm1', 'Engineering');
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/groups', { name: 'Engineering' });
  });

  it('renames via PATCH /admin/teams/:id/groups/:groupId with {name}', async () => {
    await renameTeamGroup('tm1', 'g1', 'Design');
    expect(patch).toHaveBeenCalledWith('/admin/teams/tm1/groups/g1', { name: 'Design' });
  });

  it('deletes via DELETE /admin/teams/:id/groups/:groupId and returns the bare body (no data key)', async () => {
    del.mockResolvedValueOnce({ data: { success: true, message: 'Group deleted' } });
    const result = await deleteTeamGroup('tm1', 'g1');
    expect(del).toHaveBeenCalledWith('/admin/teams/tm1/groups/g1');
    expect(result).toEqual({ success: true, message: 'Group deleted' });
  });

  it('replaces membership via PUT /admin/teams/:id/groups/:groupId/members with {teamMemberIds}', async () => {
    await setTeamGroupMembers('tm1', 'g1', ['mem1', 'mem2']);
    expect(put).toHaveBeenCalledWith('/admin/teams/tm1/groups/g1/members', {
      teamMemberIds: ['mem1', 'mem2'],
    });
  });
});

describe('assignments', () => {
  it('lists via GET /admin/teams/:id/assignments', async () => {
    await fetchTeamAssignments('tm1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/assignments');
  });

  it('fetches one via GET /admin/teams/:id/assignments/:assignmentId and unwraps the real detail shape (items+people), not a bare index-signature bag', async () => {
    const detail = {
      id: 'as1',
      name: 'Week 1',
      dueAt: null,
      targetType: 'TEAM' as const,
      items: [
        {
          id: 'i1',
          type: 'COURSE',
          refId: 'c1',
          text: null,
          position: 0,
          title: 'Node basics',
          parentLabel: '',
          courseSlug: 'node-basics',
          chapterSlug: null,
          slug: 'node-basics',
        },
      ],
      people: [
        {
          teamMemberId: 'mem1',
          userId: 'u1',
          name: 'Ada',
          email: 'ada@x.com',
          avatar: null,
          done: 1,
          total: 3,
          isOverdue: false,
          states: { i1: 'DONE' },
        },
      ],
    };
    get.mockResolvedValueOnce({ data: { success: true, data: detail } });
    const result = await fetchTeamAssignment('tm1', 'as1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/assignments/as1');
    expect(result).toEqual(detail);
    // The real route never returns these — a prior type declared them anyway.
    expect(result).not.toHaveProperty('teamId');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('targetGroupId');
    expect(result).not.toHaveProperty('targetTeamMemberId');
  });

  it('creates via POST /admin/teams/:id/assignments with the full input', async () => {
    const input = { name: 'Week 1', targetType: 'TEAM' as const };
    await createTeamAssignment('tm1', input);
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/assignments', input);
  });

  it('updates via PATCH /admin/teams/:id/assignments/:assignmentId with a partial input', async () => {
    await updateTeamAssignment('tm1', 'as1', { name: 'Week 2' });
    expect(patch).toHaveBeenCalledWith('/admin/teams/tm1/assignments/as1', { name: 'Week 2' });
  });

  it('deletes via DELETE /admin/teams/:id/assignments/:assignmentId and returns the bare body (no data key)', async () => {
    del.mockResolvedValueOnce({ data: { success: true } });
    const result = await deleteTeamAssignment('tm1', 'as1');
    expect(del).toHaveBeenCalledWith('/admin/teams/tm1/assignments/as1');
    expect(result).toEqual({ success: true });
  });

  it('replaces items via PUT /admin/teams/:id/assignments/:assignmentId/items with {items} and unwraps the real {id, itemCount} result — setAssignmentItems never returns the full assignment row', async () => {
    put.mockResolvedValueOnce({ data: { success: true, data: { id: 'as1', itemCount: 2 } } });
    const items = [{ type: 'COURSE', refId: 'c1' }];
    const result = await setTeamAssignmentItems('tm1', 'as1', items);
    expect(put).toHaveBeenCalledWith('/admin/teams/tm1/assignments/as1/items', { items });
    expect(result).toEqual({ id: 'as1', itemCount: 2 });
  });

  it('searches assignable content via GET /admin/teams/:id/assignable and unwraps rows with a parentLabel breadcrumb — searchAssignable never returns a type field', async () => {
    get.mockResolvedValueOnce({
      data: { success: true, data: [{ id: 'c1', title: 'Node basics', parentLabel: 'Backend' }] },
    });
    const result = await fetchAssignableContent('tm1', { type: 'COURSE', q: 'node' });
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/assignable', {
      params: { type: 'COURSE', q: 'node' },
    });
    expect(result).toEqual([{ id: 'c1', title: 'Node basics', parentLabel: 'Backend' }]);
  });
});

describe('paths', () => {
  it('lists via GET /admin/teams/:id/paths', async () => {
    await fetchTeamPaths('tm1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/paths');
  });

  it('creates via POST /admin/teams/:id/paths with {title, summary}', async () => {
    await createTeamPath('tm1', { title: 'Onboarding', summary: 'Week one' });
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/paths', {
      title: 'Onboarding',
      summary: 'Week one',
    });
  });

  it('fetches one via GET /admin/teams/:id/paths/:pathId', async () => {
    await fetchTeamPath('tm1', 'p1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/paths/p1');
  });

  it('updates via PATCH /admin/teams/:id/paths/:pathId', async () => {
    await updateTeamPath('tm1', 'p1', { title: 'New title' });
    expect(patch).toHaveBeenCalledWith('/admin/teams/tm1/paths/p1', { title: 'New title' });
  });

  it('archives (never truly deletes) via DELETE /admin/teams/:id/paths/:pathId and returns the bare body', async () => {
    del.mockResolvedValueOnce({ data: { success: true, message: 'Path archived' } });
    const result = await archiveTeamPath('tm1', 'p1');
    expect(del).toHaveBeenCalledWith('/admin/teams/tm1/paths/p1');
    expect(result).toEqual({ success: true, message: 'Path archived' });
  });

  it('restores via POST /admin/teams/:id/paths/:pathId/restore and returns the bare body (no data key)', async () => {
    post.mockResolvedValueOnce({ data: { success: true, message: 'Path restored' } });
    const result = await restoreTeamPath('tm1', 'p1');
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/paths/p1/restore');
    expect(result).toEqual({ success: true, message: 'Path restored' });
  });
});

describe('billing', () => {
  it('attaches a subscription via PATCH /admin/teams/:id/subscription with {subscriptionId, seats} — the brief omitted seats, but the API requires it', async () => {
    await attachTeamSubscription('tm1', 'sub1', 25);
    expect(patch).toHaveBeenCalledWith('/admin/teams/tm1/subscription', {
      subscriptionId: 'sub1',
      seats: 25,
    });
  });

  it('detaches via DELETE /admin/teams/:id/subscription with no body', async () => {
    await detachTeamSubscription('tm1');
    expect(del).toHaveBeenCalledWith('/admin/teams/tm1/subscription');
  });

  it('records a manual (bank-transfer) payment via POST /admin/teams/:id/subscription/manual', async () => {
    const teamRow = {
      id: 'tm1',
      name: 'Kuda',
      owner: null,
      processor: 'MANUAL',
      subscriptionStatus: 'ACTIVE',
      seats: {
        subscribed: true,
        paidSeats: 25,
        activeMembers: 1,
        pendingInvites: 0,
        used: 1,
        available: 24,
      },
      seatGap: null,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    post.mockResolvedValueOnce({ data: { success: true, data: teamRow } });
    const result = await recordManualTeamPayment('tm1', {
      seats: 25,
      expiry: '2027-09-12T00:00:00.000Z',
      amount: 500,
      currency: 'NGN',
    });
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/subscription/manual', {
      seats: 25,
      expiry: '2027-09-12T00:00:00.000Z',
      amount: 500,
      currency: 'NGN',
    });
    expect(result).toEqual(teamRow);
  });

  it('renews/corrects a manual payment via PATCH /admin/teams/:id/subscription/manual', async () => {
    patch.mockResolvedValueOnce({
      data: { success: true, data: { id: 'tm1', processor: 'MANUAL' } },
    });
    const result = await updateManualTeamPayment('tm1', { expiry: '2028-09-12T00:00:00.000Z' });
    expect(patch).toHaveBeenCalledWith('/admin/teams/tm1/subscription/manual', {
      expiry: '2028-09-12T00:00:00.000Z',
    });
    expect(result).toEqual({ id: 'tm1', processor: 'MANUAL' });
  });

  it('dismisses the seat-gap alert via POST /seat-gap/dismiss — not a reconcile, and changes no seats', async () => {
    post.mockResolvedValueOnce({
      data: { success: true, data: { id: 'tm1', reportedSeatGap: null } },
    });
    const result = await dismissTeamSeatGap('tm1');
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/seat-gap/dismiss');
    expect(post.mock.calls[0][0]).not.toMatch(/reconcile/i);
    expect(post.mock.calls[0][1]).toBeUndefined();
    expect(result).toEqual({ id: 'tm1', reportedSeatGap: null });
    // No sibling "reconcile" function was introduced for this action.
    expect((teamsApi as Record<string, unknown>).reconcileTeamSeatGap).toBeUndefined();
  });
});

describe('comp', () => {
  it('comps a team via POST /admin/teams/:id/comp with no body and returns the full team row', async () => {
    const teamRow = { id: 'tm1', comped: true };
    post.mockResolvedValueOnce({ data: { success: true, data: teamRow } });
    const result = await compTeam('tm1');
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/comp');
    expect(result).toEqual(teamRow);
  });

  it('removes a comp via DELETE /admin/teams/:id/comp with no body and returns the full team row', async () => {
    const teamRow = { id: 'tm1', comped: false };
    del.mockResolvedValueOnce({ data: { success: true, data: teamRow } });
    const result = await uncompTeam('tm1');
    expect(del).toHaveBeenCalledWith('/admin/teams/tm1/comp');
    expect(result).toEqual(teamRow);
  });
});

describe('isEntitlingSubscriptionStatus', () => {
  it('treats active/canceling/pausing/resuming/trialing as entitling, case-insensitively', () => {
    expect(isEntitlingSubscriptionStatus('active')).toBe(true);
    expect(isEntitlingSubscriptionStatus('ACTIVE')).toBe(true);
    expect(isEntitlingSubscriptionStatus('canceling')).toBe(true);
    expect(isEntitlingSubscriptionStatus('pausing')).toBe(true);
    expect(isEntitlingSubscriptionStatus('resuming')).toBe(true);
    expect(isEntitlingSubscriptionStatus('trialing')).toBe(true);
  });

  it('treats paused/canceled/past_due/missing as non-entitling', () => {
    expect(isEntitlingSubscriptionStatus('paused')).toBe(false);
    expect(isEntitlingSubscriptionStatus('canceled')).toBe(false);
    expect(isEntitlingSubscriptionStatus('past_due')).toBe(false);
    expect(isEntitlingSubscriptionStatus(null)).toBe(false);
    expect(isEntitlingSubscriptionStatus(undefined)).toBe(false);
  });
});

describe('add member', () => {
  it('adds one or more existing users via POST /admin/teams/:id/members with {emails} and returns a per-email result array', async () => {
    const results = [
      { email: 'new@kuda.com', status: 'added', memberId: 'mem9' },
      { email: 'ghost@kuda.com', status: 'unknown-user' },
    ];
    post.mockResolvedValueOnce({ data: { success: true, data: results } });
    const result = await addTeamMember('tm1', { emails: ['new@kuda.com', 'ghost@kuda.com'] });
    expect(post).toHaveBeenCalledWith('/admin/teams/tm1/members', {
      emails: ['new@kuda.com', 'ghost@kuda.com'],
    });
    expect(result).toEqual(results);
  });
});

describe('reports', () => {
  it('fetches overview via GET /admin/teams/:id/overview with groupId', async () => {
    await fetchTeamOverview('tm1', 'g1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/overview', { params: { groupId: 'g1' } });
  });

  it('omits groupId from the overview query when absent', async () => {
    await fetchTeamOverview('tm1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/overview', { params: {} });
  });

  it('fetches the report via GET /admin/teams/:id/reports with range and groupId', async () => {
    await fetchTeamReport('tm1', { range: '12w', groupId: 'g1' });
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/reports', {
      params: { range: '12w', groupId: 'g1' },
    });
  });

  it('fetches progress via GET /admin/teams/:id/progress with groupId', async () => {
    await fetchTeamProgress('tm1', 'g1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/progress', { params: { groupId: 'g1' } });
  });

  it('unwraps the nested { members } envelope from GET .../progress into a bare array', async () => {
    const row = { memberId: 'mem1', user: { id: 'u1' }, coursesStarted: 3, coursesCompleted: 1 };
    get.mockResolvedValueOnce({ data: { success: true, data: { members: [row] } } });
    const result = await fetchTeamProgress('tm1');
    expect(result).toEqual([row]);
  });

  it('fetches the leaderboard via GET /admin/teams/:id/leaderboard with groupId and unwraps the nested { entries } envelope resolveTeamLeaderboard actually returns', async () => {
    const row = {
      id: 'u1',
      name: 'Ada',
      username: 'ada',
      avatar: null,
      totalPoints: 120,
      rank: 1,
      totalCompletedCourses: 3,
    };
    get.mockResolvedValueOnce({ data: { success: true, data: { entries: [row] } } });
    const result = await fetchTeamLeaderboard('tm1', 'g1');
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/leaderboard', { params: { groupId: 'g1' } });
    expect(result).toEqual([row]);
  });

  it('exports the CSV via GET .../reports/export.csv as text, not JSON, and parses the filename off the header', async () => {
    get.mockResolvedValueOnce({
      data: 'name,progress\nAda,80%\n',
      headers: { 'content-disposition': 'attachment; filename="kuda-report-12w.csv"' },
    });
    const result = await exportTeamReportCsv('tm1', { range: '12w' });
    expect(get).toHaveBeenCalledWith('/admin/teams/tm1/reports/export.csv', {
      params: { range: '12w' },
      responseType: 'text',
    });
    expect(result).toEqual({
      filename: 'kuda-report-12w.csv',
      csv: 'name,progress\nAda,80%\n',
    });
  });

  it('falls back to a default filename when no Content-Disposition header is present', async () => {
    get.mockResolvedValueOnce({ data: 'name,progress\n', headers: {} });
    const result = await exportTeamReportCsv('tm1');
    expect(result.filename).toBe('report.csv');
  });
});

describe('audit log', () => {
  it('fetches via GET /admin/audit-logs filtered to this team, and returns the body unwrapped only once', async () => {
    get.mockResolvedValueOnce({
      data: { data: [{ id: 'log1' }], total: 1, page: 1, limit: 25 },
    });
    const result = await fetchTeamAuditLog('tm1');
    expect(get).toHaveBeenCalledWith('/admin/audit-logs', {
      params: { entityId: 'tm1', entityType: 'Team' },
    });
    expect(result).toEqual({ data: [{ id: 'log1' }], total: 1, page: 1, limit: 25 });
  });
});
