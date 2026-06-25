'use client';

import React, { useEffect, useMemo, useState } from 'react';

import {
  cancelSubscription,
  fetchPlans,
  fetchSubscriptions,
  fetchTransactions,
  grantManualSubscription,
  type Plan,
  type Subscription,
  type Transaction,
} from '@/lib/api/billing';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterBar } from '@/components/shared/FilterBar';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreditCard } from 'lucide-react';

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const v = row[h] == null ? '' : String(row[h]);
          return `"${v.replace(/"/g, '""')}"`;
        })
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function subscriptionTone(status: string) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'CANCELED') return 'danger' as const;
  if (status === 'PAUSED') return 'warning' as const;
  return 'neutral' as const;
}

function transactionTone(status: string) {
  if (status === 'SUCCESS' || status === 'COMPLETED') return 'success' as const;
  if (status === 'FAILED' || status === 'DECLINED') return 'danger' as const;
  if (status === 'PENDING') return 'warning' as const;
  return 'neutral' as const;
}

export default function SubscriptionsPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'transactions'>('subscriptions');

  const [grantUserId, setGrantUserId] = useState('');
  const [grantPlanId, setGrantPlanId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPlans() {
    const res = await fetchPlans({ page: 1, limit: 200 });
    setPlans(res.data || []);
  }

  async function loadSubscriptions() {
    const res = await fetchSubscriptions({
      page: 1,
      limit: 200,
      q,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      planId: planFilter !== 'all' ? planFilter : undefined,
    });
    setSubscriptions(res.data || []);
  }

  async function loadTransactions() {
    const res = await fetchTransactions({
      page: 1,
      limit: 200,
      q,
      provider: providerFilter !== 'all' ? providerFilter : undefined,
    });
    setTransactions(res.data || []);
  }

  async function refreshAll() {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([loadPlans(), loadSubscriptions(), loadTransactions()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription data');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscriptionCsvRows = useMemo(
    () =>
      subscriptions.map((s) => ({
        id: s.id,
        status: s.status,
        plan: s.planName || '',
        userName: s.userName || '',
        userEmail: s.userEmail || '',
        amount: s.amount,
        startedAt: s.startedAt || '',
        expiry: s.expiry || '',
      })),
    [subscriptions],
  );

  const transactionCsvRows = useMemo(
    () =>
      transactions.map((t) => ({
        id: t.id,
        invoice: t.invoice,
        title: t.title,
        provider: t.provider,
        status: t.status,
        amount: t.amount,
        userName: t.userName || '',
        userEmail: t.userEmail || '',
        createdAt: t.createdAt || '',
      })),
    [transactions],
  );

  return (
    <Card className="p-6 space-y-4">
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <FilterBar>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search subscriptions/transactions"
          className="w-80"
        />
        <Button variant="outline" size="sm" onClick={() => refreshAll()}>
          Refresh
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant={activeTab === 'subscriptions' ? 'default' : 'outline'}
            onClick={() => setActiveTab('subscriptions')}
          >
            Subscriptions
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'transactions' ? 'default' : 'outline'}
            onClick={() => setActiveTab('transactions')}
          >
            Transactions
          </Button>
        </div>
      </FilterBar>

      {/* ── Manual Subscription Grant ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Manual Subscription Grant (SUPER_ADMIN)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label htmlFor="grant-user-id">User ID</Label>
            <Input
              id="grant-user-id"
              placeholder="User ID"
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="grant-plan">Plan</Label>
            <Select value={grantPlanId} onValueChange={setGrantPlanId}>
              <SelectTrigger id="grant-plan">
                <SelectValue placeholder="Select Plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 flex items-end">
            <Button
              size="sm"
              onClick={async () => {
                if (!grantUserId || !grantPlanId) return;
                await grantManualSubscription({ userId: grantUserId, planId: grantPlanId });
                setGrantUserId('');
                setGrantPlanId('');
                await loadSubscriptions();
              }}
            >
              Grant Access
            </Button>
          </div>
        </div>
      </div>

      {/* ── Global Loading / Error States ────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState label="Loading subscription data..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => refreshAll()} />
      ) : (
        <>
          {/* ── Tab Content ────────────────────────────────────────────────────── */}
          {activeTab === 'subscriptions' ? (
            <div className="space-y-3">
              <FilterBar>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="CANCELED">CANCELED</SelectItem>
                    <SelectItem value="PAUSED">PAUSED</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plans</SelectItem>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => loadSubscriptions()}>
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportCsv(subscriptionCsvRows, 'subscriptions.csv')}
                >
                  Export CSV
                </Button>
              </FilterBar>

              {subscriptions.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No subscriptions found"
                  description="No subscriptions match the current filters."
                />
              ) : (
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead className="text-sm font-semibold text-foreground">
                          User
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Plan
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Status
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Amount
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Started
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Expiry
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm text-foreground">
                            {s.userName || '-'}
                            <div className="text-xs text-muted-foreground">{s.userEmail || ''}</div>
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            {s.planName || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            <StatusBadge label={s.status} tone={subscriptionTone(s.status)} />
                          </TableCell>
                          <TableCell className="text-sm text-foreground">{s.amount}</TableCell>
                          <TableCell className="text-sm text-foreground">
                            {s.startedAt ? new Date(s.startedAt).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            {s.expiry ? new Date(s.expiry).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                await cancelSubscription(s.id);
                                await loadSubscriptions();
                              }}
                            >
                              Cancel
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <FilterBar>
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All providers</SelectItem>
                    <SelectItem value="PADDLE">Paddle</SelectItem>
                    <SelectItem value="ASYNCPAY">AsyncPay</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => loadTransactions()}>
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportCsv(transactionCsvRows, 'transactions.csv')}
                >
                  Export CSV
                </Button>
              </FilterBar>

              {transactions.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No transactions found"
                  description="No transactions match the current filters."
                />
              ) : (
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Invoice
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Title
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Provider
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Status
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Amount
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          User
                        </TableHead>
                        <TableHead className="text-sm font-semibold text-foreground">
                          Date
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm text-foreground">{t.invoice}</TableCell>
                          <TableCell className="text-sm text-foreground">{t.title}</TableCell>
                          <TableCell className="text-sm text-foreground">
                            {t.provider || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            <StatusBadge label={t.status} tone={transactionTone(t.status)} />
                          </TableCell>
                          <TableCell className="text-sm text-foreground">{t.amount}</TableCell>
                          <TableCell className="text-sm text-foreground">
                            {t.userName || '-'}
                            <div className="text-xs text-muted-foreground">{t.userEmail || ''}</div>
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
