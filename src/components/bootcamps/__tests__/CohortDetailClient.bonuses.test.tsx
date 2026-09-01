/**
 * B7 (instructor-authoring-fixes plan): a custom bonus — one with a title and
 * a description but no linked course/resource/video — showed "Nothing
 * chosen" in the Bonuses tab list. `itemTitle` is only ever populated for a
 * LINKED bonus (see BonusDialog.tsx); a custom bonus's title lives in
 * `topic` instead. The list fell back straight to the empty-state label
 * without ever checking `topic`.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import CohortDetailClient from '../CohortDetailClient';
import type { Bonus, CohortDetail } from '@/lib/api/bootcamps';

const cohort: CohortDetail = {
  id: 'c1',
  bootcampId: 'b1',
  name: 'Cohort One',
  duration: 8,
  amount: 0,
  maxStudent: 20,
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: null,
  status: 'CLOSED',
  completed: false,
  studyGroupLink: '',
  paddle_price_id: '',
  asyncpay_plan_id: '',
  allowsSubscription: false,
  paymentMethods: [],
  bonusCount: 2,
  bootcamp: { id: 'b1', title: 'Backend Bootcamp', slug: 'backend' },
  weeks: [],
};

const customBonus: Bonus = {
  id: 'bonus-custom',
  cohortId: 'c1',
  kind: null,
  itemId: '',
  itemTitle: '',
  topic: 'Office Hours',
  summary: 'Live weekly Q&A with the instructor.',
};

const linkedBonus: Bonus = {
  id: 'bonus-linked',
  cohortId: 'c1',
  kind: 'course',
  itemId: 'course-1',
  itemTitle: 'Intro to Node.js',
  topic: 'Bonus module',
  summary: 'A refresher before week 3.',
};

const fetchCohort = vi.fn();
const fetchBonuses = vi.fn();
vi.mock('@/lib/api/bootcamps', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/bootcamps')>('@/lib/api/bootcamps');
  return {
    ...actual,
    fetchCohort: (...args: unknown[]) => fetchCohort(...args),
    fetchBonuses: (...args: unknown[]) => fetchBonuses(...args),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'b1', cohortId: 'c1' }),
}));

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CohortDetailClient />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchCohort.mockResolvedValue(cohort);
  fetchBonuses.mockResolvedValue([customBonus, linkedBonus]);
});

describe('the Bonuses tab list', () => {
  it('shows a custom bonus by its title, not "Nothing chosen"', async () => {
    renderDetail();
    await userEvent.click(await screen.findByRole('tab', { name: /bonuses/i }));
    expect(await screen.findByText('Office Hours')).toBeInTheDocument();
    expect(await screen.findByText('Live weekly Q&A with the instructor.')).toBeInTheDocument();
    expect(screen.queryByText('Nothing chosen')).not.toBeInTheDocument();
  });

  it('still shows the linked item title for a real link, unaffected', async () => {
    renderDetail();
    await userEvent.click(await screen.findByRole('tab', { name: /bonuses/i }));
    expect(await screen.findByText('Intro to Node.js')).toBeInTheDocument();
    // The subtitle keeps combining topic + summary only when it isn't
    // already doing duty as the title.
    expect(screen.getByText('Bonus module · A refresher before week 3.')).toBeInTheDocument();
  });
});
