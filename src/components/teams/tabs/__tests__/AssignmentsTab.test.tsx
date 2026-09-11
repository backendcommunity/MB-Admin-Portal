/**
 * A Radix `Select` popup hangs jsdom in this repo (see
 * `ItemDrawer-grader-switch.test.tsx`). `@/components/ui/select` is mocked
 * here with a native `<select>` instead — it drives the exact same
 * `onValueChange` prop the real component wires through, without touching
 * Radix's popup/portal machinery. The mock also threads `SelectTrigger`'s
 * `id` onto the rendered `<select>` so `<Label htmlFor>` association still
 * resolves an accessible name for `getByRole('combobox', { name })`.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/ui/select', () => {
  const SelectItem = ({ children }: { value: string; children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const SelectTrigger = ({ children }: { id?: string; children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  function collect(
    node: React.ReactNode,
    itemsOut: Array<{ value: string; label: React.ReactNode }>,
    idRef: { current: string | undefined },
  ) {
    React.Children.forEach(node, (child) => {
      if (!child || typeof child !== 'object') return;
      const element = child as React.ReactElement;
      if (element.type === SelectItem) {
        const p = element.props as { value: string; children?: React.ReactNode };
        itemsOut.push({ value: p.value, label: p.children });
        return;
      }
      if (element.type === SelectTrigger) {
        const p = element.props as { id?: string };
        if (p.id) idRef.current = p.id;
      }
      const nested = (element.props as { children?: React.ReactNode } | undefined)?.children;
      if (nested) collect(nested, itemsOut, idRef);
    });
  }

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (next: string) => void;
    children: React.ReactNode;
  }) {
    const items: Array<{ value: string; label: React.ReactNode }> = [];
    const idRef = { current: undefined as string | undefined };
    collect(children, items, idRef);
    return React.createElement(
      'select',
      {
        role: 'combobox',
        id: idRef.current,
        value,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange(event.target.value),
      },
      items.map((item) =>
        React.createElement('option', { key: item.value, value: item.value }, item.label),
      ),
    );
  }

  const Passthrough = ({ children }: { children?: React.ReactNode }) => children ?? null;

  return {
    Select,
    SelectItem,
    SelectTrigger,
    SelectContent: Passthrough,
    SelectValue: () => null,
    SelectGroup: Passthrough,
    SelectLabel: Passthrough,
    SelectSeparator: () => null,
    SelectScrollUpButton: () => null,
    SelectScrollDownButton: () => null,
  };
});

import {
  fetchTeamAssignments,
  fetchTeamGroups,
  createTeamAssignment,
  updateTeamAssignment,
  deleteTeamAssignment,
  type TeamAssignmentListRow,
  type TeamGroupRow,
  type TeamMemberRow,
} from '@/lib/api/teams';
import { AssignmentsTab } from '@/components/teams/tabs/AssignmentsTab';

const groups: TeamGroupRow[] = [
  { id: 'g1', name: 'Platform', memberCount: 6, createdAt: '2026-03-01T00:00:00.000Z' },
];

const members: TeamMemberRow[] = [
  {
    id: 'mem1',
    role: 'OWNER',
    status: 'ACTIVE',
    joinedAt: '2026-03-14T00:00:00.000Z',
    removedAt: null,
    user: { id: 'u1', name: 'Aisha Bello', email: 'aisha@kuda.com', avatar: null },
  },
  {
    id: 'mem2',
    role: 'MEMBER',
    status: 'ACTIVE',
    joinedAt: '2026-04-01T00:00:00.000Z',
    removedAt: null,
    user: { id: 'u2', name: 'Chidi Okonkwo', email: 'chidi@kuda.com', avatar: null },
  },
];

function assignment(over: Partial<TeamAssignmentListRow> = {}): TeamAssignmentListRow {
  return {
    id: 'as1',
    name: 'Week 1',
    dueAt: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    targetType: 'TEAM',
    targetGroupId: null,
    targetTeamMemberId: null,
    targetLabel: 'Everyone',
    itemCount: 3,
    audienceSize: 8,
    doneCount: 2,
    isOverdue: false,
    ...over,
  };
}

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function setup(isArchived = false, onChanged = vi.fn()) {
  return wrap(
    <AssignmentsTab teamId="tm1" members={members} isArchived={isArchived} onChanged={onChanged} />,
  );
}

beforeEach(() => {
  vi.mocked(fetchTeamAssignments).mockResolvedValue([
    assignment({ id: 'as1', name: 'Week 1', targetType: 'TEAM', targetLabel: 'Everyone' }),
    assignment({
      id: 'as2',
      name: 'Platform onboarding',
      targetType: 'GROUP',
      targetGroupId: 'g1',
      targetLabel: 'Platform',
    }),
    assignment({
      id: 'as3',
      name: 'Ada catch-up',
      targetType: 'MEMBER',
      targetTeamMemberId: 'mem2',
      targetLabel: 'Chidi Okonkwo',
    }),
  ]);
  vi.mocked(fetchTeamGroups).mockResolvedValue(groups);
  vi.mocked(createTeamAssignment).mockReset();
  vi.mocked(updateTeamAssignment).mockReset();
  vi.mocked(deleteTeamAssignment).mockReset();
});

describe('AssignmentsTab', () => {
  it('renders the assignments list', async () => {
    setup();
    expect((await screen.findAllByText('Week 1')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Platform onboarding')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Ada catch-up')).length).toBeGreaterThan(0);
  });

  it('distinguishes team, group and member audiences', async () => {
    setup();
    await screen.findAllByText('Week 1');
    expect((await screen.findAllByText('Team')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Group')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Member')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Everyone')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Platform')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Chidi Okonkwo')).length).toBeGreaterThan(0);
  });

  it('the create dialog states plainly that it emails the audience', async () => {
    setup();
    await screen.findAllByText('Week 1');
    await userEvent.click(screen.getByRole('button', { name: /new assignment/i }));

    expect(screen.getByText(/emails everyone in the audience/i)).toBeInTheDocument();
  });

  it('creates a team-wide assignment and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(createTeamAssignment).mockResolvedValue({ id: 'as4', name: 'Week 2' });
    setup(false, onChanged);
    await screen.findAllByText('Week 1');

    await userEvent.click(screen.getByRole('button', { name: /new assignment/i }));
    const createDialog = screen.getByRole('dialog');
    await userEvent.type(within(createDialog).getByLabelText(/name/i), 'Week 2');
    await userEvent.click(within(createDialog).getByRole('button', { name: /^create$/i }));

    expect(createTeamAssignment).toHaveBeenCalledWith('tm1', {
      name: 'Week 2',
      dueAt: null,
      targetType: 'TEAM',
      targetGroupId: null,
      targetTeamMemberId: null,
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('creates a group-targeted assignment via the audience picker', async () => {
    vi.mocked(createTeamAssignment).mockResolvedValue({ id: 'as5', name: 'Data kickoff' });
    setup();
    await screen.findAllByText('Week 1');

    await userEvent.click(screen.getByRole('button', { name: /new assignment/i }));
    const createDialog = screen.getByRole('dialog');
    await userEvent.type(within(createDialog).getByLabelText(/name/i), 'Data kickoff');

    const audience = within(createDialog).getByRole('combobox', { name: /audience/i });
    await userEvent.selectOptions(audience, 'GROUP');
    const group = within(createDialog).getByRole('combobox', { name: /group/i });
    await userEvent.selectOptions(group, 'g1');

    await userEvent.click(within(createDialog).getByRole('button', { name: /^create$/i }));

    expect(createTeamAssignment).toHaveBeenCalledWith('tm1', {
      name: 'Data kickoff',
      dueAt: null,
      targetType: 'GROUP',
      targetGroupId: 'g1',
      targetTeamMemberId: null,
    });
  });

  it('renames an assignment', async () => {
    const onChanged = vi.fn();
    vi.mocked(updateTeamAssignment).mockResolvedValue({ id: 'as1', name: 'Week 1 (updated)' });
    setup(false, onChanged);
    await screen.findAllByText('Week 1');

    await userEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0]!);
    const renameDialog = screen.getByRole('dialog');
    const input = within(renameDialog).getByLabelText(/name/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Week 1 (updated)');
    await userEvent.click(within(renameDialog).getByRole('button', { name: /save/i }));

    expect(updateTeamAssignment).toHaveBeenCalledWith('tm1', 'as1', { name: 'Week 1 (updated)' });
    expect(onChanged).toHaveBeenCalled();
  });

  it('retargets an assignment without claiming a new email goes out', async () => {
    const onChanged = vi.fn();
    vi.mocked(updateTeamAssignment).mockResolvedValue({ id: 'as1', name: 'Week 1' });
    setup(false, onChanged);
    await screen.findAllByText('Week 1');

    await userEvent.click(screen.getAllByRole('button', { name: 'Retarget' })[0]!);
    expect(screen.queryByText(/emails everyone/i)).not.toBeInTheDocument();
    const retargetDialog = screen.getByRole('dialog');

    const audience = within(retargetDialog).getByRole('combobox', { name: /audience/i });
    await userEvent.selectOptions(audience, 'GROUP');
    const group = within(retargetDialog).getByRole('combobox', { name: /group/i });
    await userEvent.selectOptions(group, 'g1');
    await userEvent.click(within(retargetDialog).getByRole('button', { name: /save/i }));

    expect(updateTeamAssignment).toHaveBeenCalledWith('tm1', 'as1', {
      targetType: 'GROUP',
      targetGroupId: 'g1',
      targetTeamMemberId: null,
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('deletes an assignment', async () => {
    const onChanged = vi.fn();
    vi.mocked(deleteTeamAssignment).mockResolvedValue({ success: true });
    setup(false, onChanged);
    await screen.findAllByText('Week 1');

    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]!);
    const confirmDialog = screen.getByRole('dialog');
    await userEvent.click(within(confirmDialog).getByRole('button', { name: /^delete$/i }));

    expect(deleteTeamAssignment).toHaveBeenCalledWith('tm1', 'as1');
    expect(onChanged).toHaveBeenCalled();
  });

  it('states plainly that item editing happens in the team app, not here — no link that could be broken', async () => {
    setup();
    await screen.findAllByText('Week 1');
    expect(screen.getByText(/team's own manager, in the team app/i)).toBeInTheDocument();
    // No hyperlink is offered for item editing: a guessed URL (there is no
    // established team-app origin anywhere in this repo's env config) would
    // look like it works and go nowhere — worse than no link at all.
    expect(screen.queryByRole('link', { name: /edit items/i })).not.toBeInTheDocument();
  });

  it('disables writes when the team is archived', async () => {
    setup(true);
    await screen.findAllByText('Week 1');
    expect(screen.getByRole('button', { name: /new assignment/i })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Rename' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Retarget' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Delete' })[0]).toBeDisabled();
  });
});
