import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Partial mock: every write is a mock fn, but `formatCurrency` — a pure
// formatter this tab calls directly for the per-seat price/total, and whose
// non-USD behaviour this file specifically tests — keeps its real
// implementation. A blanket `vi.mock('@/lib/api/teams')` automocks it to a
// `vi.fn()` returning `undefined`, which would render every price cell empty
// regardless of what the component does with it.
vi.mock('@/lib/api/teams', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/teams')>();
  return {
    ...actual,
    attachTeamSubscription: vi.fn(),
    detachTeamSubscription: vi.fn(),
    adminSetTeamSeats: vi.fn(),
    dismissTeamSeatGap: vi.fn(),
    fetchTeamAuditLog: vi.fn(),
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  attachTeamSubscription,
  detachTeamSubscription,
  adminSetTeamSeats,
  dismissTeamSeatGap,
  fetchTeamAuditLog,
  type TeamDetail,
} from '@/lib/api/teams';
import { BillingTab } from '@/components/teams/tabs/BillingTab';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const subscription = (over: Partial<NonNullable<TeamDetail['subscription']>> = {}) => ({
  id: 'sub1',
  status: 'active',
  seats: 14,
  paidSeats: 14,
  amount: 180,
  currency: 'USD',
  plan: 'Enterprise',
  interval: 'yearly',
  expiry: '2027-03-14T00:00:00.000Z',
  ...over,
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function setup(props: Partial<React.ComponentProps<typeof BillingTab>> = {}, onChanged = vi.fn()) {
  return wrap(
    <BillingTab
      teamId="tm1"
      processor="PADDLE"
      subscription={subscription()}
      seatGap={null}
      isArchived={false}
      onChanged={onChanged}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.mocked(fetchTeamAuditLog).mockResolvedValue({ data: [], total: 0, page: 1, limit: 25 });
  vi.mocked(attachTeamSubscription).mockReset();
  vi.mocked(detachTeamSubscription).mockReset();
  vi.mocked(adminSetTeamSeats).mockReset();
  vi.mocked(dismissTeamSeatGap).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.success).mockReset();
  useAuthStore.setState({ userRole: 'SUPER_ADMIN' as never, authResolved: true });
});

describe('BillingTab — seat-gap panel', () => {
  it("offers Dismiss alert and NEVER a reconcile control, in the cron's own terms", async () => {
    setup({ seatGap: 3 });

    // The cron's own language: headroom the team bought, or a failed
    // processor release — never a bare "mismatch" that implies a fix.
    expect(await screen.findByText(/3 unused seat/i)).toBeInTheDocument();
    expect(screen.getByText(/headroom the team bought/i)).toBeInTheDocument();
    expect(screen.getByText(/failed.*release/i)).toBeInTheDocument();
    expect(screen.getByText(/check before acting/i)).toBeInTheDocument();

    const dismissButton = screen.getByRole('button', { name: /dismiss alert/i });
    expect(dismissButton).toBeInTheDocument();

    // The single most important assertion: no reconcile control anywhere,
    // in any form — a button, a link, or plain text.
    expect(screen.queryByRole('button', { name: /reconcile/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/reconcile/i)).not.toBeInTheDocument();
  });

  it('copy says dismissing changes no seats', async () => {
    setup({ seatGap: 2 });
    await screen.findByText(/2 unused seat/i);
    expect(screen.getByText(/changes no seats/i)).toBeInTheDocument();
  });

  it('renders nothing when there is no gap', () => {
    setup({ seatGap: null });
    expect(screen.queryByText(/unused seat/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dismiss alert/i })).not.toBeInTheDocument();
  });

  it('dismissing calls dismissTeamSeatGap and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(dismissTeamSeatGap).mockResolvedValue({ id: 'tm1', reportedSeatGap: null });
    setup({ seatGap: 2 }, onChanged);
    await screen.findByText(/2 unused seat/i);

    await userEvent.click(screen.getByRole('button', { name: /dismiss alert/i }));

    expect(dismissTeamSeatGap).toHaveBeenCalledWith('tm1');
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('BillingTab — Detach, SuperAdminOnly', () => {
  it('disables Detach for an ADMIN', async () => {
    useAuthStore.setState({ userRole: 'ADMIN' as never, authResolved: true });
    setup();
    const detachButton = await screen.findByRole('button', { name: /detach/i });
    expect(detachButton).toBeDisabled();
  });

  it('leaves Detach enabled for a SUPER_ADMIN', async () => {
    useAuthStore.setState({ userRole: 'SUPER_ADMIN' as never, authResolved: true });
    setup();
    const detachButton = await screen.findByRole('button', { name: /detach/i });
    expect(detachButton).toBeEnabled();
  });
});

describe('BillingTab — seat adjust surfaces the 409 verbatim', () => {
  it('shows the exact usage figure from the API, not a generic toast', async () => {
    const serverMessage = 'That team already has 12 seats in use. Remove members first.';
    vi.mocked(adminSetTeamSeats).mockRejectedValue({
      response: { data: { message: serverMessage } },
    });
    setup();

    await userEvent.click(await screen.findByRole('button', { name: /adjust seats/i }));
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '5');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(toast.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: serverMessage }),
    );
    // Never a generic fallback message when the API gave a real one.
    expect(toast.error).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: 'Unknown error' }),
    );
  });
});

describe('BillingTab — currency is never mislabelled', () => {
  it('renders a non-USD amount in its own currency, never as USD', async () => {
    setup({ subscription: subscription({ amount: 180, currency: 'NGN', paidSeats: 25 }) });

    expect((await screen.findAllByText(/NGN/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/USD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$180/)).not.toBeInTheDocument();
  });
});

describe('BillingTab — subscription card', () => {
  it('shows status, processor, per-seat price, billed seats and subscription id', async () => {
    setup();
    expect(await screen.findByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/PADDLE/i)).toBeInTheDocument();
    expect(screen.getByText('sub1')).toBeInTheDocument();
    expect(screen.getAllByText(/14/).length).toBeGreaterThan(0);
  });

  it('offers Attach, not Detach, when the team has no subscription', async () => {
    setup({ subscription: null });
    expect(await screen.findByRole('button', { name: /attach/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /detach/i })).not.toBeInTheDocument();
  });

  it('attaching calls the API with subscriptionId and seats, then refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(attachTeamSubscription).mockResolvedValue({} as never);
    setup({ subscription: null }, onChanged);

    await userEvent.click(await screen.findByRole('button', { name: /attach/i }));
    await userEvent.type(screen.getByLabelText(/subscription id/i), 'sub9');
    await userEvent.type(screen.getByLabelText(/seats/i), '10');
    await userEvent.click(screen.getByRole('button', { name: /^attach$/i }));

    expect(attachTeamSubscription).toHaveBeenCalledWith('tm1', 'sub9', 10);
    expect(onChanged).toHaveBeenCalled();
  });

  it('detaching (as super admin) calls the API and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(detachTeamSubscription).mockResolvedValue({} as never);
    setup({}, onChanged);

    await userEvent.click(await screen.findByRole('button', { name: /^detach$/i }));
    await userEvent.click(screen.getByRole('button', { name: /yes, detach/i }));

    expect(detachTeamSubscription).toHaveBeenCalledWith('tm1');
    expect(onChanged).toHaveBeenCalled();
  });

  it('renders the real plan name, billing cycle and renewal date when the API sends them', async () => {
    setup({
      subscription: subscription({
        plan: 'Enterprise',
        interval: 'yearly',
        expiry: '2027-03-14T00:00:00.000Z',
      }),
    });

    expect(await screen.findByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByText('yearly')).toBeInTheDocument();
    expect(screen.getByText('Mar 14, 2027')).toBeInTheDocument();
  });

  it('shows an em dash for plan/cycle/renewal that are genuinely null, never a fabricated default', async () => {
    setup({
      subscription: subscription({ plan: null, interval: null, expiry: null }),
    });

    await screen.findByText(/active/i);
    // One row per field: Plan, Cycle, Renews. All three must be dashes, and
    // a null interval must never render as "Monthly" or any other guess.
    const dashRows = screen.getAllByText('—');
    expect(dashRows.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/monthly/i)).not.toBeInTheDocument();
  });
});
