/**
 * `ApprovalsQueue` holds its own hardcoded list of reviewable kinds — it does
 * NOT derive them from the API response. `MOCK_INTERVIEW` is a kind the
 * backend's `/admin/approvals` endpoint has always been able to return (see
 * academy's `admin/approvals.ts`), but the portal's type filter and its
 * `ApprovalType` union both omitted it, so a submitted mock-interview
 * template was reachable in the "All types" view but could never be
 * filtered to on its own.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const get = vi.fn();
vi.mock('@/lib/api/axios', () => ({
  axiosInstance: { get: (...args: unknown[]) => get(...args) },
}));

import ApprovalsQueue from '@/components/approvals/ApprovalsQueue';

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const item = (over: Partial<any> = {}) => ({
  id: 'mi-1',
  type: 'MOCK_INTERVIEW',
  title: 'Senior Backend Interview',
  status: 'PENDING',
  submittedAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  submittedBy: 'instructor@example.com',
  ...over,
});

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { data: [item()], total: 1, page: 1, limit: 20 } });
});

describe('ApprovalsQueue', () => {
  it('renders a submitted mock-interview template in the queue', async () => {
    wrap(<ApprovalsQueue />);
    expect(await screen.findByText('Senior Backend Interview')).toBeInTheDocument();
    expect(screen.getByText('MOCK_INTERVIEW')).toBeInTheDocument();
  });

  it('offers "Mock Interview" as a type filter, so a submitted template can be isolated', async () => {
    wrap(<ApprovalsQueue />);
    await screen.findByText('Senior Backend Interview');

    // The trigger's inner span carries `pointer-events: none` (Radix's own
    // styling) — the click target is the button that wraps it.
    const trigger = screen.getByText('All types').closest('button');
    expect(trigger).not.toBeNull();
    await userEvent.click(trigger as HTMLButtonElement);

    expect(await screen.findByRole('option', { name: 'Mock Interview' })).toBeInTheDocument();
  });
});
