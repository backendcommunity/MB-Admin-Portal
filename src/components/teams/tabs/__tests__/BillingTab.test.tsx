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
    recordManualTeamPayment: vi.fn(),
    updateManualTeamPayment: vi.fn(),
    compTeam: vi.fn(),
    uncompTeam: vi.fn(),
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  attachTeamSubscription,
  detachTeamSubscription,
  adminSetTeamSeats,
  dismissTeamSeatGap,
  fetchTeamAuditLog,
  recordManualTeamPayment,
  updateManualTeamPayment,
  compTeam,
  uncompTeam,
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
      comped={false}
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
  vi.mocked(recordManualTeamPayment).mockReset();
  vi.mocked(updateManualTeamPayment).mockReset();
  vi.mocked(compTeam).mockReset();
  vi.mocked(uncompTeam).mockReset();
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

// Detach moved from requireSuperAdmin to requireStrictAdmin on the API (no
// SUPER_ADMIN account exists in the database, so the super-admin tier made
// it unreachable by anyone). The SuperAdminOnly wrapper that used to disable
// this control for an ADMIN is gone: the whole /teams/[id] page is already
// gated to ADMIN/SUPER_ADMIN by ProtectedPage, so both roles should see it
// enabled. The confirm-before-detach dialog is unaffected — a role gate and
// a safety gate are different things.
describe('BillingTab — Detach, requireStrictAdmin', () => {
  it('leaves Detach enabled for an ADMIN', async () => {
    useAuthStore.setState({ userRole: 'ADMIN' as never, authResolved: true });
    setup();
    const detachButton = await screen.findByRole('button', { name: /detach/i });
    expect(detachButton).toBeEnabled();
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

describe('BillingTab — manual (bank-transfer) payments', () => {
  it('renders a MANUAL subscription as manual with its expiry, never as "No subscription" or the raw processor name', async () => {
    setup({
      processor: 'MANUAL',
      subscription: subscription({ expiry: '2027-03-14T00:00:00.000Z' }),
    });

    expect((await screen.findAllByText(/paid manually/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/no subscription/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Mar 14, 2027/).length).toBeGreaterThan(0);
  });

  it('a team with no subscription offers "Record manual payment"', async () => {
    setup({ subscription: null });
    expect(
      await screen.findByRole('button', { name: /record manual payment/i }),
    ).toBeInTheDocument();
  });

  it('recording a manual payment calls recordManualTeamPayment with seats + expiry and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(recordManualTeamPayment).mockResolvedValue({} as never);
    setup({ subscription: null }, onChanged);

    await userEvent.click(await screen.findByRole('button', { name: /record manual payment/i }));
    const seatsInput = screen.getByLabelText(/^seats/i);
    await userEvent.clear(seatsInput);
    await userEvent.type(seatsInput, '10');
    const expiryInput = screen.getByLabelText(/expiry/i) as HTMLInputElement;
    expect(expiryInput.value).not.toBe('');
    await userEvent.click(screen.getByRole('button', { name: /record payment/i }));

    expect(recordManualTeamPayment).toHaveBeenCalledWith(
      'tm1',
      expect.objectContaining({ seats: 10, expiry: expect.any(String) }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('extending a MANUAL subscription calls updateManualTeamPayment and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(updateManualTeamPayment).mockResolvedValue({} as never);
    setup({ processor: 'MANUAL', subscription: subscription() }, onChanged);

    await userEvent.click(await screen.findByRole('button', { name: /extend|renew/i }));
    await userEvent.click(screen.getByRole('button', { name: /extend/i }));

    expect(updateManualTeamPayment).toHaveBeenCalledWith('tm1', expect.any(Object));
    expect(onChanged).toHaveBeenCalled();
  });

  it('surfaces the 409 message verbatim when a manual payment cannot be recorded', async () => {
    const serverMessage = 'This team already has a subscription attached. Detach it first.';
    vi.mocked(recordManualTeamPayment).mockRejectedValue({
      response: { data: { message: serverMessage } },
    });
    setup({ subscription: null });

    await userEvent.click(await screen.findByRole('button', { name: /record manual payment/i }));
    const seatsInput = screen.getByLabelText(/^seats/i);
    await userEvent.clear(seatsInput);
    await userEvent.type(seatsInput, '10');
    await userEvent.click(screen.getByRole('button', { name: /record payment/i }));

    expect(toast.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: serverMessage }),
    );
  });

  it('never labels a non-USD manual-subscription amount as USD', async () => {
    setup({
      processor: 'MANUAL',
      subscription: subscription({ amount: 500, currency: 'NGN', paidSeats: 10 }),
    });
    expect((await screen.findAllByText(/NGN/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/USD/)).not.toBeInTheDocument();
  });
});

describe('BillingTab — access state (comp)', () => {
  it('shows the comped state and offers Remove comp, with a plain revoke warning', async () => {
    setup({ comped: true, subscription: null, processor: null });

    expect(await screen.findByText(/comped/i)).toBeInTheDocument();
    expect(screen.getByText(/every active member has pro/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove comp/i })).toBeInTheDocument();
    expect(
      screen.getByText(/revokes pro for every member unless a subscription is attached/i),
    ).toBeInTheDocument();
  });

  it('a team with neither a comp nor a subscription states plainly that members have no Pro access, and offers Comp this team', async () => {
    setup({ comped: false, subscription: null, processor: null });

    expect(await screen.findByText(/no pro access/i)).toBeInTheDocument();
    const compButton = screen.getByRole('button', { name: /comp this team/i });
    expect(compButton).toBeEnabled();
  });

  it('a team with an entitling subscription has the comp control disabled, with the reason shown', async () => {
    setup({ comped: false, subscription: subscription({ status: 'active' }), processor: 'PADDLE' });

    const compButton = await screen.findByRole('button', { name: /comp this team/i });
    expect(compButton).toBeDisabled();
    expect(screen.getByText(/redundant/i)).toBeInTheDocument();
  });

  it('a team with a lapsed (non-entitling) subscription is treated as no-Pro-access, and the comp control is enabled', async () => {
    setup({
      comped: false,
      subscription: subscription({ status: 'canceled' }),
      processor: 'PADDLE',
    });

    expect(await screen.findByText(/no pro access/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /comp this team/i })).toBeEnabled();
  });

  it('comping a team calls compTeam and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(compTeam).mockResolvedValue({} as never);
    setup({ comped: false, subscription: null, processor: null }, onChanged);

    await userEvent.click(await screen.findByRole('button', { name: /comp this team/i }));

    expect(compTeam).toHaveBeenCalledWith('tm1');
    expect(onChanged).toHaveBeenCalled();
  });

  it('removing a comp asks for confirmation, then calls uncompTeam and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(uncompTeam).mockResolvedValue({} as never);
    setup({ comped: true, subscription: null, processor: null }, onChanged);

    await userEvent.click(await screen.findByRole('button', { name: /remove comp/i }));
    await userEvent.click(screen.getByRole('button', { name: /yes, remove comp/i }));

    expect(uncompTeam).toHaveBeenCalledWith('tm1');
    expect(onChanged).toHaveBeenCalled();
  });

  it('surfaces the comp 409 verbatim when it fails', async () => {
    const serverMessage =
      'This team already has an active subscription. Comping it would be redundant and would mask the real billing state.';
    vi.mocked(compTeam).mockRejectedValue({ response: { data: { message: serverMessage } } });
    setup({ comped: false, subscription: null, processor: null });

    await userEvent.click(await screen.findByRole('button', { name: /comp this team/i }));

    expect(toast.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: serverMessage }),
    );
  });
});
