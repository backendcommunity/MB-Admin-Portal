'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { adminSetTeamSeats, fetchTeamDetail, formatCurrency } from '@/lib/api/teams';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

function subscriptionTone(status: string | null): Tone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'CANCELED') return 'danger';
  if (status === 'PAUSED') return 'warning';
  return 'neutral';
}

function memberStatusTone(status: string): Tone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'REMOVED') return 'neutral';
  return 'neutral';
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { message?: string } } };
  return anyErr.response?.data?.message || fallback;
}

export function TeamDetailClient() {
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();
  const [seatsInput, setSeatsInput] = useState('');

  const {
    data: team,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['team', id],
    queryFn: () => fetchTeamDetail(id),
    enabled: Boolean(id),
  });

  // Only AsyncPay teams need staff-adjusted seats — Paddle teams self-serve
  // through the customer-facing purchase flow, and this endpoint exists
  // specifically for the processor that has no self-serve path at all.
  const setSeats = useMutation({
    mutationFn: (seats: number) => adminSetTeamSeats(id, seats),
    onSuccess: () => {
      toast.success('Seats updated');
      setSeatsInput('');
      qc.invalidateQueries({ queryKey: ['team', id] });
    },
    onError: (err: unknown) => {
      // The 409 body names the exact usage figure ("already has N seats in
      // use") — surface it verbatim rather than a generic failure toast.
      toast.error(extractErrorMessage(err, 'Failed to update seats'));
    },
  });

  if (isLoading) {
    return <LoadingState label="Loading team…" />;
  }

  if (isError || !team) {
    return (
      <div className="space-y-4">
        <ErrorState message="Failed to load this team." onRetry={refetch} />
        <Button variant="outline" size="sm" asChild>
          <Link href="/teams">← Back to teams</Link>
        </Button>
      </div>
    );
  }

  const isAsyncpay = team.processor === 'ASYNCPAY';

  return (
    <div className="space-y-6">
      <PageHeader
        title={team.name}
        description={team.owner ? `Owned by ${team.owner.name} (${team.owner.email})` : undefined}
        actions={
          team.subscription?.status ? (
            <StatusBadge
              label={team.subscription.status}
              tone={subscriptionTone(team.subscription.status)}
            />
          ) : undefined
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Processor', value: team.processor ?? '—' },
          { label: 'Seats used', value: `${team.usage.used} / ${team.usage.paidSeats}` },
          { label: 'Pending invites', value: team.usage.pendingInvites },
          {
            label: 'Per-seat price',
            value: formatCurrency(
              team.subscription?.amount ?? null,
              team.subscription?.currency ?? null,
            ),
          },
        ].map(({ label, value }) => (
          <Card key={label} className="flex flex-col items-center p-4 text-center">
            <span className="text-xl font-bold">{value}</span>
            <span className="mt-1 text-xs text-muted-foreground">{label}</span>
          </Card>
        ))}
      </div>

      {/* Seat adjustment — AsyncPay only. This is the sales-led path: NG
          owners have no self-serve purchase flow, so staff set the number
          directly here. */}
      {isAsyncpay ? (
        <Card className="p-4 sm:p-6">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Adjust seats</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            AsyncPay has no self-serve purchase flow — set the funded seat count directly. This
            refuses if it is below the {team.usage.used} seat{team.usage.used === 1 ? '' : 's'}{' '}
            currently in use.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="seats-input">New seat count</Label>
              <Input
                id="seats-input"
                type="number"
                min={1}
                className="w-32"
                value={seatsInput}
                onChange={(e) => setSeatsInput(e.target.value)}
                placeholder={String(team.usage.paidSeats)}
              />
            </div>
            <Button
              size="sm"
              disabled={setSeats.isPending || !seatsInput}
              onClick={() => {
                const seats = Number(seatsInput);
                if (!Number.isInteger(seats) || seats < 1) {
                  toast.error('Enter a whole number of at least 1');
                  return;
                }
                setSeats.mutate(seats);
              }}
            >
              {setSeats.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Members */}
      <Card className="overflow-x-auto p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold text-foreground">Members</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((m) => (
              <tr key={m.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3">{m.user?.name ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.user?.email ?? '—'}</td>
                <td className="px-4 py-3">{m.role}</td>
                <td className="px-4 py-3">
                  <StatusBadge label={m.status} tone={memberStatusTone(m.status)} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {team.members.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No members found.</div>
        )}
      </Card>

      {/* Pending invites */}
      <Card className="overflow-x-auto p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold text-foreground">
          Pending invites
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Invited</th>
              <th className="px-4 py-3">Expires</th>
            </tr>
          </thead>
          <tbody>
            {team.pendingInvites.map((invite) => (
              <tr key={invite.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3">{invite.email}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {invite.createdAt ? new Date(invite.createdAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {team.pendingInvites.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No pending invites.</div>
        )}
      </Card>

      <div className="flex">
        <Button variant="outline" size="sm" asChild>
          <Link href="/teams">← Back to teams</Link>
        </Button>
      </div>
    </div>
  );
}
