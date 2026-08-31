/**
 * Same defect as CohortFormDialog, one level up: the bulk import replays each
 * cohort as the same `createCohort` call the form makes, and it built that
 * payload unconditionally including `amount`, `paddle_price_id` and
 * `asyncpay_plan_id` — so an instructor importing their own bootcamp hit the
 * API's presence-based pricing guard on the very first cohort every time.
 *
 * Fix: strip the pricing keys from the cohort payload for a non-staff caller
 * via the shared `stripPricingFields`, same as the form.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ImportBootcampModal from '../ImportBootcampModal';
import { useAuthStore } from '@/store/authStore';

const createBootcamp = vi.fn();
const createCohort = vi.fn();

vi.mock('@/lib/api/bootcamps', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/bootcamps')>('@/lib/api/bootcamps');
  return {
    ...actual,
    createBootcamp: (...args: unknown[]) => createBootcamp(...args),
    createCohort: (...args: unknown[]) => createCohort(...args),
  };
});

const asRole = (role: string, authResolved = true) =>
  useAuthStore.setState({ userRole: role as never, authResolved });

const DOC = JSON.stringify({
  title: 'Test Bootcamp',
  level: 'Beginner',
  cohorts: [
    {
      name: 'Cohort A',
      startsAt: '2026-03-01',
      amount: 5000,
      paddle_price_id: 'pri_1',
      asyncpay_plan_id: 'async_1',
      allowsSubscription: true,
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  createBootcamp.mockResolvedValue({ id: 'b1' });
  createCohort.mockResolvedValue({ id: 'c1' });
});

function paste(doc: string) {
  fireEvent.change(screen.getByLabelText(/bootcamp json/i), { target: { value: doc } });
}

describe('ImportBootcampModal — instructor import payload', () => {
  it('sends none of the pricing keys when an instructor imports a cohort', async () => {
    asRole('INSTRUCTOR');
    render(<ImportBootcampModal open onOpenChange={() => {}} onImported={() => {}} />);

    paste(DOC);
    await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(createCohort).toHaveBeenCalled());
    const [, payload] = createCohort.mock.calls[0];
    expect('amount' in payload).toBe(false);
    expect('paddle_price_id' in payload).toBe(false);
    expect('asyncpay_plan_id' in payload).toBe(false);
    expect('allowsSubscription' in payload).toBe(false);
    expect(payload).toMatchObject({ name: 'Cohort A' });
  });
});

describe('ImportBootcampModal — admin import payload', () => {
  it('still sends the pricing keys, unchanged, when an admin imports a cohort', async () => {
    asRole('ADMIN');
    render(<ImportBootcampModal open onOpenChange={() => {}} onImported={() => {}} />);

    paste(DOC);
    await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(createCohort).toHaveBeenCalled());
    const [, payload] = createCohort.mock.calls[0];
    expect(payload).toMatchObject({
      amount: 5000,
      paddle_price_id: 'pri_1',
      asyncpay_plan_id: 'async_1',
      allowsSubscription: true,
    });
  });
});
