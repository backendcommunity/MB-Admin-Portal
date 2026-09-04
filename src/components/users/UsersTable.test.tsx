import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import UsersTable from './UsersTable';
import { createUserImport } from '@/lib/api/userImports';

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

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api/userImports', () => ({
  createUserImport: vi.fn(),
}));

// UsersTable now also reads `useQueryClient()` (to invalidate ['admin-users']
// after an import), which throws without a real QueryClientProvider in the
// tree — react-query's own context, not the mocked `useQuery` above.
function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UsersTable />
    </QueryClientProvider>,
  );
}

describe('UsersTable', () => {
  it('renders a user row', () => {
    renderTable();
    // DataTable renders desktop and mobile views together in jsdom, so the same
    // content appears more than once.
    expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    expect(screen.getAllByText('t@example.com').length).toBeGreaterThan(0);
  });

  it('shows the derived status and access, not raw columns', () => {
    renderTable();
    expect(screen.getAllByText('active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('premium').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pro Annual').length).toBeGreaterThan(0);
  });

  it('shows the streak against the longest run, for scale', () => {
    renderTable();
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.getAllByText('/ 31').length).toBeGreaterThan(0);
  });

  it('never renders a password field', () => {
    const { container } = renderTable();
    expect(container.textContent).not.toMatch(/password/i);
  });

  it('links to the past-imports results page', () => {
    renderTable();
    const link = screen.getByRole('link', { name: /view imports/i });
    expect(link).toHaveAttribute('href', '/users/imports');
  });

  it("navigates to the new import's results page instead of discarding its id", async () => {
    vi.mocked(createUserImport).mockResolvedValue({
      success: true,
      id: 'imp-42',
      totalRows: 1,
      queued: 1,
      enqueueFailed: 0,
    });

    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /^import users$/i }));

    const textarea = await screen.findByRole('textbox', { name: /roster csv or json/i });
    fireEvent.change(textarea, { target: { value: 'email,name\nada@x.io,Ada\n' } });
    fireEvent.click(await screen.findByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/users/imports/imp-42'));
  });
});
