import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'tm1' }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { fetchTeam, archiveTeam } from '@/lib/api/teams';
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
  members: [
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
      status: 'REMOVED',
      joinedAt: '2026-03-14T00:00:00.000Z',
      removedAt: '2026-08-01T00:00:00.000Z',
      user: { id: 'u2', name: 'Femi Adigun', email: 'femi@kuda.com', avatar: null },
    },
  ],
  pendingInvites: [],
  ...over,
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(fetchTeam).mockResolvedValue(detail() as never);
  vi.mocked(archiveTeam).mockReset();
  // Archive/Restore are SuperAdminOnly (see archive-restore-role-gate.test.tsx);
  // these tests exercise the archive/restore flow itself, so run as a role
  // that isn't gated out of it.
  useAuthStore.setState({ userRole: 'SUPER_ADMIN' as never, authResolved: true });
});

describe('TeamDetailClient', () => {
  it('renders the team name and seat usage', async () => {
    wrap(<TeamDetailClient />);
    expect((await screen.findAllByText('Kuda Engineering')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/14/).length).toBeGreaterThan(0);
  });

  it('hides removed members until asked', async () => {
    wrap(<TeamDetailClient />);
    await screen.findAllByText('Kuda Engineering');
    await userEvent.click(screen.getByRole('tab', { name: /members/i }));
    expect(screen.queryByText('Femi Adigun')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/show removed/i));
    expect((await screen.findAllByText('Femi Adigun')).length).toBeGreaterThan(0);
  });

  it('requires the exact team name before archiving is enabled', async () => {
    wrap(<TeamDetailClient />);
    await screen.findAllByText('Kuda Engineering');
    await userEvent.click(screen.getByRole('button', { name: /archive team/i }));
    const confirm = screen.getByRole('button', { name: /^archive team$/i, hidden: false });
    const input = screen.getByLabelText(/type the team name/i);
    await userEvent.type(input, 'Kuda');
    expect(confirm).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, 'Kuda Engineering');
    expect(confirm).toBeEnabled();
  });

  it('shows a restore action instead of archive when already archived', async () => {
    vi.mocked(fetchTeam).mockResolvedValue(
      detail({ archivedAt: '2026-09-01T00:00:00.000Z' }) as never,
    );
    wrap(<TeamDetailClient />);
    expect(await screen.findByRole('button', { name: /restore/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /archive team/i })).not.toBeInTheDocument();
  });
});
