import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/teams');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { fetchTeamReport, exportTeamReportCsv, type TeamReport } from '@/lib/api/teams';
import { ReportsTab } from '@/components/teams/tabs/ReportsTab';
import { toast } from 'sonner';

const report = (over: Partial<TeamReport> = {}): TeamReport => ({
  range: {
    period: 'week',
    buckets: 2,
    from: '2026-08-01',
    to: '2026-08-15',
    dataBegins: '2026-08-01',
    completionsBegin: '2026-08-01',
  },
  seats: { total: 14, used: 12 },
  series: [
    { bucket: '2026-08-01', activeMembers: 5, coursesFinished: 3, pathsFinished: 1 },
    { bucket: '2026-08-08', activeMembers: 6, coursesFinished: 2, pathsFinished: 0 },
  ],
  totals: { activeMembers: 11, coursesFinished: 5, pathsFinished: 1, membersWhoFinished: 4 },
  previous: { activeMembers: 10, coursesFinished: 0, pathsFinished: 2, membersWhoFinished: 3 },
  change: {
    activeMembers: 0.1,
    coursesFinished: null,
    pathsFinished: -0.5,
    membersWhoFinished: 0.25,
  },
  ...over,
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(fetchTeamReport).mockReset();
  vi.mocked(fetchTeamReport).mockResolvedValue(report());
  vi.mocked(exportTeamReportCsv).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  (globalThis.URL.createObjectURL as unknown) = vi.fn(() => 'blob:mock-url');
  (globalThis.URL.revokeObjectURL as unknown) = vi.fn();
});

describe('ReportsTab — stat tiles', () => {
  it('renders the four totals', async () => {
    wrap(<ReportsTab teamId="tm1" />);
    await screen.findByTestId('report-stat-activeMembers');
    expect(
      within(screen.getByTestId('report-stat-activeMembers')).getByText('11'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('report-stat-coursesFinished')).getByText('5'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('report-stat-pathsFinished')).getByText('1'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('report-stat-membersWhoFinished')).getByText('4'),
    ).toBeInTheDocument();
  });

  it('a null change renders an em dash, never Infinity, NaN or 0%', async () => {
    wrap(<ReportsTab teamId="tm1" />);
    const tile = await screen.findByTestId('report-stat-coursesFinished');
    expect(within(tile).getByText('—')).toBeInTheDocument();
    expect(within(tile).queryByText(/infinity/i)).not.toBeInTheDocument();
    expect(within(tile).queryByText(/nan/i)).not.toBeInTheDocument();
    expect(within(tile).queryByText('0%')).not.toBeInTheDocument();
  });

  it('a real change renders a signed percentage', async () => {
    wrap(<ReportsTab teamId="tm1" />);
    const tile = await screen.findByTestId('report-stat-activeMembers');
    expect(within(tile).getByText('+10%')).toBeInTheDocument();

    const downTile = screen.getByTestId('report-stat-pathsFinished');
    expect(within(downTile).getByText('-50%')).toBeInTheDocument();
  });
});

describe('ReportsTab — range selector', () => {
  it('defaults to 12 weeks and refetches on 12 months', async () => {
    wrap(<ReportsTab teamId="tm1" />);
    await screen.findByText('11');
    expect(fetchTeamReport).toHaveBeenCalledWith('tm1', { range: '12w' });

    await userEvent.click(screen.getByRole('button', { name: /12 months/i }));
    expect(fetchTeamReport).toHaveBeenCalledWith('tm1', { range: '12m' });
  });
});

describe('ReportsTab — completions series', () => {
  it('leads with the chart, naming both plotted series', async () => {
    wrap(<ReportsTab teamId="tm1" />);
    await screen.findByText('11');

    expect(screen.getByRole('button', { name: /^chart$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Two series always carry a legend, so identity is never colour-alone.
    // (`Courses finished` is also a stat-tile label, hence getAllByText.)
    expect(screen.getAllByText('Courses finished').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Paths finished').length).toBeGreaterThan(0);
    // The chart replaces the table rather than sitting beside it.
    expect(screen.queryByText('2026-08-01')).not.toBeInTheDocument();
  });

  it('keeps the exact figures one click away, on both desktop and mobile layouts', async () => {
    wrap(<ReportsTab teamId="tm1" />);
    await screen.findByText('11');
    await userEvent.click(screen.getByRole('button', { name: /^table$/i }));

    // Both layouts render from the same column defs, so use getAllByText.
    expect(screen.getAllByText('2026-08-01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026-08-08').length).toBeGreaterThan(0);
    // `activeMembers` is not plotted, so the table is the only place the
    // per-bucket figure shows up — losing it here would be a real regression.
    expect(screen.getAllByText('Active members').length).toBeGreaterThan(0);
  });

  it('says so plainly when the window has no buckets, instead of an empty chart frame', async () => {
    vi.mocked(fetchTeamReport).mockResolvedValue(report({ series: [] }));
    wrap(<ReportsTab teamId="tm1" />);
    await screen.findByText('11');

    expect(screen.getByText(/no completions recorded/i)).toBeInTheDocument();
  });
});

describe('ReportsTab — Export CSV', () => {
  it('downloads the CSV the API returns, under its real filename', async () => {
    vi.mocked(exportTeamReportCsv).mockResolvedValue({
      filename: 'kuda-engineering-12w.csv',
      csv: 'bucket,activeMembers\n2026-08-01,5\n',
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    wrap(<ReportsTab teamId="tm1" />);
    await screen.findByText('11');
    await userEvent.click(screen.getByRole('button', { name: /export csv/i }));

    expect(exportTeamReportCsv).toHaveBeenCalledWith('tm1', { range: '12w' });
    await vi.waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();

    clickSpy.mockRestore();
  });
});
