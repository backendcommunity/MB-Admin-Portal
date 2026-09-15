'use client';

import { type ReactNode, useState } from 'react';
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
import { SuperAdminOnly } from '@/components/shared/SuperAdminOnly';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ArchiveTeamDialog from '@/components/teams/ArchiveTeamDialog';
import { MembersTab } from '@/components/teams/tabs/MembersTab';
import { InvitesTab } from '@/components/teams/tabs/InvitesTab';
import { GroupsTab } from '@/components/teams/tabs/GroupsTab';
import { AssignmentsTab } from '@/components/teams/tabs/AssignmentsTab';
import { PathsTab } from '@/components/teams/tabs/PathsTab';
import { BillingTab } from '@/components/teams/tabs/BillingTab';
import { ReportsTab } from '@/components/teams/tabs/ReportsTab';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import {
  archiveTeam,
  fetchTeam,
  formatCurrency,
  renameTeam,
  restoreTeam,
  transferTeam,
} from '@/lib/api/teams';

const TABS = [
  ['overview', 'Overview'],
  ['members', 'Members'],
  ['invites', 'Invites'],
  ['groups', 'Groups'],
  ['assignments', 'Assignments'],
  ['paths', 'Paths'],
  ['billing', 'Billing'],
  ['reports', 'Reports'],
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
 * A SHELL: header, `StatRow`, `TabBar`, and a switch that renders one tab
 * component. Follows `ProjectDetailClient`'s pattern.
 *
 * Every tab a team can have ships in `TABS`, and every one renders a real
 * component now — Task 11 was the last of them (Billing, Reports). None are
 * disabled: a control a staff member cannot click for no visible reason
 * reads as broken.
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
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferring, setTransferring] = useState(false);

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
  // without this it would keep serving a stale row until it expires. Every
  // tab's own writes reuse this exact function as their `onChanged`, so a
  // role change or a revoked invite refreshes both places too.
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

  const doTransfer = async () => {
    if (!transferTarget) return;
    setTransferring(true);
    try {
      await transferTeam(id, transferTarget);
      toast.success('Ownership transferred. The outgoing owner is now ADMIN.');
      setTransferOpen(false);
      setTransferTarget('');
      invalidate();
    } catch (error) {
      toast.error('Could not transfer ownership', {
        description: extractErrorMessage(error, 'Unknown error'),
      });
    } finally {
      setTransferring(false);
    }
  };

  const activeMembers = data.members.filter((m) => m.status !== 'REMOVED');
  // Anyone active except whoever already owns the team — `transferTeam`
  // itself 409s a no-op transfer to the current owner, so there is no
  // reason to offer that choice in the picker.
  const transferCandidates = activeMembers.filter((m) => m.user?.id !== data.owner?.id);
  const isArchived = Boolean(data.archivedAt);
  // A plain function declaration doesn't inherit the `data`-is-defined
  // narrowing from the guards above (TypeScript doesn't carry control-flow
  // narrowing across a nested function boundary) — `team`'s own declared
  // type is `TeamDetail`, non-optional, regardless.
  const team = data;

  function renderTab(): ReactNode {
    switch (tab) {
      case 'overview':
        return (
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

            <div className="space-y-4">
              <Section title="Subscription" id="section-subscription">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{team.subscription?.status ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Paid seats</dt>
                    <dd>{team.subscription ? team.subscription.paidSeats : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Per-seat price</dt>
                    <dd>
                      {formatCurrency(
                        team.subscription?.amount ?? null,
                        team.subscription?.currency ?? null,
                      )}
                    </dd>
                  </div>
                </dl>
              </Section>

              <Section title="Ownership" id="section-ownership">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Owner</p>
                    <p className="font-medium">{team.owner?.name ?? '—'}</p>
                    {team.owner ? (
                      <p className="text-xs text-muted-foreground">{team.owner.email}</p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isArchived || transferCandidates.length === 0}
                    onClick={() => {
                      setTransferTarget('');
                      setTransferOpen(true);
                    }}
                  >
                    Transfer
                  </Button>
                </div>
              </Section>
            </div>
          </div>
        );
      case 'members':
        return (
          <MembersTab
            teamId={id}
            members={team.members}
            isArchived={isArchived}
            onChanged={invalidate}
            onInviteInstead={() => setTab('invites')}
          />
        );
      case 'invites':
        return (
          <InvitesTab
            teamId={id}
            seats={team.seats}
            seatPrice={{
              amount: team.subscription?.amount ?? null,
              currency: team.subscription?.currency ?? null,
            }}
            isArchived={isArchived}
            onChanged={invalidate}
          />
        );
      case 'groups':
        return (
          <GroupsTab
            teamId={id}
            members={team.members}
            isArchived={isArchived}
            onChanged={invalidate}
          />
        );
      case 'assignments':
        return (
          <AssignmentsTab
            teamId={id}
            members={team.members}
            isArchived={isArchived}
            onChanged={invalidate}
          />
        );
      case 'paths':
        return <PathsTab teamId={id} isArchived={isArchived} onChanged={invalidate} />;
      case 'billing':
        return (
          <BillingTab
            teamId={id}
            processor={team.processor}
            subscription={team.subscription}
            seatGap={team.seatGap}
            comped={team.comped}
            isArchived={isArchived}
            onChanged={invalidate}
          />
        );
      case 'reports':
        return <ReportsTab teamId={id} />;
      default:
        // Every `TabId` is handled above — `TABS` and this switch are kept
        // in lockstep, so this is unreachable in practice.
        return null;
    }
  }

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
            <SuperAdminOnly reason="Forbidden: super admin access required">
              <Button onClick={doRestore} disabled={restoring}>
                {restoring ? 'Restoring…' : 'Restore'}
              </Button>
            </SuperAdminOnly>
          ) : (
            <>
              <SuperAdminOnly reason="Forbidden: super admin access required">
                <Button variant="destructive" onClick={() => setArchiveOpen(true)}>
                  Archive team
                </Button>
              </SuperAdminOnly>
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
        <Alert className="mb-5">
          <AlertDescription>
            This team has {data.seatGap} spare seat{data.seatGap === 1 ? '' : 's'}. See the Billing
            tab for details.
          </AlertDescription>
        </Alert>
      ) : null}

      <TabBar tabs={TABS} value={tab} onChange={setTab} />

      {renderTab()}

      <ArchiveTeamDialog
        open={archiveOpen}
        teamName={data.name}
        memberCount={activeMembers.length}
        onClose={() => setArchiveOpen(false)}
        onConfirm={doArchive}
      />

      <Dialog open={transferOpen} onOpenChange={(next) => !next && setTransferOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Transfer ownership</DialogTitle>
            <DialogDescription>
              The new owner takes over immediately. {data.owner?.name ?? 'The current owner'}{' '}
              becomes ADMIN.
            </DialogDescription>
          </DialogHeader>
          <Field label="New owner" htmlFor="transfer-target" required>
            <Select value={transferTarget} onValueChange={setTransferTarget}>
              <SelectTrigger id="transfer-target">
                <SelectValue placeholder="Choose an active member" />
              </SelectTrigger>
              <SelectContent>
                {transferCandidates.map((m) => (
                  <SelectItem key={m.id} value={m.user!.id}>
                    {m.user?.name ?? m.user?.email ?? m.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferOpen(false)}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button onClick={doTransfer} disabled={transferring || !transferTarget}>
              {transferring ? 'Transferring…' : 'Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Named export kept alongside the default so the existing
// `import { TeamDetailClient } from '@/components/teams/TeamDetailClient'`
// in src/app/(app)/teams/[id]/page.tsx keeps working.
export { TeamDetailClient };
export default TeamDetailClient;
