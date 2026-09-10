'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Stat, StatRow } from '@/components/shared/Stat';
import { TabBar } from '@/components/shared/TabBar';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { Field, Section } from '@/components/shared/form/Section';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ArchiveTeamDialog from '@/components/teams/ArchiveTeamDialog';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import { archiveTeam, fetchTeam, formatCurrency, renameTeam, restoreTeam } from '@/lib/api/teams';

const TABS = [
  ['overview', 'Overview'],
  ['members', 'Members'],
] as const;

type TabId = (typeof TABS)[number][0];

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

function subscriptionTone(status: string | null): Tone {
  const s = (status ?? '').toLowerCase();
  if (s === 'active') return 'success';
  if (s === 'canceled' || s === 'past_due') return 'danger';
  if (s === 'paused') return 'warning';
  return 'neutral';
}

function memberStatusTone(status: string): Tone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'REMOVED') return 'neutral';
  return 'info';
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { message?: string } } };
  return anyErr.response?.data?.message || fallback;
}

/**
 * Follows `ProjectDetailClient`: breadcrumb, `PageHeader` with a badge,
 * a `StatRow`, a `TabBar`. Only Overview and Members ship in this slice —
 * Invites, Groups, Assignments, Paths, Billing and Reports arrive in later
 * slices and are deliberately not rendered here, even disabled.
 */
function TeamDetailClient() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-team', id],
    queryFn: () => fetchTeam(id),
    enabled: Boolean(id),
  });

  const [tab, setTab] = useState<TabId>('overview');
  const [showRemoved, setShowRemoved] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const [draft, setDraft] = useSeededForm(data?.id ?? 'none', () => ({
    name: data?.name ?? '',
  }));

  if (isLoading) {
    return <LoadingState label="Loading team…" />;
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <ErrorState message="Failed to load this team." onRetry={() => refetch()} />
        <Button variant="outline" size="sm" asChild>
          <Link href="/teams">← Back to teams</Link>
        </Button>
      </div>
    );
  }

  // Every write here touches a row the teams list also renders (name,
  // archived state, seats), and that list's query has its own staleTime —
  // without this it would keep serving a stale row until it expires.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
    refetch();
  };

  const save = async () => {
    setSaving(true);
    try {
      const nextName = draft.name.trim();
      if (nextName && nextName !== data.name) {
        await renameTeam(id, nextName);
      }
      toast.success('Saved.');
      invalidate();
    } catch (error) {
      toast.error('Could not save', { description: extractErrorMessage(error, 'Unknown error') });
    } finally {
      setSaving(false);
    }
  };

  const doArchive = async () => {
    try {
      await archiveTeam(id);
      toast.success('Team archived');
      setArchiveOpen(false);
      invalidate();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Could not archive the team'));
    }
  };

  const doRestore = async () => {
    setRestoring(true);
    try {
      await restoreTeam(id);
      toast.success('Team restored');
      invalidate();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Could not restore the team'));
    } finally {
      setRestoring(false);
    }
  };

  const activeMembers = data.members.filter((m) => m.status !== 'REMOVED');
  const visibleMembers = showRemoved ? data.members : activeMembers;
  const isArchived = Boolean(data.archivedAt);

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/teams" className="hover:text-foreground hover:underline">
          Teams
        </Link>{' '}
        / {data.name}
      </p>

      <PageHeader
        title={data.name}
        description={data.owner ? `Owned by ${data.owner.name} (${data.owner.email})` : undefined}
        badge={
          isArchived ? (
            <StatusBadge label="archived" tone="neutral" />
          ) : data.subscriptionStatus ? (
            <StatusBadge
              label={data.subscriptionStatus}
              tone={subscriptionTone(data.subscriptionStatus)}
            />
          ) : undefined
        }
        actions={
          isArchived ? (
            <Button onClick={doRestore} disabled={restoring}>
              {restoring ? 'Restoring…' : 'Restore'}
            </Button>
          ) : (
            <>
              <Button variant="destructive" onClick={() => setArchiveOpen(true)}>
                Archive team
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          )
        }
      />

      <StatRow>
        <Stat label="processor" value={data.processor ?? '—'} />
        <Stat
          label="paid seats"
          value={data.seats.subscribed ? String(data.seats.paidSeats) : '—'}
        />
        <Stat label="used" value={String(data.seats.used)} />
        <Stat label="pending invites" value={String(data.seats.pendingInvites)} />
        <Stat label="created" value={fmt(data.createdAt)} />
      </StatRow>

      {data.seatGap !== null ? (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>
            Seat mismatch: the last reconcile reported a gap of {data.seatGap}. This flags a
            discrepancy for staff to investigate — it is not a seat count.
          </AlertDescription>
        </Alert>
      ) : null}

      <TabBar tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Section title="Identity" id="section-identity">
            <Field label="Team name" htmlFor="team-name" required>
              <Input
                id="team-name"
                value={draft.name}
                onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
                disabled={isArchived}
              />
            </Field>
          </Section>

          <Section title="Subscription" id="section-subscription">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>{data.subscription?.status ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Paid seats</dt>
                <dd>{data.subscription ? data.subscription.paidSeats : '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Per-seat price</dt>
                <dd>
                  {formatCurrency(
                    data.subscription?.amount ?? null,
                    data.subscription?.currency ?? null,
                  )}
                </dd>
              </div>
            </dl>
          </Section>
        </div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Members</span>
            <label
              htmlFor="show-removed"
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <input
                id="show-removed"
                type="checkbox"
                checked={showRemoved}
                onChange={(event) => setShowRemoved(event.target.checked)}
              />
              Show removed
            </label>
          </div>
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
              {visibleMembers.map((m) => (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">{m.user?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.user?.email ?? '—'}</td>
                  <td className="px-4 py-3">{m.role}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={m.status} tone={memberStatusTone(m.status)} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(m.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleMembers.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No members found.</div>
          ) : null}
        </Card>
      )}

      <ArchiveTeamDialog
        open={archiveOpen}
        teamName={data.name}
        memberCount={activeMembers.length}
        onClose={() => setArchiveOpen(false)}
        onConfirm={doArchive}
      />
    </div>
  );
}

// Named export kept alongside the default so the existing
// `import { TeamDetailClient } from '@/components/teams/TeamDetailClient'`
// in src/app/(app)/teams/[id]/page.tsx keeps working.
export { TeamDetailClient };
export default TeamDetailClient;
