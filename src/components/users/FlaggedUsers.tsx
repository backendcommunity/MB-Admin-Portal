'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar, FLAG_REASONS, FlagList, filterByFlagReason } from '@/components/users/bits';
import { fetchFlagged } from '@/lib/api/users';

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function FlaggedUsers() {
  const router = useRouter();
  const [reason, setReason] = useState<string>('ALL');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users-flagged'],
    queryFn: fetchFlagged,
  });

  const rows = useMemo(() => filterByFlagReason(data?.data ?? [], reason), [data, reason]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Needs attention"
        description="Accounts an admin has to decide something about — unverified addresses, stalled onboarding, suspensions, forced resets and live trials."
        actions={
          <>
            <StatusBadge
              label={`${rows.length} flagged`}
              tone={rows.length ? 'warning' : 'success'}
            />
            <Button variant="outline" onClick={() => router.push('/users')}>
              All users
            </Button>
          </>
        }
      />

      <Select value={reason} onValueChange={setReason}>
        <SelectTrigger className="w-56" aria-label="Filter by reason">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FLAG_REASONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading ? <LoadingState /> : null}
      {isError ? <ErrorState onRetry={() => refetch()} /> : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <EmptyState
          title="Nothing to look at"
          description={
            reason === 'ALL' ? 'Every account is in good standing.' : 'Nothing matches that reason.'
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <Card className="divide-y p-0">
          {rows.map((user) => (
            <button
              key={user.id}
              type="button"
              className="flex w-full flex-wrap items-start gap-3 px-4 py-3 text-left hover:bg-muted/40"
              onClick={() => router.push(`/users/${user.id}`)}
            >
              <Avatar name={user.name} src={user.avatar} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{user.name || 'No name'}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                <span className="mt-1.5 block">
                  <FlagList flags={user.flags} />
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                signed up {fmt(user.createdAt)}
              </span>
            </button>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
