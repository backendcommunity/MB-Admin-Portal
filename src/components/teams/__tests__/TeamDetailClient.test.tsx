import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'tm1' }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * A Radix `Select` popup hangs jsdom in this repo (see
 * `AssignmentsTab.test.tsx`). Mocked here with a native `<select>` instead —
 * it drives the exact same `onValueChange` prop the real component wires
 * through, without touching Radix's popup/portal machinery.
 */
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

import { fetchTeam, archiveTeam, transferTeam } from '@/lib/api/teams';
import TeamDetailClient from '@/components/teams/TeamDetailClient';
import { useAuthStore } from '@/store/authStore';

const detail = (over = {}) => ({
  id: 'tm1',
  name: 'Kuda Engineering',
  owner: { id: 'u1', name: 'Aisha Bello', email: 'aisha@kuda.com' },
  processor: 'PADDLE',
  subscriptionStatus: 'active',
  seats: {
    subscribed: true,
    paidSeats: 14,
    activeMembers: 11,
    pendingInvites: 1,
    used: 12,
    available: 2,
  },
  seatGap: null,
  archivedAt: null,
  createdAt: '2026-03-14T00:00:00.000Z',
  subscription: {
    id: 'sub1',
    status: 'active',
    seats: 14,
    paidSeats: 14,
    amount: 180,
    currency: 'USD',
  },
  members: [
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
      status: 'REMOVED',
      joinedAt: '2026-03-14T00:00:00.000Z',
      removedAt: '2026-08-01T00:00:00.000Z',
      user: { id: 'u2', name: 'Femi Adigun', email: 'femi@kuda.com', avatar: null },
    },
    {
      id: 'mem3',
      role: 'ADMIN',
      status: 'ACTIVE',
      joinedAt: '2026-04-01T00:00:00.000Z',
      removedAt: null,
      user: { id: 'u3', name: 'Chidi Okonkwo', email: 'chidi@kuda.com', avatar: null },
    },
  ],
  pendingInvites: [],
  ...over,
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(fetchTeam).mockResolvedValue(detail() as never);
  vi.mocked(archiveTeam).mockReset();
  // Archive/Restore are SuperAdminOnly (see archive-restore-role-gate.test.tsx);
  // these tests exercise the archive/restore flow itself, so run as a role
  // that isn't gated out of it.
  useAuthStore.setState({ userRole: 'SUPER_ADMIN' as never, authResolved: true });
});

describe('TeamDetailClient', () => {
  it('renders the team name and seat usage', async () => {
    wrap(<TeamDetailClient />);
    expect((await screen.findAllByText('Kuda Engineering')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/14/).length).toBeGreaterThan(0);
  });

  it('hides removed members until asked', async () => {
    wrap(<TeamDetailClient />);
    await screen.findAllByText('Kuda Engineering');
    await userEvent.click(screen.getByRole('tab', { name: /members/i }));
    expect(screen.queryByText('Femi Adigun')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/show removed/i));
    expect((await screen.findAllByText('Femi Adigun')).length).toBeGreaterThan(0);
  });

  it('requires the exact team name before archiving is enabled', async () => {
    wrap(<TeamDetailClient />);
    await screen.findAllByText('Kuda Engineering');
    await userEvent.click(screen.getByRole('button', { name: /archive team/i }));
    const confirm = screen.getByRole('button', { name: /^archive team$/i, hidden: false });
    const input = screen.getByLabelText(/type the team name/i);
    await userEvent.type(input, 'Kuda');
    expect(confirm).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, 'Kuda Engineering');
    expect(confirm).toBeEnabled();
  });

  it('shows a restore action instead of archive when already archived', async () => {
    vi.mocked(fetchTeam).mockResolvedValue(
      detail({ archivedAt: '2026-09-01T00:00:00.000Z' }) as never,
    );
    wrap(<TeamDetailClient />);
    expect(await screen.findByRole('button', { name: /restore/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /archive team/i })).not.toBeInTheDocument();
  });

  describe('seat-gap banner', () => {
    it('never shows the destructive "mismatch"/"discrepancy"/"reconcile" banner on any tab — Billing owns that surface', async () => {
      vi.mocked(fetchTeam).mockResolvedValue(detail({ seatGap: 2 }) as never);
      wrap(<TeamDetailClient />);
      await screen.findAllByText('Kuda Engineering');

      for (const [tabId] of [
        ['overview'],
        ['members'],
        ['invites'],
        ['groups'],
        ['assignments'],
        ['paths'],
        ['billing'],
        ['reports'],
      ] as const) {
        await userEvent.click(screen.getByRole('tab', { name: new RegExp(tabId, 'i') }));
        expect(screen.queryByText(/mismatch/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/discrepancy/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/reconcile/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /reconcile/i })).not.toBeInTheDocument();
      }
    });

    it('never renders a destructive (role=alert) banner from the shell itself when there is a seat gap', async () => {
      vi.mocked(fetchTeam).mockResolvedValue(detail({ seatGap: 2 }) as never);
      wrap(<TeamDetailClient />);
      await screen.findAllByText('Kuda Engineering');
      // Billing's own alert only mounts on the Billing tab, so on Overview
      // (the default tab) any `role="alert"` must not carry destructive
      // seat-gap wording.
      const alerts = screen.queryAllByRole('alert');
      for (const alert of alerts) {
        expect(alert.textContent ?? '').not.toMatch(/mismatch|discrepancy|reconcile/i);
      }
    });
  });

  describe('ownership transfer (Overview tab)', () => {
    it('offers a Transfer control on Overview, next to the owner', async () => {
      wrap(<TeamDetailClient />);
      await screen.findAllByText('Kuda Engineering');
      expect(screen.getByRole('button', { name: /transfer/i })).toBeInTheDocument();
    });

    it('transfers ownership to a chosen active member and confirms the outgoing owner becomes ADMIN', async () => {
      const onSuccessDetail = detail({
        owner: { id: 'u3', name: 'Chidi Okonkwo', email: 'chidi@kuda.com' },
      });
      vi.mocked(transferTeam).mockResolvedValue(onSuccessDetail as never);
      wrap(<TeamDetailClient />);
      await screen.findAllByText('Kuda Engineering');

      await userEvent.click(screen.getByRole('button', { name: /transfer/i }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/becomes admin/i)).toBeInTheDocument();

      const picker = within(dialog).getByRole('combobox');
      await userEvent.selectOptions(picker, 'u3');
      await userEvent.click(within(dialog).getByRole('button', { name: /^transfer$/i }));

      expect(transferTeam).toHaveBeenCalledWith('tm1', 'u3');
    });

    it('never offers the removed member as a transfer target', async () => {
      wrap(<TeamDetailClient />);
      await screen.findAllByText('Kuda Engineering');
      await userEvent.click(screen.getByRole('button', { name: /transfer/i }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).queryByText('Femi Adigun')).not.toBeInTheDocument();
    });
  });
});
