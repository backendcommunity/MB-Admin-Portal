/**
 * Instructors were just given CRUD on their own Ships (Offer). The API's one
 * rule: instructors may not set pricing — it refuses a non-admin payload that
 * CONTAINS `amount` or `isPremium` at all, regardless of value, because
 * `amount: 0` is still setting the price (`assertMayWriteFields` in the
 * academy repo's field-guard.ts).
 *
 * This form used to seed `amount: 0` / `isPremium: false` into every new
 * offer's `formData` and post it whole on create, so an instructor's very
 * first Save 403'd every time — the capability shipped dead. Editing an
 * existing Ship happened to work, because the form echoes stored values back
 * unchanged and the guard lets an unchanged resend through.
 *
 * Fix: omit the pricing keys from the outgoing payload entirely for a
 * non-staff caller (not send them as `undefined` — the guard tests presence
 * via `in`), on both create and edit, and disable the pricing inputs for
 * that caller with a reason so the dead-end is visible instead of silent.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import OffersDashboard from '../OffersDashboard';
import { useAuthStore } from '@/store/authStore';
import type { Offer } from '@/lib/api/offers';

const getOffers = vi.fn();
const createOffer = vi.fn();
const updateOffer = vi.fn();
const deleteOffer = vi.fn();

vi.mock('@/lib/api/offers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/offers')>('@/lib/api/offers');
  return {
    ...actual,
    getOffers: (...args: unknown[]) => getOffers(...args),
    createOffer: (...args: unknown[]) => createOffer(...args),
    updateOffer: (...args: unknown[]) => updateOffer(...args),
    deleteOffer: (...args: unknown[]) => deleteOffer(...args),
  };
});

const offer = (overrides: Partial<Offer> = {}): Offer => ({
  id: 'o1',
  title: 'Backend Fundamentals',
  summary: 'Learn the basics.',
  description: null,
  slug: 'backend-fundamentals',
  isPremium: false,
  isWaiting: false,
  amount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const asRole = (role: string, authResolved = true) =>
  useAuthStore.setState({ userRole: role as never, authResolved });

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OffersDashboard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getOffers.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });
  createOffer.mockResolvedValue(offer());
  updateOffer.mockResolvedValue(offer());
});

describe('OffersDashboard — instructor create payload', () => {
  it('sends no monetisation keys when an instructor creates a Ship', async () => {
    asRole('INSTRUCTOR');
    renderDashboard();

    await userEvent.click(screen.getByRole('button', { name: /add offer/i }));
    await userEvent.type(screen.getByLabelText(/title/i), 'My New Ship');
    await userEvent.type(screen.getByLabelText(/slug/i), 'my-new-ship');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(createOffer).toHaveBeenCalled());
    const payload = createOffer.mock.calls[0][0];
    expect('amount' in payload).toBe(false);
    expect('isPremium' in payload).toBe(false);
    expect(payload).toMatchObject({ title: 'My New Ship', slug: 'my-new-ship' });
  });

  it('still sends the monetisation keys, unchanged, when an admin creates a Ship', async () => {
    asRole('ADMIN');
    renderDashboard();

    await userEvent.click(screen.getByRole('button', { name: /add offer/i }));
    await userEvent.type(screen.getByLabelText(/title/i), 'Priced Ship');
    await userEvent.type(screen.getByLabelText(/slug/i), 'priced-ship');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(createOffer).toHaveBeenCalled());
    const payload = createOffer.mock.calls[0][0];
    expect(payload).toMatchObject({ amount: 0, isPremium: false });
  });
});

describe('OffersDashboard — pricing input gating', () => {
  it('disables the pricing inputs for an instructor, with a reason', async () => {
    asRole('INSTRUCTOR');
    renderDashboard();

    await userEvent.click(screen.getByRole('button', { name: /add offer/i }));

    const amountInput = screen.getByRole('spinbutton');
    expect(amountInput).toBeDisabled();
    expect(screen.getByText(/only an admin can set the price/i)).toBeInTheDocument();

    const premiumSwitch = screen.getByRole('switch');
    expect(premiumSwitch).toBeDisabled();
    expect(screen.getByText(/only an admin can set the premium flag/i)).toBeInTheDocument();
  });

  it('leaves the pricing inputs enabled for an admin', async () => {
    asRole('ADMIN');
    renderDashboard();

    await userEvent.click(screen.getByRole('button', { name: /add offer/i }));

    expect(screen.getByRole('spinbutton')).toBeEnabled();
    expect(screen.getByRole('switch')).toBeEnabled();
  });
});

describe('OffersDashboard — instructor edit payload', () => {
  it('still saves a title-only edit to an instructor’s own Ship', async () => {
    asRole('INSTRUCTOR');
    getOffers.mockResolvedValue({ data: [offer()], total: 1, page: 1, limit: 10 });
    const { container } = renderDashboard();

    await screen.findByText('Backend Fundamentals');
    // The row's Edit button has no accessible name (icon-only) — find it by
    // the lucide icon class it renders instead.
    const editButton = container.querySelector('.lucide-square-pen')?.closest('button');
    expect(editButton).toBeTruthy();
    await userEvent.click(editButton as HTMLButtonElement);

    const titleInput = screen.getByLabelText(/title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Renamed Ship');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateOffer).toHaveBeenCalled());
    const [id, payload] = updateOffer.mock.calls[0];
    expect(id).toBe('o1');
    expect(payload.title).toBe('Renamed Ship');
    expect('amount' in payload).toBe(false);
    expect('isPremium' in payload).toBe(false);
  });
});
