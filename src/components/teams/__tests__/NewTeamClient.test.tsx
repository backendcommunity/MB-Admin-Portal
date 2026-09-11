import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { createTeam } from '@/lib/api/teams';
import NewTeamClient from '@/components/teams/NewTeamClient';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  push.mockReset();
  vi.mocked(createTeam).mockReset();
  vi.mocked(createTeam).mockResolvedValue({ id: 'tm1' } as never);
});

describe('NewTeamClient', () => {
  it('disables Create until name and owner email are both filled', async () => {
    wrap(<NewTeamClient />);
    const create = screen.getByRole('button', { name: /create team/i });
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/team name/i), 'Kuda');
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/owner email/i), 'a@kuda.com');
    expect(create).toBeEnabled();
  });

  it('disables the seat field while no subscription is chosen', async () => {
    wrap(<NewTeamClient />);
    expect(screen.getByLabelText(/paid seats/i)).toBeDisabled();
  });

  it('omits seats from the payload when no subscription is chosen', async () => {
    wrap(<NewTeamClient />);
    await userEvent.type(screen.getByLabelText(/team name/i), 'Kuda');
    await userEvent.type(screen.getByLabelText(/owner email/i), 'a@kuda.com');
    await userEvent.click(screen.getByRole('button', { name: /create team/i }));
    expect(vi.mocked(createTeam)).toHaveBeenCalledWith({ name: 'Kuda', ownerEmail: 'a@kuda.com' });
  });
});
