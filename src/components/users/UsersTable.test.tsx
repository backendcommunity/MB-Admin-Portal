import React from 'react';
import { render, screen } from '@testing-library/react';
import UsersTable from './UsersTable';

vi.mock('@/lib/api/query', () => ({
  useApiQuery: () => ({
    data: {
      data: [{ id: 1, name: 'Test User', email: 't@example.com', role: 'ADMIN', active: true }],
      total: 1,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useApiMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

describe('UsersTable', () => {
  it('renders a user row', () => {
    render(<UsersTable />);
    // DataTable renders both desktop (table) and mobile (card) views simultaneously in jsdom,
    // so the same cell content appears more than once — use getAllByText.
    expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    expect(screen.getAllByText('t@example.com').length).toBeGreaterThan(0);
  });
});
