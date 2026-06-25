'use client';

import React, { useMemo } from 'react';

import { useApiQuery } from '@/lib/api/query';
import {
  type EarningsBreakdownItem,
  type EarningsSummary,
  type PayoutItem,
} from '@/lib/api/instructor';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';

function payoutStatusTone(status: string): 'success' | 'warning' | 'neutral' | 'danger' {
  const s = status?.toLowerCase();
  if (s === 'paid' || s === 'completed') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'failed' || s === 'rejected') return 'danger';
  return 'neutral';
}

export default function EarningsPanel() {
  const summaryQuery = useApiQuery<{ data: EarningsSummary }>(
    ['earnings-summary'],
    '/instructor/earnings/summary',
  );
  const breakdownQuery = useApiQuery<{ data: EarningsBreakdownItem[] }>(
    ['earnings-breakdown'],
    '/instructor/earnings/breakdown?months=6',
  );
  const payoutsQuery = useApiQuery<{ data: PayoutItem[]; total: number }>(
    ['earnings-payouts'],
    '/instructor/earnings/payouts?page=1&limit=20',
  );

  const summary = summaryQuery.data?.data;
  const breakdown = breakdownQuery.data?.data ?? [];
  const payouts = payoutsQuery.data?.data ?? [];

  const totalsByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of breakdown) {
      map.set(row.month, (map.get(row.month) ?? 0) + Number(row.amount || 0));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [breakdown]);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 pb-4 flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">Total Earned</span>
            <p className="text-3xl font-bold text-foreground">
              ${summary ? summary.totalEarned.toFixed(2) : '0.00'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-4 flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">Current Balance</span>
            <p className="text-3xl font-bold text-foreground">
              ${summary ? summary.currentBalance.toFixed(2) : '0.00'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-4 flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">Pending Payout</span>
            <p className="text-3xl font-bold text-foreground">
              ${summary ? summary.pendingPayout.toFixed(2) : '0.00'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <Card className="p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Revenue Breakdown</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              summaryQuery.refetch();
              breakdownQuery.refetch();
              payoutsQuery.refetch();
            }}
          >
            Refresh
          </Button>
        </div>

        {breakdownQuery.isLoading ? (
          <LoadingState label="Loading breakdown..." />
        ) : breakdown.length === 0 ? (
          <EmptyState title="No earnings yet" description="No earnings activity yet." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead>Month</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.map((row, idx) => (
                  <TableRow key={`${row.month}-${row.contentTitle}-${idx}`}>
                    <TableCell className="text-sm text-foreground">{row.month}</TableCell>
                    <TableCell className="text-sm text-foreground">{row.contentTitle}</TableCell>
                    <TableCell className="text-sm text-foreground">{row.transactions}</TableCell>
                    <TableCell className="text-sm text-foreground">
                      ${Number(row.amount || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Monthly Totals</p>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                {totalsByMonth.map(([month, amount]) => (
                  <div key={month} className="rounded-lg border border-border bg-card px-3 py-2">
                    <p className="text-xs text-muted-foreground">{month}</p>
                    <p className="text-sm font-semibold text-foreground">${amount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Payout History */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Payout History</h2>
        {payoutsQuery.isLoading ? (
          <LoadingState label="Loading payouts..." />
        ) : payouts.length === 0 ? (
          <EmptyState title="No payout history" description="No payout history found." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm text-foreground">
                    {row.date ? new Date(row.date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{row.title}</TableCell>
                  <TableCell className="text-sm">
                    <StatusBadge label={row.status} tone={payoutStatusTone(row.status)} />
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    ${Number(row.amount || 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
