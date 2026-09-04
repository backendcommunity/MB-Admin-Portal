import React from 'react';
import { render, screen } from '@testing-library/react';
import { UserImportsTable } from '../UserImportsTable';

const IMPORTS = [
  {
    id: 'imp-1',
    uploadedById: 'admin-1',
    filename: 'roster.csv',
    includeActivationVideo: false,
    totalRows: 3,
    created: 1,
    alreadyRegistered: 1,
    skipped: 0,
    failed: 1,
    status: 'COMPLETED',
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
  },
];

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({
      data: { data: IMPORTS, total: 1 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  };
});

describe('UserImportsTable', () => {
  it('lists a past import with its counters and a link to its results', () => {
    render(<UserImportsTable />);

    // DataTable renders both a desktop table row and a mobile card for the
    // same data, so this content appears more than once in the DOM.
    expect(screen.getAllByText('roster.csv').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1/3').length).toBeGreaterThan(0);
    const links = screen.getAllByRole('link', { name: /view/i });
    expect(links[0]).toHaveAttribute('href', '/users/imports/imp-1');
  });
});
