/**
 * `BootcampsTable` reads `queryKey: ['admin-bootcamps', params]`, but the
 * query client's default `staleTime` is 60s (`createQueryClient` in
 * lib/api/query.ts), and nothing invalidated that key after a create — so a
 * newly created bootcamp stayed missing from the table until the cache
 * expired or the page was hard-reloaded, even though the API's admin list
 * is not server-cached at all. This is purely the client serving a stale
 * TanStack Query cache.
 *
 * Fix: invalidate `['admin-bootcamps']` right after `createBootcamp`
 * succeeds, so an active table refetches immediately rather than waiting
 * out the staleTime.
 *
 * Verified black-box: with the table mounted throughout (as it is when
 * `startDraft` fires before the route push), a successful invalidate on an
 * active query causes an immediate second `fetchBootcamps` call. No
 * invalidation means `fetchBootcamps` is only ever called once.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import BootcampsTable from '../BootcampsTable';
import type { Bootcamp } from '@/lib/api/bootcamps';

const fetchBootcamps = vi.fn();
const createBootcamp = vi.fn();

vi.mock('@/lib/api/bootcamps', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/bootcamps')>('@/lib/api/bootcamps');
  return {
    ...actual,
    fetchBootcamps: (...args: unknown[]) => fetchBootcamps(...args),
    createBootcamp: (...args: unknown[]) => createBootcamp(...args),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const bootcamp = (overrides: Partial<Bootcamp> = {}): Bootcamp => ({
  id: 'b1',
  title: 'Node Backend',
  slug: 'node-backend',
  summary: 'Learn Node.',
  banner: '',
  level: 'Beginner',
  topics: [],
  ...overrides,
});

function renderTable() {
  // Same defaults as the real app's client (lib/api/query.ts): a 60s
  // staleTime is exactly what makes a missing invalidation invisible in a
  // quick manual check but real in production.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60000 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BootcampsTable />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchBootcamps.mockResolvedValue({ data: [bootcamp()], total: 1, page: 1, limit: 50 });
  createBootcamp.mockResolvedValue(bootcamp({ id: 'b2', title: 'Untitled bootcamp' }));
});

describe('BootcampsTable — list refresh after create', () => {
  it('refetches the list immediately after creating a bootcamp', async () => {
    renderTable();

    await screen.findAllByText('Node Backend');
    expect(fetchBootcamps).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /new bootcamp/i }));

    await waitFor(() => expect(createBootcamp).toHaveBeenCalled());
    // A 60s-fresh query only refetches this fast if something invalidated it.
    await waitFor(() => expect(fetchBootcamps).toHaveBeenCalledTimes(2));
  });
});
