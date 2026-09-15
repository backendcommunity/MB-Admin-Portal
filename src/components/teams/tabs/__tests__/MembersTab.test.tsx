import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  setTeamMemberRole,
  removeTeamMember,
  fetchTeamProgress,
  fetchTeamMemberProgress,
  addTeamMember,
} from '@/lib/api/teams';
import { MembersTab } from '@/components/teams/tabs/MembersTab';
import type { TeamMemberRow, TeamProgressRow } from '@/lib/api/teams';
import { toast } from 'sonner';

const members: TeamMemberRow[] = [
  {
    id: 'mem1',
    role: 'OWNER',
    status: 'ACTIVE',
    joinedAt: '2026-03-14T00:00:00.000Z',
    removedAt: null,
    user: { id: 'u1', name: 'Aisha Bello', email: 'aisha@kuda.com', avatar: null },
  },
  {
    id: 'mem2',
    role: 'MEMBER',
    status: 'ACTIVE',
    joinedAt: '2026-04-01T00:00:00.000Z',
    removedAt: null,
    user: { id: 'u2', name: 'Chidi Okonkwo', email: 'chidi@kuda.com', avatar: null },
  },
  {
    id: 'mem3',
    role: 'MEMBER',
    status: 'REMOVED',
    joinedAt: '2026-03-14T00:00:00.000Z',
    removedAt: '2026-08-01T00:00:00.000Z',
    user: { id: 'u3', name: 'Femi Adigun', email: 'femi@kuda.com', avatar: null },
  },
];

// Deliberately no row for u1 (Aisha) — the "joined today, never started
// anything" case the join must render as an em dash, not a fabricated 0.
const progressRows: TeamProgressRow[] = [
  {
    memberId: 'mem2',
    role: 'MEMBER',
    joinedAt: '2026-04-01T00:00:00.000Z',
    status: 'ACTIVE',
    removedAt: null,
    user: { id: 'u2', name: 'Chidi Okonkwo', email: 'chidi@kuda.com', avatar: null },
    coursesStarted: 7,
    coursesCompleted: 3,
    projectsBuilt: 1,
    points: 120,
    currentStreak: 4,
    lastActivityAt: '2026-09-01T00:00:00.000Z',
    isStalled: false,
  },
];

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function setup(onChanged = vi.fn(), hasSubscription = false) {
  return wrap(
    <MembersTab
      teamId="tm1"
      members={members}
      isArchived={false}
      hasSubscription={hasSubscription}
      onChanged={onChanged}
    />,
  );
}

beforeEach(() => {
  vi.mocked(setTeamMemberRole).mockReset();
  vi.mocked(removeTeamMember).mockReset();
  // A concrete, non-empty resolution by default — tests that need to
  // interact with the roster wait on "3 of 7 courses" as proof the
  // roster-progress query has actually settled (an empty-array resolution
  // renders identically to the loading state, so it cannot serve as a
  // settle marker for userEvent interactions that follow).
  vi.mocked(fetchTeamProgress).mockResolvedValue(progressRows);
  vi.mocked(fetchTeamMemberProgress).mockReset();
  vi.mocked(addTeamMember).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.success).mockReset();
});

describe('MembersTab', () => {
  it('renders the active roster', () => {
    setup();
    expect(screen.getAllByText('Aisha Bello').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Chidi Okonkwo').length).toBeGreaterThan(0);
  });

  it('hides removed members until the toggle is checked', async () => {
    setup();
    expect(screen.queryByText('Femi Adigun')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/show removed/i));
    expect(screen.getAllByText('Femi Adigun').length).toBeGreaterThan(0);
  });

  it('calls setTeamMemberRole when a role change is saved', async () => {
    const onChanged = vi.fn();
    vi.mocked(setTeamMemberRole).mockResolvedValue({ id: 'mem2', role: 'ADMIN' });
    setup(onChanged);

    // Wait for the roster-progress query to actually settle before
    // interacting — a still-pending query re-rendering mid-click can
    // detach the very button `userEvent` is about to click. "3 of 7
    // courses" only ever renders once the join has resolved, unlike an
    // empty-array resolution (which is indistinguishable from loading).
    await screen.findAllByText('3 of 7 courses');
    const roleButtons = screen.getAllByRole('button', { name: 'Role' });
    await userEvent.click(roleButtons[0]!);

    const adminOption = await screen.findByRole('button', { name: 'ADMIN' });
    await userEvent.click(adminOption);
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(setTeamMemberRole).toHaveBeenCalledWith('tm1', 'mem2', 'ADMIN');
    expect(onChanged).toHaveBeenCalled();
  });

  it('never offers Role or Remove for the OWNER row — the API 409s both', () => {
    setup();
    // Exactly one active non-owner member (Chidi) exists. DataTable renders
    // a desktop table AND a mobile card list from the same column defs, so
    // each real row's controls appear twice (2, not 1) — with none at all
    // for Aisha (OWNER).
    expect(screen.getAllByRole('button', { name: 'Role' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
  });

  it('shows Role and Remove on an ordinary member row but not on the OWNER row', () => {
    setup();
    // Scoped to the desktop `<tr>` (the first of each duplicated pair) so
    // this asserts the per-row wiring directly, not just aggregate counts.
    const ownerRow = screen.getAllByText('Aisha Bello')[0]!.closest('tr')!;
    const memberRow = screen.getAllByText('Chidi Okonkwo')[0]!.closest('tr')!;

    expect(within(ownerRow).queryByRole('button', { name: 'Role' })).not.toBeInTheDocument();
    expect(within(ownerRow).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(within(memberRow).getByRole('button', { name: 'Role' })).toBeInTheDocument();
    expect(within(memberRow).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('removing a member calls the API after confirming, naming the person', async () => {
    const onChanged = vi.fn();
    vi.mocked(removeTeamMember).mockResolvedValue({ id: 'mem2' });
    setup(onChanged);

    // See the role-change test above for why this waits on a concrete,
    // non-empty settle marker rather than just the roster's own name text.
    await screen.findAllByText('3 of 7 courses');
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await userEvent.click(removeButtons[0]!);

    expect(await screen.findByText(/remove chidi okonkwo from the team/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(removeTeamMember).toHaveBeenCalledWith('tm1', 'mem2');
    expect(onChanged).toHaveBeenCalled();
  });

  describe('roster-progress join (Courses done / Progress)', () => {
    it('fills Courses done and Progress by joining fetchTeamProgress on userId', async () => {
      vi.mocked(fetchTeamProgress).mockResolvedValue(progressRows);
      setup();

      expect((await screen.findAllByText('3 of 7 courses')).length).toBeGreaterThan(0);
      const memberRow = screen.getAllByText('Chidi Okonkwo')[0]!.closest('tr')!;
      // "Courses done" (a bare count) and "Progress" ("N of M courses") both
      // draw from the same joined row.
      expect(within(memberRow).getByText('3')).toBeInTheDocument();
      expect(within(memberRow).getByText('3 of 7 courses')).toBeInTheDocument();
    });

    it('renders an em dash, not 0, for a member with no roster-progress row', async () => {
      vi.mocked(fetchTeamProgress).mockResolvedValue(progressRows); // no row for u1 (Aisha)
      setup();
      await screen.findAllByText('3 of 7 courses'); // wait for the join to settle

      const ownerRow = screen.getAllByText('Aisha Bello')[0]!.closest('tr')!;
      expect(within(ownerRow).getAllByText('—').length).toBeGreaterThan(0);
      expect(within(ownerRow).queryByText('0')).not.toBeInTheDocument();
      expect(within(ownerRow).queryByText(/of 0 courses/)).not.toBeInTheDocument();
    });

    it('keeps the roster rendered — not blanked — when fetchTeamProgress fails', async () => {
      vi.mocked(fetchTeamProgress).mockRejectedValue(new Error('boom'));
      setup();

      // The roster itself comes from the `members` prop, independent of the
      // progress query, so it must never disappear while that query is
      // loading or after it has failed.
      expect(screen.getAllByText('Aisha Bello').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Chidi Okonkwo').length).toBeGreaterThan(0);

      // Let the rejected query settle, then confirm the roster survived and
      // the progress columns simply fell back to an em dash.
      await waitFor(() => expect(fetchTeamProgress).toHaveBeenCalled());
      expect(screen.getAllByText('Aisha Bello').length).toBeGreaterThan(0);
      const memberRow = screen.getAllByText('Chidi Okonkwo')[0]!.closest('tr')!;
      expect(within(memberRow).getAllByText('—').length).toBeGreaterThan(0);
    });
  });

  describe('per-member progress dialog', () => {
    const memberProgress = {
      user: { id: 'u2', name: 'Chidi Okonkwo', email: 'chidi@kuda.com', avatar: null },
      stats: { points: 340, level: 5, currentStreak: 6, longestStreak: 12, lastActivityAt: null },
      courses: [
        { id: 'c1', title: 'Node basics', slug: 'node-basics', isCompleted: false, percent: 40 },
      ],
      paths: [{ id: 'p1', title: 'Backend path', completedItems: 2, totalItems: 5 }],
      projects: [],
      quizzes: { taken: 2, passed: 1 },
      mockInterviews: { taken: 1, completed: 1, lastTakenAt: null },
      activity: [],
    };

    it('renders the real nested shape — points, courses and paths — never [object Object]', async () => {
      vi.mocked(fetchTeamMemberProgress).mockResolvedValue(memberProgress);
      setup();

      // See the role-change test above: wait for the roster-progress query
      // to settle before clicking — otherwise a still-pending query
      // re-rendering mid-click can detach the very button being clicked.
      await screen.findAllByText('3 of 7 courses');
      const progressButtons = screen.getAllByRole('button', { name: 'Progress' });
      await userEvent.click(progressButtons[0]!);

      expect(await screen.findByText('340')).toBeInTheDocument();
      expect(screen.getByText('Node basics')).toBeInTheDocument();
      expect(screen.getByText('40%')).toBeInTheDocument();
      expect(screen.getByText('Backend path')).toBeInTheDocument();
      expect(screen.getByText('2 of 5 items')).toBeInTheDocument();
      expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
    });
  });

  describe('Add member — distinct from Invite', () => {
    it('renders Add member beside an Invite affordance that describes a different action', () => {
      setup();
      expect(screen.getByRole('button', { name: /add member/i })).toBeInTheDocument();
      // The Invite alternative is surfaced right beside it, and the copy
      // spells out the actual difference so an operator never has to guess.
      expect(screen.getByText(/invite someone instead/i)).toBeInTheDocument();
      expect(screen.getByText(/get.*pro immediately/i)).toBeInTheDocument();
      expect(screen.getByText(/invite.*join once they accept/i)).toBeInTheDocument();
    });

    it('adding a member calls addTeamMember with the email and refreshes', async () => {
      const onChanged = vi.fn();
      vi.mocked(addTeamMember).mockResolvedValue([
        { email: 'new@kuda.com', status: 'added', memberId: 'mem9' },
      ]);
      setup(onChanged);

      await userEvent.click(screen.getByRole('button', { name: /add member/i }));
      await userEvent.type(screen.getByLabelText(/emails/i), 'new@kuda.com{Enter}');
      await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

      expect(addTeamMember).toHaveBeenCalledWith('tm1', { emails: ['new@kuda.com'] });
      expect(onChanged).toHaveBeenCalled();
    });

    it('accepts several emails as chips and sends them all in one call', async () => {
      const onChanged = vi.fn();
      vi.mocked(addTeamMember).mockResolvedValue([
        { email: 'a@kuda.com', status: 'added', memberId: 'm1' },
        { email: 'b@kuda.com', status: 'added', memberId: 'm2' },
      ]);
      setup(onChanged);

      await userEvent.click(screen.getByRole('button', { name: /add member/i }));
      const input = screen.getByLabelText(/emails/i);
      await userEvent.type(input, 'a@kuda.com{Enter}');
      await userEvent.type(input, 'b@kuda.com{Enter}');
      await userEvent.click(screen.getByRole('button', { name: /^add 2$/i }));

      expect(addTeamMember).toHaveBeenCalledWith('tm1', { emails: ['a@kuda.com', 'b@kuda.com'] });
      expect(onChanged).toHaveBeenCalled();
    });

    it('rejects a malformed entry as a chip instead of sending it', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: /add member/i }));
      const input = screen.getByLabelText(/emails/i);
      await userEvent.type(input, 'not-an-email{Enter}');

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('not-an-email'),
        expect.anything(),
      );
      expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled();
    });

    it('reports a per-email failure without blocking the emails that succeeded', async () => {
      vi.mocked(addTeamMember).mockResolvedValue([
        { email: 'new@kuda.com', status: 'added', memberId: 'mem9' },
        { email: 'ghost@kuda.com', status: 'unknown-user' },
      ]);
      setup();

      await userEvent.click(screen.getByRole('button', { name: /add member/i }));
      const input = screen.getByLabelText(/emails/i);
      await userEvent.type(input, 'new@kuda.com{Enter}');
      await userEvent.type(input, 'ghost@kuda.com{Enter}');
      await userEvent.click(screen.getByRole('button', { name: /^add 2$/i }));

      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('new@kuda.com'));
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('ghost@kuda.com'),
        expect.objectContaining({ description: expect.stringContaining('no account') }),
      );
    });

    it('disables Add member when a subscription is attached, pointing at Invite instead', () => {
      setup(vi.fn(), true);
      expect(screen.getByRole('button', { name: /add member/i })).toBeDisabled();
      expect(screen.getByText(/subscription attached/i)).toBeInTheDocument();
    });
  });
});
