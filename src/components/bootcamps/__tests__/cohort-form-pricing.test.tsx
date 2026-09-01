/**
 * Instructors now get CRUD on their own bootcamps' cohorts. The API's one
 * rule: instructors may not write pricing — it refuses a non-staff payload
 * that merely CONTAINS `amount`, `paddle_price_id`, `asyncpay_plan_id` or
 * `allowsSubscription` at all, regardless of value (`assertMayWriteFields` in
 * the academy repo's field-guard.ts).
 *
 * This form used to send all four unconditionally, ungated, on both create
 * and edit:
 *   - CREATE: no stored row exists yet, so mere presence 403s every time —
 *     instructor cohort creation was dead on arrival.
 *   - EDIT: the API returns `asyncpay_plan_id` as `""` when the stored value
 *     is `null` (`unpad()` in admin/helpers/bootcamp-shape.ts). The form
 *     echoes `""` back, which the guard compares against a stored `null` and
 *     refuses — so a cohort with a Paddle id set and no AsyncPay id 403'd on
 *     a plain title-only edit.
 *
 * Fix (same pattern as the Ship fix, commit faeee54): strip the pricing keys
 * from the outgoing payload entirely for a non-staff caller, on both create
 * and edit, via the shared `stripPricingFields`. Price stays visible but
 * disabled with a reason (`StaffOnly`) — an instructor still benefits from
 * seeing it. `paddle_price_id`, `asyncpay_plan_id` and `allowsSubscription`
 * are payment-processor plumbing an instructor can't act on, so the product
 * call was to remove those three controls entirely rather than show them
 * disabled.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CohortFormDialog from '../CohortFormDialog';
import { useAuthStore } from '@/store/authStore';
import type { Cohort } from '@/lib/api/bootcamps';

const createCohort = vi.fn();
const updateCohort = vi.fn();

vi.mock('@/lib/api/bootcamps', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/bootcamps')>('@/lib/api/bootcamps');
  return {
    ...actual,
    createCohort: (...args: unknown[]) => createCohort(...args),
    updateCohort: (...args: unknown[]) => updateCohort(...args),
  };
});

const cohort = (overrides: Partial<Cohort> = {}): Cohort => ({
  id: 'c1',
  bootcampId: 'b1',
  name: 'Cohort 1',
  duration: 8,
  amount: 50000,
  maxStudent: 30,
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: null,
  status: 'OPEN',
  completed: false,
  studyGroupLink: '',
  paddle_price_id: 'pri_123',
  // The API's real-world wart this fix sidesteps: NULL in the DB comes back
  // as "" from the API's unpad(), not null.
  asyncpay_plan_id: '',
  allowsSubscription: true,
  paymentMethods: ['card'],
  ...overrides,
});

const asRole = (role: string, authResolved = true) =>
  useAuthStore.setState({ userRole: role as never, authResolved });

beforeEach(() => {
  vi.clearAllMocks();
  createCohort.mockResolvedValue(cohort());
  updateCohort.mockResolvedValue(cohort());
});

describe('CohortFormDialog — instructor create payload', () => {
  it('sends none of the pricing keys when an instructor creates a cohort', async () => {
    asRole('INSTRUCTOR');
    render(
      <CohortFormDialog
        open
        bootcampId="b1"
        cohort={null}
        onOpenChange={() => {}}
        onSaved={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText(/name/i), 'Cohort 2');
    await userEvent.type(screen.getByLabelText(/starts/i), '2026-03-01');
    await userEvent.click(screen.getByRole('button', { name: /create cohort/i }));

    await waitFor(() => expect(createCohort).toHaveBeenCalled());
    const [, payload] = createCohort.mock.calls[0];
    expect('amount' in payload).toBe(false);
    expect('paddle_price_id' in payload).toBe(false);
    expect('asyncpay_plan_id' in payload).toBe(false);
    expect('allowsSubscription' in payload).toBe(false);
    expect(payload).toMatchObject({ name: 'Cohort 2' });
  });
});

describe('CohortFormDialog — admin create payload', () => {
  it('still sends the pricing keys, unchanged, when an admin creates a cohort', async () => {
    asRole('ADMIN');
    render(
      <CohortFormDialog
        open
        bootcampId="b1"
        cohort={null}
        onOpenChange={() => {}}
        onSaved={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText(/name/i), 'Cohort 2');
    await userEvent.type(screen.getByLabelText(/starts/i), '2026-03-01');
    await userEvent.click(screen.getByRole('button', { name: /create cohort/i }));

    await waitFor(() => expect(createCohort).toHaveBeenCalled());
    const [, payload] = createCohort.mock.calls[0];
    expect(payload).toMatchObject({ amount: 0, paddle_price_id: '', asyncpay_plan_id: '' });
    expect('allowsSubscription' in payload).toBe(true);
  });
});

describe('CohortFormDialog — instructor edit payload', () => {
  it('saves a title-only edit without any pricing key, even with a Paddle id set and no AsyncPay id', async () => {
    asRole('INSTRUCTOR');
    render(
      <CohortFormDialog
        open
        bootcampId="b1"
        cohort={cohort()}
        onOpenChange={() => {}}
        onSaved={() => {}}
      />,
    );

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Cohort 1 Renamed');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateCohort).toHaveBeenCalled());
    const [id, payload] = updateCohort.mock.calls[0];
    expect(id).toBe('c1');
    expect(payload.name).toBe('Cohort 1 Renamed');
    expect('amount' in payload).toBe(false);
    expect('paddle_price_id' in payload).toBe(false);
    expect('asyncpay_plan_id' in payload).toBe(false);
    expect('allowsSubscription' in payload).toBe(false);
  });
});

describe('CohortFormDialog — pricing input gating', () => {
  it('disables Price for an instructor, with a reason, but removes the Paddle/AsyncPay/subscription controls entirely', async () => {
    asRole('INSTRUCTOR');
    render(
      <CohortFormDialog
        open
        bootcampId="b1"
        cohort={null}
        onOpenChange={() => {}}
        onSaved={() => {}}
      />,
    );

    // Price stays visible-but-disabled: it's business-relevant info an
    // instructor still benefits from seeing, even though they can't set it.
    expect(screen.getByLabelText(/^price$/i)).toBeDisabled();
    expect(screen.getByText(/only an admin can set the price/i)).toBeInTheDocument();

    // Paddle/AsyncPay ids and the subscription flag are payment-processor
    // plumbing an instructor can't act on — the product call was to remove
    // them outright rather than show an inert disabled control.
    expect(screen.queryByLabelText(/paddle price id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/asyncpay plan id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/allows subscription/i)).not.toBeInTheDocument();
  });

  it('leaves the pricing inputs enabled for an admin', async () => {
    asRole('ADMIN');
    render(
      <CohortFormDialog
        open
        bootcampId="b1"
        cohort={null}
        onOpenChange={() => {}}
        onSaved={() => {}}
      />,
    );

    expect(screen.getByLabelText(/^price$/i)).toBeEnabled();
    expect(screen.getByLabelText(/paddle price id/i)).toBeEnabled();
    expect(screen.getByLabelText(/asyncpay plan id/i)).toBeEnabled();
    expect(screen.getByLabelText(/allows subscription/i)).toBeEnabled();
  });
});
