import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  fetchTeamInvites,
  inviteTeamMember,
  resendTeamInvite,
  revokeTeamInvite,
  type TeamSeatUsage,
} from '@/lib/api/teams';
import { InvitesTab } from '@/components/teams/tabs/InvitesTab';
import { useAuthStore } from '@/store/authStore';

const seats = (over: Partial<TeamSeatUsage> = {}): TeamSeatUsage => ({
  subscribed: true,
  paidSeats: 14,
  activeMembers: 11,
  pendingInvites: 1,
  used: 12,
  available: 2,
  ...over,
});

const unsubscribedSeats = (over: Partial<TeamSeatUsage> = {}): TeamSeatUsage => ({
  subscribed: false,
  paidSeats: 0,
  activeMembers: 3,
  pendingInvites: 0,
  used: 3,
  available: 0,
  ...over,
});

const pendingInvite = {
  id: 'inv1',
  email: 'tunde@kuda.com',
  invitedByUserId: 'staff1',
  expiresAt: '2099-01-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  status: 'PENDING',
};

const historyInvite = {
  id: 'inv2',
  email: 'contractor@gmail.com',
  invitedByUserId: 'staff1',
  expiresAt: '2026-08-05T00:00:00.000Z',
  createdAt: '2026-08-02T00:00:00.000Z',
  status: 'REVOKED',
};

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function setup(seatUsage: TeamSeatUsage, onChanged = vi.fn()) {
  return wrap(
    <InvitesTab teamId="tm1" seats={seatUsage} isArchived={false} onChanged={onChanged} />,
  );
}

beforeEach(() => {
  vi.mocked(fetchTeamInvites).mockResolvedValue({
    pending: [pendingInvite],
    history: [historyInvite],
  });
  vi.mocked(inviteTeamMember).mockReset();
  vi.mocked(resendTeamInvite).mockReset();
  vi.mocked(revokeTeamInvite).mockReset();
  // Regression guard for removing SuperAdminOnly from the invite path: a
  // plain ADMIN is the default role under test everywhere in this file.
  useAuthStore.setState({ userRole: 'ADMIN' as never, authResolved: true });
});

describe('InvitesTab', () => {
  it('renders the pending and history tables', async () => {
    setup(seats());
    expect((await screen.findAllByText('tunde@kuda.com')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('contractor@gmail.com')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/revoked/i).length).toBeGreaterThan(0);
  });

  it('revoking a pending invite calls the API and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(revokeTeamInvite).mockResolvedValue({ id: 'inv1' });
    setup(seats(), onChanged);
    await screen.findAllByText('tunde@kuda.com');

    const revokeButtons = screen.getAllByRole('button', { name: 'Revoke' });
    await userEvent.click(revokeButtons[0]!);

    expect(revokeTeamInvite).toHaveBeenCalledWith('tm1', 'inv1');
    expect(onChanged).toHaveBeenCalled();
  });

  it('resending a pending invite calls the API', async () => {
    vi.mocked(resendTeamInvite).mockResolvedValue({ ...pendingInvite });
    setup(seats());
    await screen.findAllByText('tunde@kuda.com');

    const resendButtons = screen.getAllByRole('button', { name: 'Resend' });
    await userEvent.click(resendButtons[0]!);

    expect(resendTeamInvite).toHaveBeenCalledWith('tm1', 'inv1');
  });

  describe('the seat-holding note', () => {
    it('shows for a subscribed team', async () => {
      setup(seats());
      await screen.findAllByText('tunde@kuda.com');
      expect(screen.getByText(/holds a seat/i)).toBeInTheDocument();
      expect(screen.getByText(/never lowers/i)).toBeInTheDocument();
      expect(screen.getByText('paidSeats')).toBeInTheDocument();
    });

    it('is absent for an unsubscribed team, where it is meaningless', async () => {
      setup(unsubscribedSeats());
      await screen.findAllByText('tunde@kuda.com');
      expect(screen.queryByText(/holds a seat/i)).not.toBeInTheDocument();
      expect(screen.queryByText('paidSeats')).not.toBeInTheDocument();
    });
  });

  describe('invite dialog — three states of money copy', () => {
    it('unsubscribed: says invites are free, no seat/cost language, submit enabled for a plain ADMIN', async () => {
      setup(unsubscribedSeats());
      await screen.findAllByText('tunde@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /invite member/i }));

      expect(screen.getByText(/no subscription/i)).toBeInTheDocument();
      expect(screen.getByText(/free/i)).toBeInTheDocument();
      expect(screen.getByText(/nobody is charged/i)).toBeInTheDocument();
      expect(screen.getByText(/no paid access/i)).toBeInTheDocument();

      // No seat/cost language of any kind in this state.
      expect(screen.queryByText(/spare seat/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/costs nothing/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/charges/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/super admin/i)).not.toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(/email/i), 'new@kuda.com');
      const sendButton = screen.getByRole('button', { name: /send invite/i });
      expect(sendButton).toBeEnabled();
    });

    it('unsubscribed: sending calls the API directly, no confirmation needed', async () => {
      const onChanged = vi.fn();
      vi.mocked(inviteTeamMember).mockResolvedValue({ id: 'inv3' } as never);
      setup(unsubscribedSeats(), onChanged);
      await screen.findAllByText('tunde@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /invite member/i }));

      await userEvent.type(screen.getByLabelText(/email/i), 'new@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

      expect(inviteTeamMember).toHaveBeenCalledWith('tm1', 'new@kuda.com');
      expect(onChanged).toHaveBeenCalled();
    });

    it('subscribed with a spare seat: says plainly it is free, no confirmation required, no super-admin language', async () => {
      const onChanged = vi.fn();
      vi.mocked(inviteTeamMember).mockResolvedValue({ id: 'inv3' } as never);
      setup(seats({ available: 2 }), onChanged);
      await screen.findAllByText('tunde@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /invite member/i }));

      expect(screen.getByText(/2 spare seats/i)).toBeInTheDocument();
      expect(screen.getByText(/costs nothing/i)).toBeInTheDocument();
      expect(screen.queryByText(/charges the/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/super admin/i)).not.toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(/email/i), 'new@kuda.com');
      const sendButton = screen.getByRole('button', { name: /send invite/i });
      expect(sendButton).toBeEnabled();
      await userEvent.click(sendButton);

      expect(inviteTeamMember).toHaveBeenCalledWith('tm1', 'new@kuda.com');
      expect(onChanged).toHaveBeenCalled();
    });

    it('subscribed at capacity: names the charge, is NOT blocked for a plain ADMIN, but requires confirmation before the API is called', async () => {
      setup(seats({ available: 0 }));
      await screen.findAllByText('tunde@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /invite member/i }));

      expect(screen.getByText(/no spare seats/i)).toBeInTheDocument();
      expect(screen.getByText(/charges.*owner.*card/i)).toBeInTheDocument();
      expect(screen.queryByText(/costs nothing/i)).not.toBeInTheDocument();
      // The SuperAdminOnly wrapper is gone from this control — no "super
      // admin" gating language for a plain ADMIN in this state.
      expect(screen.queryByText(/super admin only/i)).not.toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(/email/i), 'new@kuda.com');
      const firstClick = screen.getByRole('button', { name: /send invite/i });
      expect(firstClick).toBeEnabled();
      await userEvent.click(firstClick);

      // Not sent yet — a confirmation naming the cost must appear first.
      expect(inviteTeamMember).not.toHaveBeenCalled();
      expect(screen.getByText(/^Confirm:/i)).toBeInTheDocument();
      expect(screen.getByText(/immediately charge the team owner.s card/i)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /charge.*send/i });
      await userEvent.click(confirmButton);

      expect(inviteTeamMember).toHaveBeenCalledWith('tm1', 'new@kuda.com');
    });

    it('subscribed at capacity: the API is called only after confirming, and only once', async () => {
      const onChanged = vi.fn();
      vi.mocked(inviteTeamMember).mockResolvedValue({ id: 'inv3' } as never);
      setup(seats({ available: 0 }), onChanged);
      await screen.findAllByText('tunde@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /invite member/i }));
      await userEvent.type(screen.getByLabelText(/email/i), 'new@kuda.com');

      await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
      expect(inviteTeamMember).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: /charge.*send/i }));
      expect(inviteTeamMember).toHaveBeenCalledTimes(1);
      expect(onChanged).toHaveBeenCalled();
    });
  });
});
