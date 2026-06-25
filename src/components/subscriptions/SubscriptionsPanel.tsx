"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  cancelSubscription,
  fetchPlans,
  fetchSubscriptions,
  fetchTransactions,
  grantManualSubscription,
  type Plan,
  type Subscription,
  type Transaction,
} from "@/lib/api/billing";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const v = row[h] == null ? "" : String(row[h]);
          return `"${v.replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SubscriptionsPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"subscriptions" | "transactions">("subscriptions");

  const [grantUserId, setGrantUserId] = useState("");
  const [grantPlanId, setGrantPlanId] = useState("");

  async function loadPlans() {
    const res = await fetchPlans({ page: 1, limit: 200 });
    setPlans(res.data || []);
  }

  async function loadSubscriptions() {
    const res = await fetchSubscriptions({
      page: 1,
      limit: 200,
      q,
      status: statusFilter !== "all" ? statusFilter : undefined,
      planId: planFilter !== "all" ? planFilter : undefined,
    });
    setSubscriptions(res.data || []);
  }

  async function loadTransactions() {
    const res = await fetchTransactions({
      page: 1,
      limit: 200,
      q,
      provider: providerFilter !== "all" ? providerFilter : undefined,
    });
    setTransactions(res.data || []);
  }

  async function refreshAll() {
    await Promise.all([loadPlans(), loadSubscriptions(), loadTransactions()]);
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  const subscriptionCsvRows = useMemo(
    () =>
      subscriptions.map((s) => ({
        id: s.id,
        status: s.status,
        plan: s.planName || "",
        userName: s.userName || "",
        userEmail: s.userEmail || "",
        amount: s.amount,
        startedAt: s.startedAt || "",
        expiry: s.expiry || "",
      })),
    [subscriptions]
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
        userName: t.userName || "",
        userEmail: t.userEmail || "",
        createdAt: t.createdAt || "",
      })),
    [transactions]
  );

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subscriptions/transactions" className="w-80" />
          <Button variant="outline" size="sm" onClick={() => refreshAll()}>Refresh</Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={activeTab === "subscriptions" ? "default" : "outline"} onClick={() => setActiveTab("subscriptions")}>Subscriptions</Button>
          <Button size="sm" variant={activeTab === "transactions" ? "default" : "outline"} onClick={() => setActiveTab("transactions")}>Transactions</Button>
        </div>
      </div>

      <div className="border rounded p-3 space-y-2">
        <h3 className="font-medium">Manual Subscription Grant (SUPER_ADMIN)</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="input input-bordered" placeholder="User ID" value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} />
          <select className="select select-bordered" value={grantPlanId} onChange={(e) => setGrantPlanId(e.target.value)}>
            <option value="">Select Plan</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="md:col-span-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={async () => {
                if (!grantUserId || !grantPlanId) return;
                await grantManualSubscription({ userId: grantUserId, planId: grantPlanId });
                setGrantUserId("");
                setGrantPlanId("");
                await loadSubscriptions();
              }}
            >
              Grant Access
            </button>
          </div>
        </div>
      </div>

      {activeTab === "subscriptions" ? (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <select className="select select-bordered" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="CANCELED">CANCELED</option>
              <option value="PAUSED">PAUSED</option>
            </select>
            <select className="select select-bordered" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="all">All plans</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={() => loadSubscriptions()}>Apply</Button>
            <Button size="sm" variant="outline" onClick={() => exportCsv(subscriptionCsvRows, "subscriptions.csv")}>Export CSV</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold">User</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Plan</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Started</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Expiry</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{s.userName || "-"}<div className="text-xs text-gray-500">{s.userEmail || ""}</div></td>
                    <td className="px-4 py-3 text-sm">{s.planName || "-"}</td>
                    <td className="px-4 py-3 text-sm">{s.status}</td>
                    <td className="px-4 py-3 text-sm">{s.amount}</td>
                    <td className="px-4 py-3 text-sm">{s.startedAt ? new Date(s.startedAt).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-sm">{s.expiry ? new Date(s.expiry).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <button className="text-red-600 hover:text-red-800 font-medium" onClick={async () => { await cancelSubscription(s.id); await loadSubscriptions(); }}>Cancel</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <select className="select select-bordered" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
              <option value="all">All providers</option>
              <option value="PADDLE">Paddle</option>
              <option value="ASYNCPAY">AsyncPay</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => loadTransactions()}>Apply</Button>
            <Button size="sm" variant="outline" onClick={() => exportCsv(transactionCsvRows, "transactions.csv")}>Export CSV</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Invoice</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Title</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Provider</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">User</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{t.invoice}</td>
                    <td className="px-4 py-3 text-sm">{t.title}</td>
                    <td className="px-4 py-3 text-sm">{t.provider || "-"}</td>
                    <td className="px-4 py-3 text-sm">{t.status}</td>
                    <td className="px-4 py-3 text-sm">{t.amount}</td>
                    <td className="px-4 py-3 text-sm">{t.userName || "-"}<div className="text-xs text-gray-500">{t.userEmail || ""}</div></td>
                    <td className="px-4 py-3 text-sm">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
