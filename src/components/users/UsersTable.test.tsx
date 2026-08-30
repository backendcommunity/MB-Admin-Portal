import React from 'react';
import { render, screen } from '@testing-library/react';

import UsersTable from './UsersTable';

const row = {
  id: 'u1',
  name: 'Test User',
  email: 't@example.com',
  username: 'testu',
  avatar: '',
  role: 'ADMIN',
  status: 'active',
  access: 'premium',
  isPremium: true,
  isTrial: false,
  emailConfirmed: true,
  plan: 'Pro Annual',
  points: 2480,
  level: 7,
  currentStreak: 12,
  longestStreak: 31,
  signedUpThrough: 'GOOGLE',
  createdAt: '2026-02-14T00:00:00.000Z',
  lastActivityAt: '2026-08-29T00:00:00.000Z',
  suspendedAt: null,
  deletedAt: null,
};

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({
      data: { data: [row], total: 1 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('UsersTable', () => {
  it('renders a user row', () => {
    render(<UsersTable />);
    // DataTable renders desktop and mobile views together in jsdom, so the same
    // content appears more than once.
    expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    expect(screen.getAllByText('t@example.com').length).toBeGreaterThan(0);
  });

  it('shows the derived status and access, not raw columns', () => {
    render(<UsersTable />);
    expect(screen.getAllByText('active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('premium').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pro Annual').length).toBeGreaterThan(0);
  });

  it('shows the streak against the longest run, for scale', () => {
    render(<UsersTable />);
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.getAllByText('/ 31').length).toBeGreaterThan(0);
  });

  it('never renders a password field', () => {
    const { container } = render(<UsersTable />);
    expect(container.textContent).not.toMatch(/password/i);
  });
});
