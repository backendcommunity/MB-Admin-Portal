"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useApiQuery } from "@/lib/api/query";
import type { User } from "@/lib/api/users";
import {
  fetchUserById,
  resetUserPassword,
  suspendUserById,
  updateUserRole,
} from "@/lib/api/users";
import { deleteUser } from "@/lib/api/users";

const tabs = ["Profile", "Activity", "Subscriptions"] as const;

type Props = {
  userId: number;
};

export default function UserDetailClient({ userId }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Profile");
  const [role, setRole] = useState<string>("INSTRUCTOR");
  const [actionMessage, setActionMessage] = useState<string>("");

  const { data: user, isLoading, isError, refetch } = useApiQuery<User>(
    ["user", userId],
    `/users/${userId}`
  );

  const summaryCards = useMemo(
    () => [
      { label: "Plan", value: user?.plan || "Starter" },
      { label: "Joined", value: user?.joinedAt || "—" },
      { label: "Role", value: user?.role || "—" },
      { label: "Status", value: user?.active ? "Active" : "Inactive" },
    ],
    [user]
  );

  async function handleSuspendToggle() {
    if (!user) return;
    await suspendUserById(user.id, !user.active);
    await refetch();
    setActionMessage(user.active ? "User suspended" : "User reactivated");
  }

  async function handleChangeRole() {
    if (!user) return;
    await updateUserRole(user.id, role);
    await refetch();
    setActionMessage(`Role changed to ${role}`);
  }

  async function handleResetPassword() {
    if (!user) return;
    const result = await resetUserPassword(user.id);
    setActionMessage(result.message);
  }

  async function handleDelete() {
    if (!user) return;
    await deleteUser(user.id);
    router.push("/users");
  }

  if (isLoading) {
    return <div className="p-6">Loading user...</div>;
  }

  if (isError || !user) {
    return (
      <div className="p-6 space-y-4">
        <p>User not found.</p>
        <Link className="btn btn-sm btn-primary" href="/users">
          Back to users
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{user.name}</h1>
            <span className="badge badge-outline">{user.role}</span>
            <span className={user.active ? "badge badge-success" : "badge badge-error"}>
              {user.active ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
        </div>
        <Link href="/users" className="btn btn-sm btn-ghost">
          Back to users
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-lg border bg-white p-4">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-lg font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? "rounded-md border-b-2 border-sky-500 px-3 py-2 text-sm font-medium"
                : "rounded-md px-3 py-2 text-sm text-muted-foreground"
            }
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border bg-white p-4">
          {activeTab === "Profile" && (
            <div className="space-y-3">
              <p><span className="font-medium">Name:</span> {user.name}</p>
              <p><span className="font-medium">Email:</span> {user.email}</p>
              <p><span className="font-medium">Role:</span> {user.role}</p>
              <p><span className="font-medium">Joined:</span> {user.joinedAt || "—"}</p>
            </div>
          )}
          {activeTab === "Activity" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Activity timeline placeholder for Week 2 scope.</p>
              <div className="rounded-md border p-3">Login at 09:41 AM</div>
              <div className="rounded-md border p-3">Course progress updated</div>
            </div>
          )}
          {activeTab === "Subscriptions" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Subscription history placeholder for Week 2 scope.</p>
              <div className="rounded-md border p-3">Pro Plan - Active</div>
              <div className="rounded-md border p-3">Annual bundle - Expired</div>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold">Actions</h2>
          <button className="btn btn-sm w-full" onClick={handleSuspendToggle}>
            {user.active ? "Suspend" : "Reactivate"}
          </button>
          <button className="btn btn-sm w-full" onClick={handleResetPassword}>
            Reset Password
          </button>
          <div className="space-y-2">
            <select className="select select-bordered w-full" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="ADMIN">ADMIN</option>
              <option value="INSTRUCTOR">INSTRUCTOR</option>
            </select>
            <button className="btn btn-sm w-full" onClick={handleChangeRole}>
              Change Role
            </button>
          </div>
          <button className="btn btn-sm w-full btn-ghost text-red-600" onClick={handleDelete}>
            Delete User
          </button>
          {actionMessage ? <p className="text-sm text-sky-700">{actionMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}
