'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApiQuery } from '@/lib/api/query';
import type { User } from '@/lib/api/users';
import { deleteUser } from '@/lib/api/users';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import UserActionModal from '@/components/users/UserActionModal';
import ConfirmDelete from '@/components/users/ConfirmDelete';

export default function UserDetailClient() {
  const params = useParams();
  const router = useRouter();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [actionModal, setActionModal] = useState<{
    type: 'suspend' | 'role' | 'password' | null;
    open: boolean;
  }>({ type: null, open: false });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    data: user,
    isLoading,
    refetch,
  } = useApiQuery<User>(['user', userId], `/admin/users/${userId}`);

  if (isLoading) {
    return <LoadingState label="Loading user..." />;
  }

  if (!user) {
    return <ErrorState message="User not found." />;
  }

  const roleToTone = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'danger' as const;
      case 'ADMIN':
        return 'info' as const;
      case 'INSTRUCTOR':
        return 'success' as const;
      default:
        return 'neutral' as const;
    }
  };

  const handleDelete = async () => {
    if (!userId) return;
    try {
      await deleteUser(userId);
      router.push('/users');
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const headerActions = (
    <>
      <Button variant="outline" onClick={() => setActionModal({ type: 'role', open: true })}>
        Change Role
      </Button>
      <Button variant="outline" onClick={() => setActionModal({ type: 'password', open: true })}>
        Reset Password
      </Button>
      {user.active && (
        <Button variant="outline" onClick={() => setActionModal({ type: 'suspend', open: true })}>
          Suspend
        </Button>
      )}
      <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
        Delete
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={user.name} description={user.email} actions={headerActions} />

      {/* Status badges */}
      <div className="flex gap-2 flex-wrap">
        <StatusBadge label={user.role} tone={roleToTone(user.role)} />
        <StatusBadge
          label={user.active ? 'Active' : 'Inactive'}
          tone={user.active ? 'success' : 'danger'}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base text-foreground mt-1">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Role</p>
                  <p className="text-base text-foreground mt-1">{user.role}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Plan</p>
                  <p className="text-base text-foreground mt-1">{user.plan || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Joined</p>
                  <p className="text-base text-foreground mt-1">
                    {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Activity history coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Subscription details coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Modals */}
      <UserActionModal
        open={actionModal.open && actionModal.type === 'role'}
        user={user}
        action="role"
        onClose={() => setActionModal({ type: null, open: false })}
        onSuccess={() => {
          refetch();
          setActionModal({ type: null, open: false });
        }}
      />

      <UserActionModal
        open={actionModal.open && actionModal.type === 'password'}
        user={user}
        action="password"
        onClose={() => setActionModal({ type: null, open: false })}
        onSuccess={() => {
          setActionModal({ type: null, open: false });
        }}
      />

      <UserActionModal
        open={actionModal.open && actionModal.type === 'suspend'}
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
