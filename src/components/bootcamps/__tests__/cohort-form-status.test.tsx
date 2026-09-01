/**
 * `CohortFormDialog` defaulted `status: 'OPEN'` and always sent it. The
 * pricing strip added for instructors (cohort-form-pricing.test.tsx) doesn't
 * cover `status` — it isn't a pricing field — so a non-staff caller's create
 * still 403'd: the API's `assertMayPublish(req, body, "status", "OPEN")`
 * refuses ANY payload where `status === 'OPEN'` from a non-staff caller,
 * not just a change to it (unlike the pricing guard, an unchanged resend of
 * an already-open cohort still 403s).
 *
 * Fix: a non-staff caller never sends `status` on create (the API forces
 * CLOSED for them, so the form doesn't even show the control). On edit,
 * they may set any status except OPEN — the selector stays visible with
 * OPEN disabled and a reason, rather than silently 403ing if they pick it,
 * and a save that leaves an already-open cohort's status untouched omits
 * the key entirely rather than resending the one value the API refuses.
 *
 * Note: these tests deliberately never open the Radix `Select` dropdown —
 * doing so hangs jsdom in this repo's test environment (no ResizeObserver
 * polyfill), which no other test in the codebase does either. The
 * OPEN-disabled reason is asserted as a static caption instead, which is
 * rendered outside the dropdown regardless of open state.
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

describe('CohortFormDialog — status on create', () => {
  it('never sends status when an instructor creates a cohort', async () => {
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
    expect('status' in payload).toBe(false);
  });

  it('does not offer a status selector on create for an instructor', () => {
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

    expect(screen.queryByRole('combobox', { name: /status/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeDisabled();
    expect(screen.getByLabelText(/status/i)).toHaveValue('CLOSED');
    expect(screen.getByText(/new cohorts start closed/i)).toBeInTheDocument();
  });

  it('still defaults to OPEN and sends status when an admin creates a cohort', async () => {
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

    expect(screen.getByRole('combobox', { name: /status/i })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/name/i), 'Cohort 2');
    await userEvent.type(screen.getByLabelText(/starts/i), '2026-03-01');
    await userEvent.click(screen.getByRole('button', { name: /create cohort/i }));

    await waitFor(() => expect(createCohort).toHaveBeenCalled());
    const [, payload] = createCohort.mock.calls[0];
    expect(payload.status).toBe('OPEN');
  });
});

describe('CohortFormDialog — status on edit', () => {
  it('omits status entirely when an instructor saves an untouched, already-open cohort', async () => {
    asRole('INSTRUCTOR');
    render(
      <CohortFormDialog
        open
        bootcampId="b1"
        cohort={cohort({ status: 'OPEN' })}
        onOpenChange={() => {}}
        onSaved={() => {}}
      />,
    );

    // A title-only edit — status is never touched. Resending the stored
    // 'OPEN' unchanged would still 403 (assertMayPublish doesn't special-case
    // no-ops the way the pricing guard does), so the fix must drop the key.
    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Cohort 1 Renamed');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateCohort).toHaveBeenCalled());
    const [, payload] = updateCohort.mock.calls[0];
    expect(payload.name).toBe('Cohort 1 Renamed');
    expect('status' in payload).toBe(false);
  });

  it('sends a non-OPEN status unchanged when an instructor edits an already-closed cohort', async () => {
    asRole('INSTRUCTOR');
    render(
      <CohortFormDialog
        open
        bootcampId="b1"
        cohort={cohort({ status: 'STARTED' })}
        onOpenChange={() => {}}
        onSaved={() => {}}
      />,
    );

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Cohort 1 Renamed');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateCohort).toHaveBeenCalled());
    const [, payload] = updateCohort.mock.calls[0];
    expect(payload.status).toBe('STARTED');
  });

  it('shows the status selector with a reason for an instructor, rather than hiding it', () => {
    asRole('INSTRUCTOR');
    render(
      <CohortFormDialog
        open
        bootcampId="b1"
        cohort={cohort({ status: 'STARTED' })}
        onOpenChange={() => {}}
        onSaved={() => {}}
      />,
    );

    expect(screen.getByRole('combobox', { name: /status/i })).toBeEnabled();
    expect(
      screen.getByText(/only an admin can open a cohort — submit this for approval instead/i),
    ).toBeInTheDocument();
  });

  it('shows no OPEN-restriction reason for an admin', () => {
    asRole('ADMIN');
    render(
      <CohortFormDialog
        open
        bootcampId="b1"
        cohort={cohort({ status: 'STARTED' })}
        onOpenChange={() => {}}
        onSaved={() => {}}
      />,
    );

    expect(screen.queryByText(/only an admin can open a cohort/i)).not.toBeInTheDocument();
  });

  it('still sends OPEN unchanged when an admin edits an already-open cohort', async () => {
    asRole('ADMIN');
    render(
      <CohortFormDialog
        open
        bootcampId="b1"
        cohort={cohort({ status: 'OPEN' })}
        onOpenChange={() => {}}
        onSaved={() => {}}
      />,
    );

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Cohort 1 Renamed');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateCohort).toHaveBeenCalled());
    const [, payload] = updateCohort.mock.calls[0];
    expect(payload.status).toBe('OPEN');
  });
});
