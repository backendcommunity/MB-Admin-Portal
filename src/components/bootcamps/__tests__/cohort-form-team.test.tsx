/**
 * Cohort "Programme team" (academy Cohort.teamId): every scholarship buyer of
 * the cohort joins this team, which is what gives them Pro. Staff-only, like
 * pricing — the API's assertMayWriteFields refuses `teamId` from a non-staff
 * caller, so the form must never send it for an instructor.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CohortFormDialog from '../CohortFormDialog';
import { ProgrammeTeamPicker } from '../ProgrammeTeamPicker';
import { useAuthStore } from '@/store/authStore';
import type { Cohort } from '@/lib/api/bootcamps';

const createCohort = vi.fn();
const updateCohort = vi.fn();
const fetchTeams = vi.fn();
const fetchTeam = vi.fn();

vi.mock('@/lib/api/bootcamps', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/bootcamps')>('@/lib/api/bootcamps');
  return {
    ...actual,
    createCohort: (...args: unknown[]) => createCohort(...args),
    updateCohort: (...args: unknown[]) => updateCohort(...args),
  };
});
vi.mock('@/lib/api/teams', () => ({
  fetchTeams: (...args: unknown[]) => fetchTeams(...args),
  fetchTeam: (...args: unknown[]) => fetchTeam(...args),
}));

// Radix Select needs these to open in jsdom.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const COHORT3_TEAM = 'b55d962b-ba81-44ff-89e7-3c924f52c2f1';
const team = (id: string, name: string, comped = true) => ({
  id,
  name,
  comped,
  owner: { id: 'o1', name: 'Owner', email: 'owner@example.com' },
});

const cohort = (overrides: Partial<Cohort> = {}): Cohort => ({
  id: 'c3',
  bootcampId: 'b1',
  name: 'Cohort 3',
  duration: 6,
  amount: 150000,
  maxStudent: 0,
  startsAt: '2026-11-09T00:00:00.000Z',
  endsAt: null,
  status: 'STARTED',
  completed: false,
  studyGroupLink: 'https://chat.whatsapp.com/x',
  paddle_price_id: '',
  asyncpay_plan_id: '',
  allowsSubscription: true,
  paymentMethods: [],
  teamId: '',
  ...overrides,
});

const asRole = (role: string) => useAuthStore.setState({ userRole: role as never, authResolved: true });

beforeEach(() => {
  vi.clearAllMocks();
  createCohort.mockResolvedValue(cohort());
  updateCohort.mockResolvedValue(cohort());
  fetchTeams.mockResolvedValue({
    teams: [team(COHORT3_TEAM, 'AI Engineering Cohort 3'), team('t4', 'AI Engineering Cohort 4', false)],
    total: 2,
    page: 1,
    limit: 20,
  });
  fetchTeam.mockResolvedValue(team(COHORT3_TEAM, 'AI Engineering Cohort 3'));
});

describe('ProgrammeTeamPicker', () => {
  it('makes no request just by rendering with nothing linked', () => {
    render(<ProgrammeTeamPicker value="" onChange={() => {}} />);
    expect(fetchTeams).not.toHaveBeenCalled();
    expect(fetchTeam).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveTextContent('No team');
  });

  it('labels an already linked team by name', async () => {
    render(<ProgrammeTeamPicker value={COHORT3_TEAM} onChange={() => {}} />);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('AI Engineering Cohort 3'));
    expect(fetchTeam).toHaveBeenCalledWith(COHORT3_TEAM);
  });

  it('loads teams on open, then picks one and can clear back to none', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ProgrammeTeamPicker value="" onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(fetchTeams).toHaveBeenCalledWith({ q: '', limit: 20 }));
    await userEvent.click(await screen.findByRole('option', { name: /AI Engineering Cohort 3/ }));
    expect(onChange).toHaveBeenLastCalledWith(COHORT3_TEAM);

    rerender(<ProgrammeTeamPicker value={COHORT3_TEAM} onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'No team' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('searches teams by the typed text', async () => {
    render(<ProgrammeTeamPicker value="" onChange={() => {}} />);
    await userEvent.type(screen.getByLabelText(/search teams/i), 'cohort 4');
    await waitFor(() => expect(fetchTeams).toHaveBeenLastCalledWith({ q: 'cohort 4', limit: 20 }));
  });
});

describe('CohortFormDialog — programme team', () => {
  it('admin edit: sends the linked team id', async () => {
    asRole('ADMIN');
    render(
      <CohortFormDialog open bootcampId="b1" cohort={cohort({ teamId: COHORT3_TEAM })} onOpenChange={() => {}} onSaved={() => {}} />,
    );
    expect(screen.getByLabelText(/programme team/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateCohort).toHaveBeenCalled());
    expect(updateCohort.mock.calls[0][1]).toMatchObject({ teamId: COHORT3_TEAM });
  });

  it('admin create: sends an empty team (none linked) by default', async () => {
    asRole('ADMIN');
    render(<CohortFormDialog open bootcampId="b1" cohort={null} onOpenChange={() => {}} onSaved={() => {}} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Cohort 4');
    await userEvent.type(screen.getByLabelText(/starts/i), '2027-02-01');
    await userEvent.click(screen.getByRole('button', { name: /create cohort/i }));
    await waitFor(() => expect(createCohort).toHaveBeenCalled());
    expect(createCohort.mock.calls[0][1]).toMatchObject({ teamId: '' });
  });

  it('instructor: no picker, and teamId is never sent (create or edit)', async () => {
    asRole('INSTRUCTOR');
    const { unmount } = render(
      <CohortFormDialog open bootcampId="b1" cohort={cohort({ teamId: COHORT3_TEAM })} onOpenChange={() => {}} onSaved={() => {}} />,
    );
    expect(screen.queryByLabelText(/programme team/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateCohort).toHaveBeenCalled());
    expect('teamId' in updateCohort.mock.calls[0][1]).toBe(false);
    unmount();

    render(<CohortFormDialog open bootcampId="b1" cohort={null} onOpenChange={() => {}} onSaved={() => {}} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Cohort 4');
    await userEvent.type(screen.getByLabelText(/starts/i), '2027-02-01');
    await userEvent.click(screen.getByRole('button', { name: /create cohort/i }));
    await waitFor(() => expect(createCohort).toHaveBeenCalled());
    expect('teamId' in createCohort.mock.calls[0][1]).toBe(false);
    expect(fetchTeams).not.toHaveBeenCalled();
  });
});
