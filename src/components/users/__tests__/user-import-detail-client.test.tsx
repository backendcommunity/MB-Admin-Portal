import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserImportDetailClient } from '../UserImportDetailClient';
import { retryUserImport } from '@/lib/api/userImports';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'imp-1' }),
}));

const BATCH = {
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
  rows: [
    {
      id: 'row-1',
      importId: 'imp-1',
      name: 'Ada',
      email: 'ada@example.com',
      nameWasDerived: false,
      status: 'CREATED',
      error: null,
      userId: 'u-ada',
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
    {
      id: 'row-2',
      importId: 'imp-1',
      name: 'Grace',
      email: 'grace@example.com',
      nameWasDerived: true,
      status: 'ALREADY_REGISTERED',
      error: null,
      userId: null,
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
    {
      id: 'row-3',
      importId: 'imp-1',
      name: 'Broken',
      email: 'broken@example.com',
      nameWasDerived: false,
      status: 'FAILED',
      error: 'Email enqueue failed: Redis blip',
      userId: 'u-broken',
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
  ],
};

vi.mock('@/lib/api/query', () => ({
  useApiQuery: () => ({ data: BATCH, isLoading: false, isError: false }),
}));

vi.mock('@/lib/api/userImports', () => ({
  retryUserImport: vi.fn(),
}));

function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UserImportDetailClient />
    </QueryClientProvider>,
  );
}

describe('UserImportDetailClient', () => {
  it('shows per-row outcome, including the derived-name flag and the failure reason', () => {
    renderClient();

    expect(screen.getByText('roster.csv')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('grace@example.com')).toBeInTheDocument();
    expect(screen.getByText('derived')).toBeInTheDocument();
    expect(screen.getByText(/Email enqueue failed: Redis blip/)).toBeInTheDocument();

    // Summary cards
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Already registered')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('offers a retry action when there is a failed row, and calls the retry endpoint', async () => {
    renderClient();

    const retryButton = screen.getByRole('button', { name: /retry failed/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);

    await waitFor(() => expect(retryUserImport).toHaveBeenCalledWith('imp-1'));
  });
});
