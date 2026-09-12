import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { fetchTeams } from '@/lib/api/teams';
import TeamsTable from '@/components/teams/TeamsTable';

const row = (over = {}) => ({
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
  ...over,
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(fetchTeams).mockResolvedValue({ teams: [row()], total: 1, page: 1, limit: 25 });
});

describe('TeamsTable', () => {
  it('renders a team row', async () => {
    wrap(<TeamsTable />);
    expect((await screen.findAllByText('Kuda Engineering')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/aisha@kuda\.com/).length).toBeGreaterThan(0);
  });

  it('shows seat usage as used over paid', async () => {
    wrap(<TeamsTable />);
    expect((await screen.findAllByText('12/14')).length).toBeGreaterThan(0);
  });

  it('flags a seat mismatch when seatGap is set', async () => {
    vi.mocked(fetchTeams).mockResolvedValue({
      teams: [row({ seatGap: 2 })],
      total: 1,
      page: 1,
      limit: 25,
    });
    wrap(<TeamsTable />);
    expect((await screen.findAllByText(/±2/)).length).toBeGreaterThan(0);
  });

  it('passes the search term through to the API', async () => {
    wrap(<TeamsTable />);
    await screen.findAllByText('Kuda Engineering');
    await userEvent.type(screen.getByLabelText(/search teams/i), 'kuda');
    await waitFor(() =>
      expect(vi.mocked(fetchTeams)).toHaveBeenCalledWith(expect.objectContaining({ q: 'kuda' })),
    );
  });

  it('renders the empty state when nothing matches', async () => {
    vi.mocked(fetchTeams).mockResolvedValue({ teams: [], total: 0, page: 1, limit: 25 });
    wrap(<TeamsTable />);
    expect(await screen.findByText(/no teams/i)).toBeInTheDocument();
  });

  it('renders a MANUAL row sensibly, not the raw processor string', async () => {
    vi.mocked(fetchTeams).mockResolvedValue({
      teams: [row({ processor: 'MANUAL', subscriptionStatus: 'ACTIVE' })],
      total: 1,
      page: 1,
      limit: 25,
    });
    wrap(<TeamsTable />);
    expect((await screen.findAllByText(/paid manually/i)).length).toBeGreaterThan(0);
  });

  it('includes MANUAL in the processor filter', async () => {
    wrap(<TeamsTable />);
    await screen.findAllByText('Kuda Engineering');
    await userEvent.click(screen.getByLabelText(/filter by processor/i));
    expect((await screen.findAllByText('MANUAL')).length).toBeGreaterThan(0);
  });
});
