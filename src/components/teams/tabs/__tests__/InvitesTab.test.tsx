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
  useAuthStore.setState({ userRole: 'SUPER_ADMIN' as never, authResolved: true });
});

describe('InvitesTab', () => {
  it('renders the pending and history tables', async () => {
    setup(seats());
    expect((await screen.findAllByText('tunde@kuda.com')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('contractor@gmail.com')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/revoked/i).length).toBeGreaterThan(0);
  });

  it('states the seat rule: a pending invite holds a seat, revoking never lowers paidSeats', async () => {
    setup(seats());
    await screen.findAllByText('tunde@kuda.com');
    expect(screen.getByText(/holds a seat/i)).toBeInTheDocument();
    expect(screen.getByText(/never lowers/i)).toBeInTheDocument();
    expect(screen.getByText('paidSeats')).toBeInTheDocument();
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

  describe('invite dialog — the money copy', () => {
    it('says plainly the invite is free when a seat is available', async () => {
      setup(seats({ available: 2 }));
      await screen.findAllByText('tunde@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /invite member/i }));

      expect(screen.getByText(/2 spare seats/i)).toBeInTheDocument();
      expect(screen.getByText(/costs nothing/i)).toBeInTheDocument();
      expect(screen.queryByText(/charges the customer/i)).not.toBeInTheDocument();

      // Not SuperAdminOnly-gated: a plain email is enough to enable it.
      await userEvent.type(screen.getByLabelText(/email/i), 'new@kuda.com');
      const sendButton = screen.getByRole('button', { name: /send invite/i });
      expect(sendButton).toBeEnabled();
    });

    it('says plainly that adding a seat charges the card when none are available', async () => {
      setup(seats({ available: 0 }));
      await screen.findAllByText('tunde@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /invite member/i }));

      expect(screen.getByText(/no spare seats/i)).toBeInTheDocument();
      expect(screen.getByText(/charges the customer.s card/i)).toBeInTheDocument();
      expect(screen.queryByText(/costs nothing/i)).not.toBeInTheDocument();
    });

    it('sending a free invite calls the API', async () => {
      const onChanged = vi.fn();
      vi.mocked(inviteTeamMember).mockResolvedValue({ id: 'inv3' } as never);
      setup(seats({ available: 2 }), onChanged);
      await screen.findAllByText('tunde@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /invite member/i }));

      await userEvent.type(screen.getByLabelText(/email/i), 'new@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

      expect(inviteTeamMember).toHaveBeenCalledWith('tm1', 'new@kuda.com');
      expect(onChanged).toHaveBeenCalled();
    });

    it('disables the charging invite for a non-super-admin, with a visible reason', async () => {
      useAuthStore.setState({ userRole: 'ADMIN' as never, authResolved: true });
      setup(seats({ available: 0 }));
      await screen.findAllByText('tunde@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /invite member/i }));
      await userEvent.type(screen.getByLabelText(/email/i), 'new@kuda.com');

      const sendButton = screen.getByRole('button', { name: /send invite/i });
      expect(sendButton).toBeDisabled();
      expect(screen.getByText(/super admin only/i)).toBeInTheDocument();
    });

    it('lets a super admin actually send the charging invite', async () => {
      vi.mocked(inviteTeamMember).mockResolvedValue({ id: 'inv3' } as never);
      setup(seats({ available: 0 }));
      await screen.findAllByText('tunde@kuda.com');
      await userEvent.click(screen.getByRole('button', { name: /invite member/i }));
      await userEvent.type(screen.getByLabelText(/email/i), 'new@kuda.com');

      const sendButton = screen.getByRole('button', { name: /send invite/i });
      expect(sendButton).toBeEnabled();
      await userEvent.click(sendButton);

      expect(inviteTeamMember).toHaveBeenCalledWith('tm1', 'new@kuda.com');
    });
  });
});
