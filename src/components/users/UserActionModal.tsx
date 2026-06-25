'use client';

import React, { useState } from 'react';
import { suspendUserById, updateUserRole, resetUserPassword } from '@/lib/api/users';
import type { User } from '@/lib/api/users';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type UserActionModalProps = {
  open: boolean;
  user?: User | null;
  action: 'suspend' | 'role' | 'password';
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
  const [newRole, setNewRole] = useState(user?.role || 'INSTRUCTOR');
  const [error, setError] = useState<string | null>(null);

  const handleSuspend = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await suspendUserById(user!.id, false);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suspend user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (newRole === user!.role) {
      onClose();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await updateUserRole(user!.id, newRole);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await resetUserPassword(user!.id);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open && !!user}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full">
        {action === 'suspend' && (
          <>
            <DialogHeader>
              <DialogTitle>Suspend User</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Suspending <strong>{user?.name}</strong> ({user?.email}) will disable their account
              immediately.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleSuspend} disabled={isLoading}>
                {isLoading ? 'Suspending...' : 'Suspend'}
              </Button>
            </DialogFooter>
          </>
        )}

        {action === 'role' && (
          <>
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Current role: <strong>{user?.role}</strong>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="new-role">New Role</Label>
              <Select value={newRole} onValueChange={setNewRole} disabled={isLoading}>
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleChangeRole} disabled={isLoading || newRole === user?.role}>
                {isLoading ? 'Updating...' : 'Update Role'}
              </Button>
            </DialogFooter>
          </>
        )}

        {action === 'password' && (
          <>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              A password reset link will be sent to <strong>{user?.email}</strong>.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleResetPassword} disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
