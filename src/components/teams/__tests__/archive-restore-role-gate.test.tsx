/**
 * Archive/restore (POST /admin/teams/:id/archive, /restore) are
 * `requireSuperAdmin` on the API. An ADMIN must not see an enabled control
 * that only ends in a 403 after they've typed the team name to confirm —
 * the button should be disabled (with a reason), same as other
 * `SuperAdminOnly` controls in the console.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'tm1' }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { fetchTeam } from '@/lib/api/teams';
import TeamDetailClient from '@/components/teams/TeamDetailClient';
import { useAuthStore } from '@/store/authStore';

const detail = (over = {}) => ({
  id: 'tm1',
  name: 'Kuda Engineering',
  owner: { id: 'u1', name: 'Aisha Bello', email: 'aisha@kuda.com' },
  processor: 'PADDLE',
  subscriptionStatus: 'active',
  seats: {
    subscribed: true,
    paidSeats: 14,
    activeMembers: 11,
    pendingInvites: 1,
    used: 12,
    available: 2,
  },
  seatGap: null,
  archivedAt: null,
  createdAt: '2026-03-14T00:00:00.000Z',
  subscription: {
    id: 'sub1',
    status: 'active',
    seats: 14,
    paidSeats: 14,
    amount: 180,
    currency: 'USD',
  },
  members: [],
  pendingInvites: [],
  ...over,
});

const asRole = (role: string, authResolved = true) =>
  useAuthStore.setState({ userRole: role as never, authResolved });

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(fetchTeam).mockResolvedValue(detail() as never);
});

describe('TeamDetailClient — archive/restore role gate', () => {
  it('disables Archive team for an ADMIN', async () => {
    asRole('ADMIN');
    wrap(<TeamDetailClient />);
    const archiveButton = await screen.findByRole('button', { name: /archive team/i });
    expect(archiveButton).toBeDisabled();
  });

  it('leaves Archive team enabled for a SUPER_ADMIN', async () => {
    asRole('SUPER_ADMIN');
    wrap(<TeamDetailClient />);
    const archiveButton = await screen.findByRole('button', { name: /archive team/i });
    expect(archiveButton).toBeEnabled();
  });

  it('disables Restore for an ADMIN on an archived team', async () => {
    asRole('ADMIN');
    vi.mocked(fetchTeam).mockResolvedValue(
      detail({ archivedAt: '2026-09-01T00:00:00.000Z' }) as never,
    );
    wrap(<TeamDetailClient />);
    const restoreButton = await screen.findByRole('button', { name: /restore/i });
    expect(restoreButton).toBeDisabled();
  });

  it('leaves Restore enabled for a SUPER_ADMIN on an archived team', async () => {
    asRole('SUPER_ADMIN');
    vi.mocked(fetchTeam).mockResolvedValue(
      detail({ archivedAt: '2026-09-01T00:00:00.000Z' }) as never,
    );
    wrap(<TeamDetailClient />);
    const restoreButton = await screen.findByRole('button', { name: /restore/i });
    expect(restoreButton).toBeEnabled();
  });
});
