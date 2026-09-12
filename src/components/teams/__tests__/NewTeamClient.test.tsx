import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { createTeam, recordManualTeamPayment } from '@/lib/api/teams';
import NewTeamClient from '@/components/teams/NewTeamClient';
import { toast } from 'sonner';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function oneYearFromToday() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  push.mockReset();
  vi.mocked(createTeam).mockReset();
  vi.mocked(createTeam).mockResolvedValue({ id: 'tm1' } as never);
  vi.mocked(recordManualTeamPayment).mockReset();
  vi.mocked(recordManualTeamPayment).mockResolvedValue({ id: 'tm1' } as never);
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
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

  it('disables the seat field while no existing-subscription id is typed', async () => {
    wrap(<NewTeamClient />);
    await userEvent.click(screen.getByRole('radio', { name: /attach an existing subscription/i }));
    expect(screen.getByLabelText(/paid seats/i)).toBeDisabled();
  });

  it('omits seats from the payload when no subscription is chosen', async () => {
    wrap(<NewTeamClient />);
    await userEvent.type(screen.getByLabelText(/team name/i), 'Kuda');
    await userEvent.type(screen.getByLabelText(/owner email/i), 'a@kuda.com');
    await userEvent.click(screen.getByRole('button', { name: /create team/i }));
    expect(vi.mocked(createTeam)).toHaveBeenCalledWith({ name: 'Kuda', ownerEmail: 'a@kuda.com' });
  });

  it('shows the no-Pro-access warning for the default "no subscription yet" choice, and submits neither subscriptionId nor seats', async () => {
    wrap(<NewTeamClient />);
    expect(screen.getByRole('radio', { name: /no subscription yet/i })).toBeChecked();
    expect(screen.getByText(/no pro access/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/team name/i), 'Kuda');
    await userEvent.type(screen.getByLabelText(/owner email/i), 'a@kuda.com');
    await userEvent.click(screen.getByRole('button', { name: /create team/i }));

    const payload = vi.mocked(createTeam).mock.calls[0][0];
    expect(payload).not.toHaveProperty('subscriptionId');
    expect(payload).not.toHaveProperty('seats');
    expect(recordManualTeamPayment).not.toHaveBeenCalled();
  });

  it('choosing "paid manually" reveals seats/expiry, defaults expiry to a year out, and submits them via recordManualTeamPayment', async () => {
    wrap(<NewTeamClient />);
    await userEvent.click(screen.getByRole('radio', { name: /paid manually/i }));

    const expiryInput = screen.getByLabelText(/expiry/i) as HTMLInputElement;
    expect(expiryInput.value).toBe(oneYearFromToday());

    await userEvent.type(screen.getByLabelText(/team name/i), 'Kuda');
    await userEvent.type(screen.getByLabelText(/owner email/i), 'a@kuda.com');
    const seatsInput = screen.getByLabelText(/^seats/i);
    await userEvent.clear(seatsInput);
    await userEvent.type(seatsInput, '25');

    await userEvent.click(screen.getByRole('button', { name: /create team/i }));

    expect(vi.mocked(createTeam)).toHaveBeenCalledWith({ name: 'Kuda', ownerEmail: 'a@kuda.com' });
    expect(vi.mocked(recordManualTeamPayment)).toHaveBeenCalledWith(
      'tm1',
      expect.objectContaining({ seats: 25, expiry: expect.any(String) }),
    );
  });

  it('surfaces a failed manual-payment call after team creation without leaving the operator guessing', async () => {
    vi.mocked(recordManualTeamPayment).mockRejectedValue({
      response: { data: { message: 'Boom' } },
    });
    wrap(<NewTeamClient />);
    await userEvent.click(screen.getByRole('radio', { name: /paid manually/i }));
    await userEvent.type(screen.getByLabelText(/team name/i), 'Kuda');
    await userEvent.type(screen.getByLabelText(/owner email/i), 'a@kuda.com');
    const seatsInput = screen.getByLabelText(/^seats/i);
    await userEvent.clear(seatsInput);
    await userEvent.type(seatsInput, '25');

    await userEvent.click(screen.getByRole('button', { name: /create team/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [message, opts] = vi.mocked(toast.error).mock.calls[0];
    expect(String(message)).toMatch(/team was created/i);
    expect(String(message) + JSON.stringify(opts)).toMatch(/Boom/);
    // The team exists — the operator is sent to it, not left stranded.
    expect(push).toHaveBeenCalledWith('/teams/tm1');
  });
});
