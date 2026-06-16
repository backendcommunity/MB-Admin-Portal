"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApiQuery } from "@/lib/api/query";
import type { User } from "@/lib/api/users";
import { deleteUser } from "@/lib/api/users";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UserActionModal from "@/components/users/UserActionModal";
import ConfirmDelete from "@/components/users/ConfirmDelete";

export default function UserDetailClient() {
  const params = useParams();
  const router = useRouter();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [activeTab, setActiveTab] = useState<"profile" | "activity" | "subscriptions">("profile");
  const [actionModal, setActionModal] = useState<{
    type: "suspend" | "role" | "password" | null;
    open: boolean;
  }>({ type: null, open: false });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: user, isLoading, refetch } = useApiQuery<User>(
    ["user", userId],
    `/admin/users/${userId}`
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="p-6 bg-red-50 border border-red-200">
        <h2 className="text-lg font-bold text-red-800">User Not Found</h2>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </Card>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-red-100 text-red-800";
      case "ADMIN":
        return "bg-blue-100 text-blue-800";
      case "INSTRUCTOR":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDelete = async () => {
    if (!userId) return;
    try {
      await deleteUser(userId);
      router.push("/users");
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{user.name}</h1>
            <p className="text-gray-600 text-sm mt-1">{user.email}</p>
            <div className="flex gap-2 mt-3">
              <Badge className={`${getRoleBadgeColor(user.role)} px-3 py-1`}>
                {user.role}
              </Badge>
              <Badge
                className={user.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
              >
                {user.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => setActionModal({ type: "role", open: true })}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Change Role
            </Button>
            <Button
              onClick={() => setActionModal({ type: "password", open: true })}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Reset Password
            </Button>
            {user.active && (
              <Button
                onClick={() => setActionModal({ type: "suspend", open: true })}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Suspend
              </Button>
            )}
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card>
        <div className="flex border-b">
          {["profile", "activity", "subscriptions"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "profile" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p className="text-lg">{user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Role</label>
                  <p className="text-lg">{user.role}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Plan</label>
                  <p className="text-lg">{user.plan || "—"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Joined</label>
                  <p className="text-lg">
                    {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "activity" && (
            <div className="text-center py-8 text-gray-500">
              <p>Activity history coming soon</p>
            </div>
          )}

          {activeTab === "subscriptions" && (
            <div className="text-center py-8 text-gray-500">
              <p>Subscription details coming soon</p>
            </div>
          )}
        </div>
      </Card>

      {/* Action Modals */}
      <UserActionModal
        open={actionModal.open && actionModal.type === "role"}
        user={user}
        action="role"
        onClose={() => setActionModal({ type: null, open: false })}
        onSuccess={() => {
          refetch();
          setActionModal({ type: null, open: false });
        }}
      />

      <UserActionModal
        open={actionModal.open && actionModal.type === "password"}
        user={user}
        action="password"
        onClose={() => setActionModal({ type: null, open: false })}
        onSuccess={() => {
          setActionModal({ type: null, open: false });
        }}
      />

      <UserActionModal
        open={actionModal.open && actionModal.type === "suspend"}
        user={user}
        action="suspend"
        onClose={() => setActionModal({ type: null, open: false })}
        onSuccess={() => {
          refetch();
          setActionModal({ type: null, open: false });
        }}
      />

      <ConfirmDelete
        open={showDeleteConfirm}
        title="Delete User"
        description={`Permanently delete ${user.name}? This cannot be undone.`}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
