'use client';

import React, { useEffect, useState } from 'react';

import { createPlan, fetchPlans, updatePlan, type Plan } from '@/lib/api/billing';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';

export default function PlansTable() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [annualPrice, setAnnualPrice] = useState(0);
  const [popular, setPopular] = useState(false);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchPlans({ q, page: 1, limit: 100 });
      setPlans(res.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitPlan(e: React.FormEvent) {
    e.preventDefault();

    if (editingId) {
      await updatePlan({ id: editingId, name, monthlyPrice, annualPrice, popular, hasDiscount });
    } else {
      await createPlan({ name, monthlyPrice, annualPrice, popular, hasDiscount });
    }

    setName('');
    setMonthlyPrice(0);
    setAnnualPrice(0);
    setPopular(false);
    setHasDiscount(false);
    setEditingId(null);
    await load();
  }

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setName(plan.name || '');
    setMonthlyPrice(Number(plan.monthlyPrice || 0));
    setAnnualPrice(Number(plan.annualPrice || 0));
    setPopular(Boolean(plan.popular));
    setHasDiscount(Boolean(plan.hasDiscount));
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Plans" description="Create and manage subscription plans." />

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="mb-4 space-y-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search plans"
            className="w-full"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button onClick={() => load()} variant="outline" className="col-span-2 sm:col-span-1">
              Refresh
            </Button>
          </div>
        </div>

        <form
          onSubmit={submitPlan}
          className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border border-border rounded p-3"
        >
          <div className="md:col-span-2">
            <label className="block text-sm text-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-foreground">Monthly</label>
            <Input
              type="number"
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm text-foreground">Annual</label>
            <Input
              type="number"
              value={annualPrice}
              onChange={(e) => setAnnualPrice(Number(e.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={popular}
              onCheckedChange={(v) => setPopular(!!v)}
              aria-label="Popular"
            />
            Popular
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={hasDiscount}
              onCheckedChange={(v) => setHasDiscount(!!v)}
              aria-label="Discount"
            />
            Discount
          </label>
          <div className="md:col-span-6 flex gap-2">
            <Button type="submit" size="sm">
              {editingId ? 'Update' : 'Create'} Plan
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingId(null);
                  setName('');
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>

        {loading ? (
          <LoadingState label="Loading plans..." />
        ) : plans.length === 0 ? (
          <EmptyState title="No plans found" description="Create your first plan above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                    Monthly
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                    Annual
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                    Subscribers
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                    Flags
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm text-foreground">{plan.name}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{plan.monthlyPrice}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{plan.annualPrice}</td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {plan.activeSubscribers ?? 0}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {plan.popular && <StatusBadge label="Popular" tone="info" />}
                        {plan.hasDiscount && <StatusBadge label="Discount" tone="warning" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(plan)}>
                        Edit
                      </Button>
                    </td>
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
