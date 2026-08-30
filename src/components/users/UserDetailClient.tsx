'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { Stat, StatRow } from '@/components/shared/Stat';
import { TabBar } from '@/components/shared/TabBar';
import { Field, FieldGrid, Section } from '@/components/shared/form/Section';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import GrantAccessDialog from '@/components/users/GrantAccessDialog';
import SuspendDialog from '@/components/users/SuspendDialog';
import { Avatar, FlagList, accessTone, roleTone, statusTone } from '@/components/users/bits';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import {
  EXPERIENCE,
  LANGUAGES,
  ROLES,
  deleteUser,
  fetchBilling,
  fetchEntitlements,
  fetchUser,
  fetchUserActivity,
  fetchUserTeams,
  removeUserFromTeam,
  setUserTeamRole,
  requirePasswordReset,
  restoreUser,
  revokeEntitlement,
  updateUser,
  updateUserRole,
  type Role,
  type UserDetail,
  type UserInput,
} from '@/lib/api/users';

const ENTITLEMENTS_PER_PAGE = 25;
const PAYMENTS_PER_PAGE = 25;
const ACTIVITY_PER_PAGE = 25;

const TABS = [
  ['profile', 'Profile'],
  ['access', 'Access'],
  ['progress', 'Progress'],
  ['billing', 'Billing'],
  ['teams', 'Teams'],
  ['security', 'Security'],
  ['activity', 'Activity'],
] as const;

type TabId = (typeof TABS)[number][0];

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function UserDetailClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params.id;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => fetchUser(userId),
  });

  const [tab, setTab] = useState<TabId>('profile');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [granting, setGranting] = useState(false);

  // Re-seeded from the server copy, so a refetch that changed nothing does not
  // throw away what is being typed.
  const serverKey = data
    ? JSON.stringify([
        data.name,
        data.email,
        data.username,
        data.avatar,
        data.profile,
        data.onboarding,
      ])
    : 'none';
  const [draft, setDraft] = useSeededForm(serverKey, () => ({
    name: data?.name ?? '',
    email: data?.email ?? '',
    username: data?.username ?? '',
    // Avatar sits on the row rather than inside `profile`, but it belongs with
    // the other identity fields on this form.
    avatar: data?.avatar ?? '',
    ...(data?.profile ?? {
      title: '',
      bio: '',
      country: '',
      phone: '',
      address: '',
      website: '',
      github: '',
      githubProfileUrl: '',
      linkedin: '',
      twitter: '',
      resume: '',
      openToWork: false,
    }),
    experienceLevel: data?.onboarding.experienceLevel ?? '',
    learningGoal: data?.onboarding.learningGoal ?? '',
    weeklyCommitment: data?.onboarding.weeklyCommitment ?? '',
    preferredLanguage: data?.onboarding.preferredLanguage ?? '',
    hasFinishedOnboarding: data?.onboarding.hasFinishedOnboarding ?? false,
  }));

  const dirty = useMemo(() => {
    if (!data) return false;
    return (
      JSON.stringify(draft) !==
      JSON.stringify({
        name: data.name,
        email: data.email,
        username: data.username,
        avatar: data.avatar,
        ...data.profile,
        experienceLevel: data.onboarding.experienceLevel,
        learningGoal: data.onboarding.learningGoal,
        weeklyCommitment: data.onboarding.weeklyCommitment,
        preferredLanguage: data.onboarding.preferredLanguage,
        hasFinishedOnboarding: data.onboarding.hasFinishedOnboarding,
      })
    );
  }, [data, draft]);

  const save = async () => {
    if (!draft.name.trim() || !draft.email.trim()) {
      toast.error('A user needs a name and an email.');
      return;
    }
    setSaving(true);
    try {
      await updateUser(userId, draft as UserInput);
      toast.success('Saved.');
      refetch();
    } catch (error) {
      toast.error('Could not save', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (role: Role) => {
    try {
      await updateUserRole(userId, role);
      toast.success(`Role is now ${role}.`);
      refetch();
    } catch (error) {
      // A 409 here is the last-admin guard: demoting them locks the console.
      toast.error('Could not change the role', { description: (error as Error).message });
    }
  };

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/users" className="hover:text-foreground hover:underline">
          Users
        </Link>{' '}
        / {data.name || data.email}
      </p>

      <PageHeader
        title={data.name || 'No name'}
        subtitle={data.email}
        badge={
          <span className="flex items-center gap-2">
            <StatusBadge label={data.role} tone={roleTone(data.role)} />
            <StatusBadge label={data.status} tone={statusTone(data.status)} />
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => router.push('/users')}>
              Back
            </Button>
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      />

      {data.flags.length ? (
        <Card className="mb-5 border-warning bg-warning-wash/40 p-4">
          <FlagList flags={data.flags} />
        </Card>
      ) : null}

      <StatRow>
        <Stat label="points" value={data.progress.points.toLocaleString()} />
        <Stat label="level" value={String(data.progress.level)} />
        <Stat label="streak" value={`${data.progress.currentStreak} d`} />
        <Stat label="longest" value={`${data.progress.longestStreak} d`} />
        <Stat label="courses" value={String(data.progress.courses)} />
        <Stat label="cohorts" value={String(data.progress.cohorts)} />
        <Stat label="projects" value={String(data.progress.projects)} />
        <Stat label="badges" value={String(data.progress.achievements)} />
      </StatRow>

      <TabBar tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'profile' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <Section title="Identity" id="section-identity">
              <FieldGrid>
                <Field label="Name" htmlFor="u-name" required>
                  <Input
                    id="u-name"
                    value={draft.name}
                    onChange={(e) => set('name', e.target.value)}
                  />
                </Field>
                <Field label="Email" htmlFor="u-email" required hint="Unique across every account.">
                  <Input
                    id="u-email"
                    value={draft.email}
                    onChange={(e) => set('email', e.target.value)}
                  />
                </Field>
                <Field
                  label="Username"
                  htmlFor="u-username"
                  hint="Not unique in the schema — two people can hold the same one."
                >
                  <Input
                    id="u-username"
                    value={draft.username}
                    onChange={(e) => set('username', e.target.value)}
                  />
                </Field>
                <Field label="Job title" htmlFor="u-title">
                  <Input
                    id="u-title"
                    value={draft.title}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder="Senior Backend Engineer"
                  />
                </Field>
                <Field label="Country" htmlFor="u-country">
                  <Input
                    id="u-country"
                    value={draft.country}
                    onChange={(e) => set('country', e.target.value)}
                  />
                </Field>
                <Field label="Phone" htmlFor="u-phone">
                  <Input
                    id="u-phone"
                    value={draft.phone}
                    onChange={(e) => set('phone', e.target.value)}
                  />
                </Field>
              </FieldGrid>

              <Field label="Bio" htmlFor="u-bio">
                <textarea
                  id="u-bio"
                  value={draft.bio}
                  onChange={(e) => set('bio', e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Address" htmlFor="u-address" hint="Used on invoices.">
                <textarea
                  id="u-address"
                  value={draft.address}
                  onChange={(e) => set('address', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Avatar URL" htmlFor="u-avatar">
                <Input
                  id="u-avatar"
                  value={draft.avatar}
                  onChange={(e) => set('avatar', e.target.value)}
                />
              </Field>
            </Section>

            <Section title="Links" id="section-links">
              <FieldGrid>
                <Field label="Website" htmlFor="u-website">
                  <Input
                    id="u-website"
                    value={draft.website}
                    onChange={(e) => set('website', e.target.value)}
                  />
                </Field>
                <Field label="GitHub profile" htmlFor="u-ghurl">
                  <Input
                    id="u-ghurl"
                    value={draft.githubProfileUrl}
                    onChange={(e) => set('githubProfileUrl', e.target.value)}
                  />
                </Field>
                <Field label="LinkedIn" htmlFor="u-li" hint="A handle, not a URL.">
                  <Input
                    id="u-li"
                    value={draft.linkedin}
                    onChange={(e) => set('linkedin', e.target.value)}
                  />
                </Field>
                <Field label="Twitter / X" htmlFor="u-tw" hint="A handle, not a URL.">
                  <Input
                    id="u-tw"
                    value={draft.twitter}
                    onChange={(e) => set('twitter', e.target.value)}
                  />
                </Field>
              </FieldGrid>

              <Field
                label="Résumé"
                htmlFor="u-resume"
                hint="Uploaded by the learner, stored in R2."
              >
                <Input
                  id="u-resume"
                  value={draft.resume}
                  onChange={(e) => set('resume', e.target.value)}
                />
              </Field>

              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span>
                  <span className="block text-sm font-medium">Open to work</span>
                  <span className="block text-xs text-muted-foreground">
                    Shows a badge on their profile and surfaces them to hiring partners.
                  </span>
                </span>
                <Switch
                  checked={draft.openToWork}
                  onCheckedChange={(next) => set('openToWork', next)}
                  aria-label="Open to work"
                />
              </label>
            </Section>

            <Section title="Onboarding" id="section-onboarding">
              <FieldGrid>
                <Field label="Experience" htmlFor="u-exp">
                  <Select
                    value={draft.experienceLevel || 'unset'}
                    onValueChange={(v) => set('experienceLevel', v === 'unset' ? '' : v)}
                  >
                    <SelectTrigger id="u-exp">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not set</SelectItem>
                      {EXPERIENCE.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Preferred language" htmlFor="u-lang">
                  <Select
                    value={draft.preferredLanguage || 'unset'}
                    onValueChange={(v) => set('preferredLanguage', v === 'unset' ? '' : v)}
                  >
                    <SelectTrigger id="u-lang">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not set</SelectItem>
                      {LANGUAGES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Goal" htmlFor="u-goal">
                  <Input
                    id="u-goal"
                    value={draft.learningGoal}
                    onChange={(e) => set('learningGoal', e.target.value)}
                  />
                </Field>
                <Field label="Weekly commitment" htmlFor="u-commit">
                  <Input
                    id="u-commit"
                    value={draft.weeklyCommitment}
                    onChange={(e) => set('weeklyCommitment', e.target.value)}
                  />
                </Field>
              </FieldGrid>

              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span>
                  <span className="block text-sm font-medium">Finished onboarding</span>
                  <span className="block text-xs text-muted-foreground">
                    {data.onboarding.completedAt
                      ? `Completed ${fmt(data.onboarding.completedAt)}.`
                      : data.onboarding.skippedAt
                        ? `Skipped ${fmt(data.onboarding.skippedAt)}.`
                        : 'Never finished — no recommendation was generated.'}
                  </span>
                </span>
                <Switch
                  checked={draft.hasFinishedOnboarding}
                  onCheckedChange={(next) => set('hasFinishedOnboarding', next)}
                  aria-label="Finished onboarding"
                />
              </label>
            </Section>

            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Section title="Account">
              <div className="flex items-center gap-3">
                <Avatar name={data.name} src={data.avatar} size="lg" />
                <div className="min-w-0 text-xs text-muted-foreground">
                  <p className="truncate">Signed up {fmt(data.createdAt)}</p>
                  <p className="truncate">Last active {fmt(data.lastActivityAt)}</p>
                  <p className="truncate lowercase">via {data.signedUpThrough}</p>
                </div>
              </div>
            </Section>
          </aside>
        </div>
      ) : null}

      {tab === 'access' ? (
        <AccessTab
          user={data}
          onChanged={refetch}
          onRole={changeRole}
          onGrant={() => setGranting(true)}
        />
      ) : null}

      {tab === 'progress' ? <ProgressTab user={data} /> : null}

      {tab === 'billing' ? <BillingTab userId={userId} /> : null}

      {tab === 'teams' ? <TeamsTab userId={userId} /> : null}

      {tab === 'security' ? (
        <SecurityTab
          user={data}
          onChanged={refetch}
          onSuspend={() => setSuspendOpen(true)}
          onDelete={() => setConfirming(true)}
        />
      ) : null}

      {tab === 'activity' ? <ActivityTab userId={userId} user={data} /> : null}

      <SuspendDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        user={data}
        onChanged={refetch}
      />

      <GrantAccessDialog
        open={granting}
        onOpenChange={setGranting}
        userId={userId}
        onGranted={refetch}
      />

      <ConfirmDelete
        open={confirming}
        onCancel={() => setConfirming(false)}
        title={`Delete ${data.email}?`}
        description="A soft delete: the account stops working and can be restored, until the purge job removes it permanently."
        onConfirm={async () => {
          setConfirming(false);
          try {
            await deleteUser(userId);
            toast.success('Deleted.', { description: 'Restorable until the purge job runs.' });
            refetch();
          } catch (error) {
            toast.error('Could not delete it', { description: (error as Error).message });
          }
        }}
      />
    </div>
  );
}

// ── access ──────────────────────────────────────────────────────────────────

function AccessTab({
  user,
  onChanged,
  onRole,
  onGrant,
}: {
  user: UserDetail;
  onChanged: () => void;
  onRole: (role: Role) => void;
  onGrant: () => void;
}) {
  const [page, setPage] = useState(1);
  const [itemType, setItemType] = useState('ALL');
  const [source, setSource] = useState('ALL');

  const { data, refetch } = useQuery({
    queryKey: ['admin-user-entitlements', user.id, page, itemType, source],
    queryFn: () =>
      fetchEntitlements(user.id, {
        page,
        limit: ENTITLEMENTS_PER_PAGE,
        ...(itemType !== 'ALL' ? { itemType } : {}),
        ...(source !== 'ALL' ? { source } : {}),
      }),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / ENTITLEMENTS_PER_PAGE));
  // The breakdown counts everything they hold, so filtering never hides the
  // option that would un-filter it.
  const types = [...new Set((data?.breakdown ?? []).map((b) => b.itemType))];
  const sources = [...new Set((data?.breakdown ?? []).map((b) => b.source))];

  const setFlag = async (key: 'isPremium' | 'isTrial', value: boolean) => {
    try {
      await updateUser(user.id, { [key]: value });
      onChanged();
    } catch (error) {
      toast.error('Could not change it', { description: (error as Error).message });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <Section title="Role and standing">
          <Field
            label="Role"
            htmlFor="u-role"
            required
            hint="USER learns, INSTRUCTOR also reviews assignments, ADMIN reaches this console."
          >
            <Select value={user.role} onValueChange={(value) => onRole(value as Role)}>
              <SelectTrigger id="u-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">Premium</span>
              <span className="block text-xs text-muted-foreground">
                A flag on the user, separate from whether a subscription is actually live.
              </span>
            </span>
            <Switch
              checked={user.isPremium}
              onCheckedChange={(next) => setFlag('isPremium', next)}
              aria-label="Premium"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">On trial</span>
              <span className="block text-xs text-muted-foreground">
                Set while a trial runs. Nothing clears it when the trial lapses.
              </span>
            </span>
            <Switch
              checked={user.isTrial}
              onCheckedChange={(next) => setFlag('isTrial', next)}
              aria-label="On trial"
            />
          </label>
        </Section>

        <Card className="overflow-hidden p-0">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Entitlements
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                One row per thing they can open, and why it is open to them. The left chip is what
                it is; “via …” is what granted it — a path enrolment grants every course in the
                path, so most rows read “course · via roadmap”.
              </p>
            </div>
            <Button size="sm" onClick={onGrant}>
              Grant access
            </Button>
          </div>

          {total > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <span className="text-xs text-muted-foreground">
                {total} entitlement{total === 1 ? '' : 's'}
              </span>
              <Select
                value={itemType}
                onValueChange={(value) => {
                  setItemType(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-auto min-w-32 text-xs" aria-label="Filter by type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any type</SelectItem>
                  {types.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.replace(/_/g, ' ').toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={source}
                onValueChange={(value) => {
                  setSource(value);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-auto min-w-32 text-xs"
                  aria-label="Filter by source"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any source</SelectItem>
                  {sources.map((value) => (
                    <SelectItem key={value} value={value}>
                      via {value.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No entitlements. They can only reach free content.
            </p>
          ) : (
            <div className="divide-y">
              {rows.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <StatusBadge
                    label={row.itemType.replace(/_/g, ' ').toLowerCase()}
                    tone="neutral"
                  />

                  {/* The title leads. Every entitlement here comes from a path
                      enrolment, so `source` is identical on every row and the
                      thing it points at is the only part that distinguishes
                      them. */}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {row.itemTitle || <span className="text-muted-foreground">Deleted item</span>}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {row.itemId}
                    </span>
                  </span>

                  {/* `source` is WHY they have it, not what it is — a path
                      enrolment granting every course in the path reads as
                      "course … roadmap" otherwise, which looks like a
                      contradiction. */}
                  <StatusBadge
                    label={`via ${row.source.toLowerCase()}`}
                    tone={row.source === 'ADMIN' ? 'warning' : 'info'}
                  />
                  {row.expiresAt ? (
                    <span className="text-xs text-muted-foreground">
                      until {fmt(row.expiresAt)}
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={async () => {
                      try {
                        await revokeEntitlement(user.id, row.id);
                        toast.success('Grant revoked.');
                        refetch();
                      } catch (error) {
                        // Anything but an ADMIN grant is owned by its source.
                        toast.error('Could not revoke it', {
                          description: (error as Error).message,
                        });
                      }
                    }}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}

          {pages > 1 ? (
            <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                Page {page} of {pages}
              </span>
              <span className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </span>
            </div>
          ) : null}
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Section title="Subscription">
          {user.subscription ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {user.subscription.plan ?? user.subscription.name ?? 'Subscription'}
                </span>
                <StatusBadge
                  label={user.subscription.status || 'unknown'}
                  tone={
                    user.subscription.status === 'active'
                      ? 'success'
                      : user.subscription.status === 'trialing'
                        ? 'warning'
                        : 'neutral'
                  }
                />
              </div>

              <dl className="space-y-2 text-xs">
                <Row
                  label="Amount"
                  value={
                    user.subscription.amount
                      ? `${user.subscription.amount} ${user.subscription.currency ?? ''}`.trim()
                      : 'Free'
                  }
                />
                <Row label="Started" value={fmt(user.subscription.startedAt)} />
                <Row label="Renews / ends" value={fmt(user.subscription.expiry)} />
                {user.subscription.channel ? (
                  <Row label="Processor" value={user.subscription.channel} />
                ) : null}
                {user.subscription.card ? (
                  <Row
                    label="Card"
                    value={`${user.subscription.card.brand} ···· ${user.subscription.card.last4}${
                      user.subscription.card.expires ? ` · ${user.subscription.card.expires}` : ''
                    }`}
                  />
                ) : null}
              </dl>

              {user.subscription.externalId ? (
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {user.subscription.externalId}
                </p>
              ) : null}

              {/* A user can hold several over time, and the history answers
                  "when did they last pay". */}
              {user.subscriptions.length > 1 ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    {user.subscriptions.length - 1} earlier subscription
                    {user.subscriptions.length === 2 ? '' : 's'}
                  </summary>
                  <div className="mt-2 space-y-2">
                    {user.subscriptions
                      .filter((row) => row.id !== user.subscription?.id)
                      .map((row) => (
                        <div key={row.id} className="flex justify-between gap-2">
                          <span className="truncate text-muted-foreground">
                            {row.plan ?? row.name}
                          </span>
                          <span className="shrink-0">
                            {row.status} · {fmt(row.startedAt)}
                          </span>
                        </div>
                      ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No subscription.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Owned by billing — plans, cancellations and refunds are changed there.
          </p>
        </Section>

        {user.teams.length ? (
          <Section title="Teams">
            <dl className="space-y-2 text-xs">
              {user.teams.map((team) => (
                <Row key={team.id} label={team.name} value={`${team.role} · ${team.status}`} />
              ))}
            </dl>
          </Section>
        ) : null}
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}

// ── progress ────────────────────────────────────────────────────────────────

function ProgressTab({ user }: { user: UserDetail }) {
  const p = user.progress;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <>
        <Section title="Standing">
          <dl className="space-y-2 text-sm">
            <Row label="Points" value={p.points.toLocaleString()} />
            <Row label="Level" value={String(p.level)} />
            <Row label="League tier" value={p.league ?? 'Not placed'} />
            <Row label="Badges earned" value={String(p.achievements)} />
          </dl>
        </Section>

        <Section title="Streak">
          <dl className="space-y-2 text-sm">
            <Row label="Current" value={`${p.currentStreak} days`} />
            <Row label="Longest" value={`${p.longestStreak} days`} />
            <Row label="Last counted" value={fmt(p.lastStreakDate)} />
          </dl>
        </Section>

        <Section title="Enrolments">
          <dl className="space-y-2 text-sm">
            <Row label="Courses" value={String(p.courses)} />
            <Row label="Paths" value={String(p.roadmaps)} />
            <Row label="Bootcamp cohorts" value={String(p.cohorts)} />
            <Row label="Projects" value={String(p.projects)} />
          </dl>
        </Section>
      </>
    </div>
  );
}

// ── billing ─────────────────────────────────────────────────────────────────

function money(amount: number, currency?: string | null) {
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${
    currency ? ` ${currency}` : ''
  }`;
}

function BillingTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState('ALL');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-user-billing', userId, page, provider],
    queryFn: () =>
      fetchBilling(userId, {
        page,
        limit: PAYMENTS_PER_PAGE,
        ...(provider !== 'ALL' ? { provider } : {}),
      }),
  });

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const ledger = data.transactions;
  const pages = Math.max(1, Math.ceil(ledger.total / PAYMENTS_PER_PAGE));
  const providers = [...new Set(ledger.data.map((row) => row.provider))];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Transactions
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Every charge, refund and chargeback on the account, from the payment ledger.
              </p>
            </div>
            {providers.length > 1 || provider !== 'ALL' ? (
              <Select
                value={provider}
                onValueChange={(value) => {
                  setProvider(value);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-auto min-w-32 text-xs"
                  aria-label="Filter by processor"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any processor</SelectItem>
                  {providers.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          {ledger.data.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Nothing on the ledger for this account.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted">
                  <tr>
                    {['When', 'Processor', 'Reference', 'Gross', 'Fee', 'Tax', 'Net', ''].map(
                      (head, index) => (
                        <th
                          key={head || index}
                          className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground ${
                            ['Gross', 'Fee', 'Tax', 'Net'].includes(head)
                              ? 'text-right'
                              : 'text-left'
                          }`}
                        >
                          {head}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ledger.data.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-sm">
                        <div>{fmt(row.createdAt)}</div>
                        <div className="text-xs text-muted-foreground">
                          {[row.kind.toLowerCase(), row.interval?.toLowerCase()]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{row.provider}</td>
                      <td className="max-w-48 truncate px-4 py-3 font-mono text-[11px] text-muted-foreground">
                        {row.invoice}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums">
                        {money(row.gross, row.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                        {row.fee ? money(row.fee) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                        {row.tax ? money(row.tax) : '—'}
                      </td>
                      {/* Net is signed, so a refund shows as a negative and the
                          column adds up to what was actually kept. */}
                      <td
                        className={`px-4 py-3 text-right text-sm font-medium tabular-nums ${
                          row.amount < 0 ? 'text-destructive' : ''
                        }`}
                      >
                        {money(row.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={row.status.toLowerCase()}
                          tone={
                            row.status === 'SETTLED'
                              ? 'success'
                              : row.status === 'FAILED'
                                ? 'danger'
                                : 'warning'
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 ? (
            <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                Page {page} of {pages} · {ledger.total} transaction
                {ledger.total === 1 ? '' : 's'}
              </span>
              <span className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </span>
            </div>
          ) : null}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Subscriptions
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every one they have held, newest first.
            </p>
          </div>
          {data.subscriptions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Never subscribed.</p>
          ) : (
            <div className="divide-y">
              {data.subscriptions.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{row.plan ?? row.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[
                        row.startedAt ? `from ${fmt(row.startedAt)}` : null,
                        row.expiry ? `to ${fmt(row.expiry)}` : null,
                        row.channel,
                        row.card ? `${row.card.brand} ···· ${row.card.last4}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="tabular-nums">{money(row.amount, row.currency)}</span>
                  <StatusBadge
                    label={row.status || 'unknown'}
                    tone={
                      row.status === 'active'
                        ? 'success'
                        : row.status === 'trialing'
                          ? 'warning'
                          : 'neutral'
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        {data.purchases.length > 0 ? (
          <Card className="overflow-hidden p-0">
            <div className="border-b px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Bundles
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A preview is a look at one, not ownership of it.
              </p>
            </div>
            <div className="divide-y">
              {data.purchases.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{row.title || 'Offer'}</span>
                    <span className="block text-xs text-muted-foreground">
                      redeemed {fmt(row.redeemedAt)}
                    </span>
                  </span>
                  <span className="tabular-nums">{money(row.amount)}</span>
                  {row.isPreview ? <StatusBadge label="preview" tone="warning" /> : null}
                  {row.isCompleted ? <StatusBadge label="completed" tone="success" /> : null}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {data.receipts.length > 0 ? (
          <details className="rounded-xl border bg-card">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {data.receipts.length} legacy receipt{data.receipts.length === 1 ? '' : 's'}
            </summary>
            <p className="px-4 pb-2 text-xs text-muted-foreground">
              Written before the payment ledger existed. They carry no currency, so they are listed
              for reference and never counted towards revenue.
            </p>
            <div className="divide-y border-t">
              {data.receipts.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm">{row.title || 'Payment'}</span>
                  <span className="text-xs text-muted-foreground">{fmt(row.createdAt)}</span>
                  <span className="tabular-nums">{money(row.amount)}</span>
                  <StatusBadge
                    label={row.status || 'no status'}
                    tone={row.status === 'paid' ? 'success' : 'neutral'}
                  />
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Section title="Revenue">
          {data.revenue.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing has settled on the ledger.</p>
          ) : (
            data.revenue.map((row) => (
              <div key={row.currency} className="space-y-1.5 border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-semibold tabular-nums">
                    {money(row.net, row.currency)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.payments} payment{row.payments === 1 ? '' : 's'}
                  </span>
                </div>
                <dl className="space-y-1 text-xs">
                  <Row label="Gross" value={money(row.gross)} />
                  <Row label="Processor fee" value={money(row.fee)} />
                  <Row label="Tax" value={money(row.tax)} />
                </dl>
              </div>
            ))
          )}
          {/* Adding an NGN charge to a USD one produces a number that means
              nothing, so admin revenue reporting never converts between them. */}
          <p className="text-xs text-muted-foreground">
            Each currency is totalled natively — nothing is converted. Net is signed, so refunds
            subtract.
          </p>
        </Section>
      </aside>
    </div>
  );
}

// ── teams ───────────────────────────────────────────────────────────────────

const TEAM_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;

function TeamsTab({ userId }: { userId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-user-teams', userId],
    queryFn: () => fetchUserTeams(userId),
  });
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const act = async (label: string, run: () => Promise<unknown>, teamId: string) => {
    setBusy(teamId);
    try {
      await run();
      toast.success(label);
      refetch();
    } catch (error) {
      // A 409 here is the ownership rule: ownership moves by transfer.
      toast.error('Could not do that', { description: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="space-y-4">
        {data.length === 0 ? (
          <EmptyState
            title="Not in any team"
            description="They neither own a team nor belong to one."
          />
        ) : (
          data.map((team) => (
            <Card key={team.teamId} className="overflow-hidden p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold">{team.name}</h2>
                    <StatusBadge
                      label={team.role.toLowerCase() || 'member'}
                      tone={team.isOwner ? 'danger' : team.role === 'ADMIN' ? 'info' : 'neutral'}
                    />
                    {team.status !== 'ACTIVE' ? (
                      <StatusBadge label={team.status.toLowerCase()} tone="warning" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {team.counts.members} member{team.counts.members === 1 ? '' : 's'} ·{' '}
                    {team.counts.groups} group{team.counts.groups === 1 ? '' : 's'} ·{' '}
                    {team.counts.assignments} assignment
                    {team.counts.assignments === 1 ? '' : 's'}
                    {team.counts.invites ? ` · ${team.counts.invites} pending invite` : ''}
                  </p>
                </div>
                <Link
                  href={`/teams/${team.teamId}`}
                  className="shrink-0 text-xs text-primary underline underline-offset-2"
                >
                  Open the team
                </Link>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <dl className="space-y-2 text-xs">
                  <Row label="Owner" value={team.owner?.email ?? '—'} />
                  <Row label="Joined" value={fmt(team.joinedAt)} />
                  <Row
                    label="Subscription"
                    value={
                      team.subscription
                        ? `${team.subscription.plan ?? 'Plan'} · ${team.subscription.status}`
                        : 'None'
                    }
                  />
                </dl>

                <div className="space-y-2">
                  {team.isOwner ? (
                    // The team's own routes refuse this too — ownership moves by
                    // transfer, or the team ends up with two owners or none.
                    <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                      They own this team. Transfer ownership before changing their role or removing
                      them.
                    </p>
                  ) : (
                    <>
                      <Field label="Role in this team" htmlFor={`role-${team.teamId}`}>
                        <Select
                          value={team.role || 'MEMBER'}
                          onValueChange={(value) =>
                            act(
                              `Role in ${team.name} is now ${value}.`,
                              () => setUserTeamRole(userId, team.teamId, value),
                              team.teamId,
                            )
                          }
                        >
                          <SelectTrigger id={`role-${team.teamId}`} disabled={busy === team.teamId}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TEAM_ROLES.filter((role) => role !== 'OWNER').map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      {team.status === 'ACTIVE' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          disabled={busy === team.teamId}
                          onClick={() =>
                            act(
                              `Removed from ${team.name}.`,
                              () => removeUserFromTeam(userId, team.teamId),
                              team.teamId,
                            )
                          }
                        >
                          Remove from this team
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Already removed. Their history is kept — a re-invite makes them active
                          again.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ── security ────────────────────────────────────────────────────────────────

function SecurityTab({
  user,
  onChanged,
  onSuspend,
  onDelete,
}: {
  user: UserDetail;
  onChanged: () => void;
  onSuspend: () => void;
  onDelete: () => void;
}) {
  const s = user.security;
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <Section title="Sign-in">
          <dl className="space-y-2 text-sm">
            <Row label="Signed up through" value={s.signedUpThrough} />
            <Row label="Password set" value={s.hasPassword ? 'Yes' : 'No — social sign-in only'} />
            <Row label="Email confirmed" value={user.emailConfirmed ? 'Yes' : 'No'} />
            {s.githubId ? <Row label="GitHub id" value={s.githubId} /> : null}
            {s.twitterId ? <Row label="Twitter id" value={s.twitterId} /> : null}
            {s.authId ? <Row label="OAuth id" value={s.authId} /> : null}
            {s.githubConnectionStatus ? (
              <Row label="GitHub connection" value={s.githubConnectionStatus} />
            ) : null}
          </dl>
        </Section>

        <Section title="Account actions">
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">Email confirmed</span>
              <span className="block text-xs text-muted-foreground">
                Confirming by hand skips verification. Do it only when you trust the address another
                way.
              </span>
            </span>
            <Switch
              checked={user.emailConfirmed}
              onCheckedChange={async (next) => {
                try {
                  await updateUser(user.id, { emailConfirmed: next });
                  onChanged();
                } catch (error) {
                  toast.error('Could not change it', { description: (error as Error).message });
                }
              }}
              aria-label="Email confirmed"
            />
          </label>

          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Password reset</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {s.mustResetPassword
                ? 'Already flagged — they must set a new password at next sign-in.'
                : s.hasPassword
                  ? 'Flags the account so the next sign-in has to set a new password.'
                  : `No password to reset — this account signs in through ${s.signedUpThrough}.`}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={busy || !s.hasPassword || s.mustResetPassword}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await requirePasswordReset(user.id);
                  toast.success('Reset required.', { description: result.message });
                  onChanged();
                } catch (error) {
                  toast.error('Could not do that', { description: (error as Error).message });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Require a reset
            </Button>
          </div>
        </Section>

        <Card className="overflow-hidden border-destructive p-0">
          <div className="border-b border-destructive/40 px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-destructive">
              Lifecycle
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Suspension is reversible and blocks sign-in. Deleting is a soft delete the purge job
              later makes permanent. They are different columns, and different decisions.
            </p>
          </div>
          <div className="space-y-3 p-4">
            {user.suspendedAt ? (
              <p className="text-xs text-warning">
                Suspended {fmt(user.suspendedAt)}
                {s.suspendedReason ? ` — ${s.suspendedReason}` : ''}.
              </p>
            ) : null}
            {user.deletedAt ? (
              <p className="text-xs text-destructive">
                Soft-deleted {fmt(user.deletedAt)}. The purge job removes it permanently.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                variant={user.suspendedAt ? 'outline' : 'destructive'}
                size="sm"
                onClick={onSuspend}
              >
                {user.suspendedAt ? 'Lift the suspension' : 'Suspend'}
              </Button>

              {user.deletedAt ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await restoreUser(user.id);
                      toast.success('Restored.');
                      onChanged();
                    } catch (error) {
                      toast.error('Could not restore it', {
                        description: (error as Error).message,
                      });
                    }
                  }}
                >
                  Restore
                </Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={onDelete}>
                  Delete account
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <Section title="What suspension does">
          <p className="text-xs leading-relaxed text-muted-foreground">
            A suspended account is refused at every sign-in door — password, OTP, social and token
            refresh — and its live sessions stop working at the next refresh. The record stays
            intact and visible here so it can be lifted.
          </p>
        </Section>
      </aside>
    </div>
  );
}

// ── activity ────────────────────────────────────────────────────────────────

function ActivityTab({ userId, user }: { userId: string; user: UserDetail }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-user-activity', userId, page],
    queryFn: () => fetchUserActivity(userId, { page, limit: ACTIVITY_PER_PAGE }),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PER_PAGE));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card className="overflow-hidden p-0">
        <div className="border-b px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent activity
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {total ? `${total} recorded, newest first.` : 'Newest first.'}
          </p>
        </div>

        {isLoading ? (
          <div className="p-4">
            <LoadingState />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nothing recorded. Last seen {fmt(user.lastActivityAt)}.
          </p>
        ) : (
          <div className="divide-y">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-baseline gap-3 px-4 py-3">
                <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                  {fmt(row.createdAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{row.title || row.description}</span>
                  {row.where ? (
                    <span className="block text-xs text-muted-foreground">{row.where}</span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}

        {pages > 1 ? (
          <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              Page {page} of {pages}
            </span>
            <span className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </span>
          </div>
        ) : null}
      </Card>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <Section title="Dates">
          <dl className="space-y-2 text-xs">
            <Row label="Signed up" value={fmt(user.createdAt)} />
            <Row label="Last active" value={fmt(user.lastActivityAt)} />
            {user.suspendedAt ? <Row label="Suspended" value={fmt(user.suspendedAt)} /> : null}
            {user.deletedAt ? <Row label="Deleted" value={fmt(user.deletedAt)} /> : null}
          </dl>
        </Section>
      </aside>
    </div>
  );
}
