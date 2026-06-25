"use client";

import React, { useState } from "react";
import { suspendUserById, updateUserRole, resetUserPassword } from "@/lib/api/users";
import type { User } from "@/lib/api/users";
import { Button } from "@/components/ui/button";

type UserActionModalProps = {
  open: boolean;
  user?: User | null;
  action: "suspend" | "role" | "password";
  onClose: () => void;
  onSuccess?: () => void;
};

export default function UserActionModal({
  open,
  user,
  action,
  onClose,
  onSuccess,
}: UserActionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [newRole, setNewRole] = useState(user?.role || "INSTRUCTOR");
  const [error, setError] = useState<string | null>(null);

  if (!open || !user) return null;

  const handleSuspend = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await suspendUserById(user.id, false);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to suspend user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (newRole === user.role) {
      onClose();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await updateUserRole(user.id, newRole);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change role");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await resetUserPassword(user.id);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[480px] max-w-[95vw]">
        {action === "suspend" && (
          <>
            <h2 className="text-lg font-bold mb-4">Suspend User</h2>
            <p className="text-gray-600 mb-6">
              Suspending <strong>{user.name}</strong> ({user.email}) will disable their account immediately.
            </p>
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleSuspend}
                disabled={isLoading}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                {isLoading ? "Suspending..." : "Suspend"}
              </Button>
            </div>
          </>
        )}

        {action === "role" && (
          <>
            <h2 className="text-lg font-bold mb-4">Change User Role</h2>
            <p className="text-gray-600 mb-4">
              Current role: <strong>{user.role}</strong>
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">New Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="select select-bordered w-full"
                disabled={isLoading}
              >
                <option value="INSTRUCTOR">Instructor</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleChangeRole}
                disabled={isLoading || newRole === user.role}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? "Updating..." : "Update Role"}
              </Button>
            </div>
          </>
        )}

        {action === "password" && (
          <>
            <h2 className="text-lg font-bold mb-4">Reset Password</h2>
            <p className="text-gray-600 mb-6">
              A password reset link will be sent to <strong>{user.email}</strong>.
            </p>
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
