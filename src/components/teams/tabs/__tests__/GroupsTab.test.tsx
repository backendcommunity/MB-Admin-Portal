import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  fetchTeamGroups,
  createTeamGroup,
  renameTeamGroup,
  deleteTeamGroup,
  fetchTeamAssignments,
  type TeamGroupRow,
  type TeamAssignmentListRow,
} from '@/lib/api/teams';
import { GroupsTab } from '@/components/teams/tabs/GroupsTab';

const groups: TeamGroupRow[] = [
  { id: 'g1', name: 'Platform', memberCount: 6, createdAt: '2026-03-01T00:00:00.000Z' },
  { id: 'g2', name: 'Data', memberCount: 3, createdAt: '2026-04-05T00:00:00.000Z' },
];

function assignment(over: Partial<TeamAssignmentListRow> = {}): TeamAssignmentListRow {
  return {
    id: 'as1',
    name: 'Week 1',
    dueAt: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    targetType: 'GROUP',
    targetGroupId: 'g1',
    targetTeamMemberId: null,
    targetLabel: 'Platform',
    itemCount: 3,
    audienceSize: 6,
    doneCount: 1,
    isOverdue: false,
    ...over,
  };
}

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function setup(isArchived = false, onChanged = vi.fn()) {
  return wrap(<GroupsTab teamId="tm1" isArchived={isArchived} onChanged={onChanged} />);
}

beforeEach(() => {
  vi.mocked(fetchTeamGroups).mockResolvedValue(groups);
  vi.mocked(fetchTeamAssignments).mockResolvedValue([
    assignment({ id: 'as1', targetGroupId: 'g1' }),
    assignment({ id: 'as2', targetGroupId: 'g1' }),
    assignment({ id: 'as3', targetType: 'TEAM', targetGroupId: null, targetLabel: 'Everyone' }),
  ]);
  vi.mocked(createTeamGroup).mockReset();
  vi.mocked(renameTeamGroup).mockReset();
  vi.mocked(deleteTeamGroup).mockReset();
});

describe('GroupsTab', () => {
  it('renders the groups list with member and assignment counts', async () => {
    setup();
    expect((await screen.findAllByText('Platform')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Data')).length).toBeGreaterThan(0);
    // Platform (g1) is targeted by 2 assignments, Data (g2) by none.
    expect((await screen.findAllByText('2')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('0')).length).toBeGreaterThan(0);
  });

  it('renders a dash, not 0, in the Assignments column when fetchTeamAssignments fails — the groups list still renders', async () => {
    vi.mocked(fetchTeamAssignments).mockRejectedValue(new Error('boom'));
    setup();

    // Groups come from their own query, independent of assignments — the
    // list must never disappear while that query is loading or after it
    // has failed. Mirrors MembersTab's equivalent resilience test for the
    // roster-progress join.
    expect((await screen.findAllByText('Platform')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Data').length).toBeGreaterThan(0);

    await waitFor(() => expect(fetchTeamAssignments).toHaveBeenCalled());

    const platformRow = screen.getAllByText('Platform')[0]!.closest('tr')!;
    const dataRow = screen.getAllByText('Data')[0]!.closest('tr')!;
    expect(within(platformRow).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(platformRow).queryByText('0')).not.toBeInTheDocument();
    expect(within(platformRow).queryByText('2')).not.toBeInTheDocument();
    expect(within(dataRow).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(dataRow).queryByText('0')).not.toBeInTheDocument();
  });

  it('creates a group and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(createTeamGroup).mockResolvedValue({ id: 'g3', name: 'Growth' });
    setup(false, onChanged);
    await screen.findAllByText('Platform');

    await userEvent.click(screen.getByRole('button', { name: /new group/i }));
    const createDialog = screen.getByRole('dialog');
    await userEvent.type(within(createDialog).getByLabelText(/name/i), 'Growth');
    await userEvent.click(within(createDialog).getByRole('button', { name: /^create$/i }));

    expect(createTeamGroup).toHaveBeenCalledWith('tm1', 'Growth');
    expect(onChanged).toHaveBeenCalled();
  });

  it('renames a group and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(renameTeamGroup).mockResolvedValue({ id: 'g1', name: 'Infra' });
    setup(false, onChanged);
    await screen.findAllByText('Platform');

    const renameButtons = screen.getAllByRole('button', { name: 'Rename' });
    await userEvent.click(renameButtons[0]!);
    const renameDialog = screen.getByRole('dialog');
    const input = within(renameDialog).getByLabelText(/name/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Infra');
    await userEvent.click(within(renameDialog).getByRole('button', { name: /save/i }));

    expect(renameTeamGroup).toHaveBeenCalledWith('tm1', 'g1', 'Infra');
    expect(onChanged).toHaveBeenCalled();
  });

  it('names the real consequence of deleting a group: it goes, the people stay', async () => {
    setup();
    await screen.findAllByText('Platform');

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await userEvent.click(deleteButtons[0]!);

    expect(screen.getByText(/stay/i)).toBeInTheDocument();
    expect(screen.getByText(/never removes anyone/i)).toBeInTheDocument();
  });

  it('deleting a group calls the API and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(deleteTeamGroup).mockResolvedValue({ success: true, message: 'Group deleted' });
    setup(false, onChanged);
    await screen.findAllByText('Platform');

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await userEvent.click(deleteButtons[0]!);
    const confirmDialog = screen.getByRole('dialog');
    await userEvent.click(within(confirmDialog).getByRole('button', { name: /^delete$/i }));

    expect(deleteTeamGroup).toHaveBeenCalledWith('tm1', 'g1');
    expect(onChanged).toHaveBeenCalled();
  });

  it('disables writes when the team is archived', async () => {
    setup(true);
    await screen.findAllByText('Platform');
    expect(screen.getByRole('button', { name: /new group/i })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Rename' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Delete' })[0]).toBeDisabled();
  });
});
