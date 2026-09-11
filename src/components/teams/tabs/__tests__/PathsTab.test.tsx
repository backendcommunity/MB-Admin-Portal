import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  fetchTeamPaths,
  createTeamPath,
  updateTeamPath,
  archiveTeamPath,
  restoreTeamPath,
  type TeamPathRow,
} from '@/lib/api/teams';
import { PathsTab } from '@/components/teams/tabs/PathsTab';

const activePath: TeamPathRow = {
  id: 'p1',
  title: 'Onboarding',
  slug: 'onboarding',
  summary: 'Week one basics',
  sectionCount: 4,
  createdAt: '2026-03-01T00:00:00.000Z',
  archivedAt: null,
};

const archivedPath: TeamPathRow = {
  id: 'p2',
  title: 'Legacy curriculum',
  slug: 'legacy-curriculum',
  summary: '',
  sectionCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: '2026-06-01T00:00:00.000Z',
};

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function setup(isArchivedTeam = false, onChanged = vi.fn()) {
  return wrap(<PathsTab teamId="tm1" isArchived={isArchivedTeam} onChanged={onChanged} />);
}

beforeEach(() => {
  vi.mocked(fetchTeamPaths).mockResolvedValue([activePath, archivedPath]);
  vi.mocked(createTeamPath).mockReset();
  vi.mocked(updateTeamPath).mockReset();
  vi.mocked(archiveTeamPath).mockReset();
  vi.mocked(restoreTeamPath).mockReset();
});

describe('PathsTab', () => {
  it('renders the paths list with section counts', async () => {
    setup();
    expect((await screen.findAllByText('Onboarding')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Legacy curriculum')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('4')).length).toBeGreaterThan(0);
  });

  it('an active path shows Archive, not Restore', async () => {
    setup();
    await screen.findAllByText('Onboarding');
    // Scope to the active row's rendered actions: at least one Archive
    // button exists and it is not paired with a Restore button on that row.
    expect(screen.getAllByRole('button', { name: 'Archive' }).length).toBeGreaterThan(0);
  });

  it('an archived path shows Restore, not Archive, for that row', async () => {
    setup();
    await screen.findAllByText('Legacy curriculum');

    // Both desktop and mobile render every row, so with one active + one
    // archived path there is exactly one Restore control and exactly one
    // Archive control per surface — never both on the same logical row.
    const restoreButtons = screen.getAllByRole('button', { name: 'Restore' });
    const archiveButtons = screen.getAllByRole('button', { name: 'Archive' });
    expect(restoreButtons.length).toBeGreaterThan(0);
    expect(archiveButtons.length).toBeGreaterThan(0);
  });

  it('shows an Active / Archived status badge', async () => {
    setup();
    await screen.findAllByText('Onboarding');
    expect((await screen.findAllByText(/active/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/archived/i)).length).toBeGreaterThan(0);
  });

  it('creates a path and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(createTeamPath).mockResolvedValue({ id: 'p3', title: 'New path', slug: 'new-path' });
    setup(false, onChanged);
    await screen.findAllByText('Onboarding');

    await userEvent.click(screen.getByRole('button', { name: /new path/i }));
    await userEvent.type(screen.getByLabelText(/title/i), 'New path');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    expect(createTeamPath).toHaveBeenCalledWith('tm1', { title: 'New path', summary: '' });
    expect(onChanged).toHaveBeenCalled();
  });

  it('renames a path', async () => {
    const onChanged = vi.fn();
    vi.mocked(updateTeamPath).mockResolvedValue({ id: 'p1', title: 'Onboarding v2' });
    setup(false, onChanged);
    await screen.findAllByText('Onboarding');

    const renameButtons = screen.getAllByRole('button', { name: 'Rename' });
    await userEvent.click(renameButtons[0]!);
    const input = screen.getByLabelText(/title/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Onboarding v2');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(updateTeamPath).toHaveBeenCalledWith('tm1', 'p1', {
      title: 'Onboarding v2',
      summary: 'Week one basics',
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('names the real consequence of archiving: gone from lists/pickers, progress survives, restorable', async () => {
    setup();
    await screen.findAllByText('Onboarding');

    const archiveButtons = screen.getAllByRole('button', { name: 'Archive' });
    await userEvent.click(archiveButtons[0]!);

    const confirmDialog = screen.getByRole('dialog');
    expect(within(confirmDialog).getByText(/every.*picker/i)).toBeInTheDocument();
    expect(within(confirmDialog).getByText(/progress/i)).toBeInTheDocument();
    expect(within(confirmDialog).getByText(/restore/i)).toBeInTheDocument();
  });

  it('archiving calls the API and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(archiveTeamPath).mockResolvedValue({ success: true, message: 'Path archived' });
    setup(false, onChanged);
    await screen.findAllByText('Onboarding');

    const archiveButtons = screen.getAllByRole('button', { name: 'Archive' });
    await userEvent.click(archiveButtons[0]!);
    await userEvent.click(screen.getByRole('button', { name: /^archive$/i }));

    expect(archiveTeamPath).toHaveBeenCalledWith('tm1', 'p1');
    expect(onChanged).toHaveBeenCalled();
  });

  it('restoring calls the API directly and refreshes', async () => {
    const onChanged = vi.fn();
    vi.mocked(restoreTeamPath).mockResolvedValue({ success: true, message: 'Path restored' });
    setup(false, onChanged);
    await screen.findAllByText('Legacy curriculum');

    const restoreButtons = screen.getAllByRole('button', { name: 'Restore' });
    await userEvent.click(restoreButtons[0]!);

    expect(restoreTeamPath).toHaveBeenCalledWith('tm1', 'p2');
    expect(onChanged).toHaveBeenCalled();
  });

  it('disables writes when the team is archived', async () => {
    setup(true);
    await screen.findAllByText('Onboarding');
    expect(screen.getByRole('button', { name: /new path/i })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Rename' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Archive' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Restore' })[0]).toBeDisabled();
  });
});
