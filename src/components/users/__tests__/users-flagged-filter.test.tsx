/**
 * A suspension or a stalled signup is work, not a filter you remember to set —
 * which is why it had its own sidebar entry. As a chip on the list it is still
 * one click, and it stops the sidebar carrying a saved search.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import UsersTable from '../UsersTable';

const flaggedFetch = vi.fn();
const usersFetch = vi.fn();
vi.mock('@/lib/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/users')>('@/lib/api/users');
  return {
    ...actual,
    fetchFlagged: (...args: unknown[]) => flaggedFetch(...args),
    // The regular users query also runs on first mount (before the chip is
    // pressed); stub it too so no real HTTP call escapes into jsdom.
    fetchUsers: (...args: unknown[]) => usersFetch(...args),
  };
});

// UsersTable calls useRouter() unconditionally (row navigation, the "Add
// user" redirect) and now useSearchParams() to seed the flagged toggle from
// the URL; outside a real app router both throw. Same shape the sibling
// UsersTable.test.tsx already uses for useRouter.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UsersTable />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  flaggedFetch.mockResolvedValue({ data: [], total: 0 });
  usersFetch.mockResolvedValue({ data: [], total: 0 });
});

describe('the Needs attention chip', () => {
  it('is offered on the users list', async () => {
    renderTable();
    expect(await screen.findByRole('button', { name: /needs attention/i })).toBeInTheDocument();
  });

  it('switches the query to the flagged endpoint when pressed', async () => {
    renderTable();
    await userEvent.click(await screen.findByRole('button', { name: /needs attention/i }));
    expect(flaggedFetch).toHaveBeenCalled();
  });
});

describe('a flagged row', () => {
  // Folding the standalone flagged-users screen into a chip must not drop
  // WHY an account is flagged — that reason (and the ability to filter by
  // it) was most of what made the old screen useful.
  const flaggedRow = {
    id: 'u9',
    name: 'Stalled Onboarder',
    email: 'stalled@example.com',
    username: 'stalled',
    avatar: '',
    role: 'USER',
    status: 'unverified',
    access: 'free',
    isPremium: false,
    isTrial: false,
    emailConfirmed: false,
    plan: null,
    points: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    signedUpThrough: 'MASTERINGBACKEND',
    createdAt: '2026-02-14T00:00:00.000Z',
    lastActivityAt: '2026-08-29T00:00:00.000Z',
    suspendedAt: null,
    deletedAt: null,
    flags: [{ code: 'unverified', detail: 'Email address never confirmed.' }],
  };

  it('shows its flag reason once the chip is on', async () => {
    flaggedFetch.mockResolvedValue({ data: [flaggedRow], total: 1 });
    renderTable();
    await userEvent.click(await screen.findByRole('button', { name: /needs attention/i }));

    // DataTable renders a desktop table and a mobile card list together in
    // jsdom, so the same content appears more than once.
    expect((await screen.findAllByText('Email address never confirmed.')).length).toBeGreaterThan(
      0,
    );
  });

  it('offers a reason filter once the chip is on', async () => {
    flaggedFetch.mockResolvedValue({ data: [flaggedRow], total: 1 });
    renderTable();
    await userEvent.click(await screen.findByRole('button', { name: /needs attention/i }));

    expect(await screen.findByLabelText(/filter by reason/i)).toBeInTheDocument();
  });
});
