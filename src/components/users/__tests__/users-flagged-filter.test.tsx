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
