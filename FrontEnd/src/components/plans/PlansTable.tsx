"use client";

import React, { useEffect, useState } from "react";

import { createPlan, fetchPlans, updatePlan, type Plan } from "@/lib/api/billing";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PlansTable() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
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
  }, []);

  async function submitPlan(e: React.FormEvent) {
    e.preventDefault();

    if (editingId) {
      await updatePlan({ id: editingId, name, monthlyPrice, annualPrice, popular, hasDiscount });
    } else {
      await createPlan({ name, monthlyPrice, annualPrice, popular, hasDiscount });
    }

    setName("");
    setMonthlyPrice(0);
    setAnnualPrice(0);
    setPopular(false);
    setHasDiscount(false);
    setEditingId(null);
    await load();
  }

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setName(plan.name || "");
    setMonthlyPrice(Number(plan.monthlyPrice || 0));
    setAnnualPrice(Number(plan.annualPrice || 0));
    setPopular(Boolean(plan.popular));
    setHasDiscount(Boolean(plan.hasDiscount));
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search plans"
          className="w-72"
        />
        <Button onClick={() => load()} variant="outline" size="sm">Refresh</Button>
      </div>

      <form onSubmit={submitPlan} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border rounded p-3">
        <div className="md:col-span-2">
          <label className="block text-sm">Name</label>
          <input className="input input-bordered w-full" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm">Monthly</label>
          <input type="number" className="input input-bordered w-full" value={monthlyPrice} onChange={(e) => setMonthlyPrice(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm">Annual</label>
          <input type="number" className="input input-bordered w-full" value={annualPrice} onChange={(e) => setAnnualPrice(Number(e.target.value))} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={popular} onChange={(e) => setPopular(e.target.checked)} /> Popular
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasDiscount} onChange={(e) => setHasDiscount(e.target.checked)} /> Discount
        </label>
        <div className="md:col-span-6 flex gap-2">
          <button className="btn btn-primary btn-sm" type="submit">{editingId ? "Update" : "Create"} Plan</button>
          {editingId ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setName(""); }}>Cancel</button> : null}
        </div>
      </form>

      {loading ? <p>Loading...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold">Name</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Monthly</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Annual</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Subscribers</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Flags</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{plan.name}</td>
                  <td className="px-4 py-3 text-sm">{plan.monthlyPrice}</td>
                  <td className="px-4 py-3 text-sm">{plan.annualPrice}</td>
                  <td className="px-4 py-3 text-sm">{plan.activeSubscribers ?? 0}</td>
                  <td className="px-4 py-3 text-sm">{plan.popular ? "Popular " : ""}{plan.hasDiscount ? "Discount" : ""}</td>
                  <td className="px-4 py-3 text-sm">
                    <button className="text-blue-600 hover:text-blue-800 font-medium" onClick={() => startEdit(plan)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
