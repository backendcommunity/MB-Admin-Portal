import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/api/teams');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { setTeamMemberRole, removeTeamMember } from '@/lib/api/teams';
import { MembersTab } from '@/components/teams/tabs/MembersTab';
import type { TeamMemberRow } from '@/lib/api/teams';

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
  {
    id: 'mem3',
    role: 'MEMBER',
    status: 'REMOVED',
    joinedAt: '2026-03-14T00:00:00.000Z',
    removedAt: '2026-08-01T00:00:00.000Z',
    user: { id: 'u3', name: 'Femi Adigun', email: 'femi@kuda.com', avatar: null },
  },
];

function setup(onChanged = vi.fn()) {
  return render(
    <MembersTab teamId="tm1" members={members} isArchived={false} onChanged={onChanged} />,
  );
}

beforeEach(() => {
  vi.mocked(setTeamMemberRole).mockReset();
  vi.mocked(removeTeamMember).mockReset();
});

describe('MembersTab', () => {
  it('renders the active roster', () => {
    setup();
    expect(screen.getAllByText('Aisha Bello').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Chidi Okonkwo').length).toBeGreaterThan(0);
  });

  it('hides removed members until the toggle is checked', async () => {
    setup();
    expect(screen.queryByText('Femi Adigun')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/show removed/i));
    expect(screen.getAllByText('Femi Adigun').length).toBeGreaterThan(0);
  });

  it('calls setTeamMemberRole when a role change is saved', async () => {
    const onChanged = vi.fn();
    vi.mocked(setTeamMemberRole).mockResolvedValue({ id: 'mem2', role: 'ADMIN' });
    setup(onChanged);

    const roleButtons = screen.getAllByRole('button', { name: 'Role' });
    await userEvent.click(roleButtons[0]!);

    const adminOption = screen.getByRole('button', { name: 'ADMIN' });
    await userEvent.click(adminOption);
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(setTeamMemberRole).toHaveBeenCalledWith('tm1', 'mem2', 'ADMIN');
    expect(onChanged).toHaveBeenCalled();
  });

  it('never offers Role or Remove for the OWNER row — the API 409s both', () => {
    setup();
    // Exactly one active non-owner member (Chidi) exists. DataTable renders
    // a desktop table AND a mobile card list from the same column defs, so
    // each real row's controls appear twice (2, not 1) — with none at all
    // for Aisha (OWNER).
    expect(screen.getAllByRole('button', { name: 'Role' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
  });

  it('removing a member calls the API after confirming, naming the person', async () => {
    const onChanged = vi.fn();
    vi.mocked(removeTeamMember).mockResolvedValue({ id: 'mem2' });
    setup(onChanged);

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await userEvent.click(removeButtons[0]!);

    expect(screen.getByText(/remove chidi okonkwo from the team/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(removeTeamMember).toHaveBeenCalledWith('tm1', 'mem2');
    expect(onChanged).toHaveBeenCalled();
  });
});
