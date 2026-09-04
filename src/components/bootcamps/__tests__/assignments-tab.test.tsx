/**
 * The queue lived in the sidebar so a reviewer could work every bootcamp at
 * once. On the detail page it is scoped to the one bootcamp being looked at,
 * which is how a reviewer actually arrives at it.
 *
 * The brief for this test rendered `<BootcampDetailClient bootcampId="b1" />`,
 * but the component takes no props — it reads the id itself via
 * `useParams<{ id: string }>()` from `next/navigation` (see
 * BootcampDetailClient.tsx and its sibling UserDetailClient, which do the
 * same). Mocking `next/navigation` instead, the way
 * `src/components/paths/__tests__/topic-switch.test.tsx` does for the
 * equivalent PathDetailClient, is what actually exercises the component.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import BootcampDetailClient from '../BootcampDetailClient';
import type { BootcampDetail } from '@/lib/api/bootcamps';

const bootcamp: BootcampDetail = {
  id: 'b1',
  title: 'Node.js Backend Engineering Bootcamp',
  slug: 'nodejs-backend-engineering',
  summary: 'Build and ship a production Node service, week by week, with a cohort.',
  banner: 'https://example.test/banner.png',
  level: 'Intermediate',
  topics: [],
  cohorts: [],
};

const fetchBootcamp = vi.fn();
vi.mock('@/lib/api/bootcamps', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/bootcamps')>('@/lib/api/bootcamps');
  return {
    ...actual,
    fetchBootcamp: (...args: unknown[]) => fetchBootcamp(...args),
    fetchBootcamps: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 }),
    fetchAssignments: vi.fn().mockResolvedValue({ data: [] }),
    updateBootcamp: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'b1' }),
}));

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BootcampDetailClient />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchBootcamp.mockResolvedValue(bootcamp);
});

describe('the Assignments tab', () => {
  it('appears on the bootcamp detail', async () => {
    renderDetail();
    expect(await screen.findByRole('tab', { name: /assignments/i })).toBeInTheDocument();
  });

  it('does not offer a bootcamp picker, because the bootcamp is already chosen', async () => {
    renderDetail();
    await userEvent.click(await screen.findByRole('tab', { name: /assignments/i }));
    expect(screen.queryByLabelText(/choose a bootcamp/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/filter by bootcamp/i)).not.toBeInTheDocument();
  });
});
