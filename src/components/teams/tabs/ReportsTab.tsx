'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/shared/DataTable';
import { CompletionsChart } from '@/components/teams/tabs/CompletionsChart';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { cn } from '@/lib/utils';
import {
  fetchTeamReport,
  exportTeamReportCsv,
  type ReportRange,
  type TeamReportBucket,
  type TeamReportTotals,
} from '@/lib/api/teams';

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { message?: string } } };
  return anyErr.response?.data?.message || fallback;
}

const RANGES: { value: ReportRange; label: string }[] = [
  { value: '12w', label: '12 weeks' },
  { value: '12m', label: '12 months' },
];

const VIEWS: { value: 'chart' | 'table'; label: string }[] = [
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
];

const TILES: { key: keyof TeamReportTotals; label: string }[] = [
  { key: 'activeMembers', label: 'Active members' },
  { key: 'coursesFinished', label: 'Courses finished' },
  { key: 'pathsFinished', label: 'Paths finished' },
  { key: 'membersWhoFinished', label: 'Members who finished' },
];

/**
 * `change[key]` is a FRACTION, and the API returns `null` — never `Infinity`
 * or `NaN` — when the previous period was zero (`percentChange`, academy
 * `modules/teams/helpers/report-window.ts`). The `null` check happens FIRST
 * and unconditionally, before any arithmetic touches the value, specifically
 * so a shortcut that recomputed `(current-previous)/previous*100` in the
 * component instead of trusting this field could never produce `Infinity%`
 * here even if it were tried.
 */
function changeLabel(change: number | null): string {
  if (change === null) return '—';
  const pct = Math.round(change * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function changeTone(change: number | null): string {
  if (change === null) return 'text-muted-foreground';
  if (change > 0) return 'text-success';
  if (change < 0) return 'text-danger';
  return 'text-muted-foreground';
}

function StatTile({
  testId,
  label,
  value,
  change,
}: {
  testId: string;
  label: string;
  value: number;
  change: number | null;
}) {
  return (
    <div data-testid={testId} className="rounded-lg border border-border bg-card px-3.5 py-2.5">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-xs font-medium tabular-nums', changeTone(change))}>
        {changeLabel(change)}
      </div>
    </div>
  );
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Range selector, four period-over-period stat tiles, the completions
 * series, and a CSV export. Read-only — no `onChanged`, since nothing here
 * writes.
 *
 * `exportTeamReportCsv` hands back raw CSV text plus a filename (the route
 * responds `text/csv`, not this file's usual `{success, data}` envelope —
 * see that function's doc comment), so the download is triggered client-side
 * with a Blob and an object URL, the same pattern `SubscriptionsPanel` and
 * `CoursesTable` already use for a client-built CSV.
 */
export function ReportsTab({ teamId }: { teamId: string }) {
  const [range, setRange] = useState<ReportRange>('12w');
  // The chart answers "is this team finishing more than it was?" at a glance;
  // the table is still one click away for the exact numbers, for the
  // `activeMembers` column the chart does not plot, and as the non-visual
  // route to the same data.
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-team-report', teamId, range],
    queryFn: () => fetchTeamReport(teamId, { range }),
    enabled: Boolean(teamId),
  });

  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    setExporting(true);
    try {
      const { filename, csv } = await exportTeamReportCsv(teamId, { range });
      downloadCsv(filename, csv);
      toast.success(`Downloaded ${filename}.`);
    } catch (error) {
      toast.error('Could not export the report', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo<ColumnDef<TeamReportBucket>[]>(
    () => [
      { id: 'bucket', header: 'Period', cell: ({ row }) => row.original.bucket },
      {
        id: 'activeMembers',
        header: 'Active members',
        meta: { align: 'right' as const },
        cell: ({ row }) => row.original.activeMembers,
      },
      {
        id: 'coursesFinished',
        header: 'Courses finished',
        meta: { align: 'right' as const },
        cell: ({ row }) => row.original.coursesFinished,
      },
      {
        id: 'pathsFinished',
        header: 'Paths finished',
        meta: { align: 'right' as const },
        cell: ({ row }) => row.original.pathsFinished,
      },
    ],
    [],
  );

  const series = data?.series ?? [];
  const table = useReactTable({ data: series, columns, getCoreRowModel: getCoreRowModel() });

  if (isLoading) return <LoadingState label="Loading report…" />;
  if (isError || !data)
    return <ErrorState message="Failed to load the report." onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              size="sm"
              variant={range === r.value ? 'default' : 'ghost'}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={doExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((tile) => (
          <StatTile
            key={tile.key}
            testId={`report-stat-${tile.key}`}
            label={tile.label}
            value={data.totals[tile.key]}
            change={data.change[tile.key]}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">Completions</span>
          <div
            role="group"
            aria-label="Completions view"
            className="flex gap-1 rounded-lg border border-border bg-card p-1"
          >
            {VIEWS.map((v) => (
              <Button
                key={v.value}
                size="sm"
                variant={view === v.value ? 'default' : 'ghost'}
                aria-pressed={view === v.value}
                onClick={() => setView(v.value)}
              >
                {v.label}
              </Button>
            ))}
          </div>
        </div>

        {series.length === 0 ? (
          <Card className="p-8">
            <p className="text-center text-sm text-muted-foreground">
              No completions recorded in this window yet.
            </p>
          </Card>
        ) : view === 'table' ? (
          <Card className="overflow-hidden p-0">
            <DataTable table={table} mobileTitle={(row) => row.original.bucket} />
          </Card>
        ) : (
          <Card className="p-4">
            <CompletionsChart series={series} period={data.range.period} />
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          Completions before {data.range.completionsBegin} may be undercounted — see the note in
          this tab&apos;s source for why.
        </p>
      </div>
    </div>
  );
}

export default ReportsTab;
