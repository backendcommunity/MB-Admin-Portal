"use client";

import React, { useMemo } from "react";

import { useApiQuery } from "@/lib/api/query";
import { type EarningsBreakdownItem, type EarningsSummary, type PayoutItem } from "@/lib/api/instructor";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EarningsPanel() {
  const summaryQuery = useApiQuery<{ data: EarningsSummary }>(["earnings-summary"], "/instructor/earnings/summary");
  const breakdownQuery = useApiQuery<{ data: EarningsBreakdownItem[] }>(["earnings-breakdown"], "/instructor/earnings/breakdown?months=6");
  const payoutsQuery = useApiQuery<{ data: PayoutItem[]; total: number }>(["earnings-payouts"], "/instructor/earnings/payouts?page=1&limit=20");

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Earned</p>
          <p className="text-2xl font-semibold">${summary ? summary.totalEarned.toFixed(2) : "0.00"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Current Balance</p>
          <p className="text-2xl font-semibold">${summary ? summary.currentBalance.toFixed(2) : "0.00"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pending Payout</p>
          <p className="text-2xl font-semibold">${summary ? summary.pendingPayout.toFixed(2) : "0.00"}</p>
        </Card>
      </div>

      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Revenue Breakdown</h2>
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
          <p>Loading breakdown...</p>
        ) : breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No earnings activity yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold">Month</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold">Content</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold">Transactions</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row, idx) => (
                    <tr key={`${row.month}-${row.contentTitle}-${idx}`} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{row.month}</td>
                      <td className="px-4 py-3 text-sm">{row.contentTitle}</td>
                      <td className="px-4 py-3 text-sm">{row.transactions}</td>
                      <td className="px-4 py-3 text-sm">${Number(row.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Monthly Totals</p>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                {totalsByMonth.map(([month, amount]) => (
                  <div key={month} className="rounded border px-3 py-2">
                    <p className="text-xs text-muted-foreground">{month}</p>
                    <p className="text-sm font-semibold">${amount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">Payout History</h2>
        {payoutsQuery.isLoading ? (
          <p>Loading payouts...</p>
        ) : payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payout history found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Title</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{row.date ? new Date(row.date).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-sm">{row.title}</td>
                    <td className="px-4 py-3 text-sm">{row.status}</td>
                    <td className="px-4 py-3 text-sm">${Number(row.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
