import { StatusBadge } from '@/components/shared/StatusBadge';
import type { Role, UserAccess, UserFlag, UserStatus } from '@/lib/api/users';

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

export function statusTone(status: UserStatus): Tone {
  if (status === 'active') return 'success';
  if (status === 'unverified') return 'warning';
  return 'danger';
}

export function roleTone(role: Role): Tone {
  if (role === 'ADMIN') return 'danger';
  if (role === 'INSTRUCTOR') return 'info';
  return 'neutral';
}

export function accessTone(access: UserAccess): Tone {
  if (access === 'premium') return 'success';
  if (access === 'trial') return 'warning';
  if (access === 'staff') return 'info';
  return 'neutral';
}

/** Initials, or the picture when there is one. */
export function Avatar({
  name,
  src,
  size = 'sm',
}: {
  name: string;
  src?: string;
  size?: 'sm' | 'lg';
}) {
  const box = size === 'lg' ? 'size-12 text-base' : 'size-8 text-xs';
  const initials = (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`${box} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      className={`${box} grid shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground`}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** The current run, with the best one behind it for scale. */
export function Streak({ current, longest }: { current: number; longest: number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="tabular-nums">{current}</span>
      {longest > current ? (
        <span className="text-xs text-muted-foreground tabular-nums">/ {longest}</span>
      ) : null}
    </span>
  );
}

/**
 * Every reason an account can be flagged, shared by the flagged-users screen
 * and the "Needs attention" chip on the main users list — one filter, reused
 * rather than redefined at each call site.
 */
export const FLAG_REASONS = [
  ['ALL', 'Every reason'],
  ['suspended', 'Suspended'],
  ['unverified', 'Unverified email'],
  ['must-reset', 'Must reset password'],
  ['onboarding', 'Stalled onboarding'],
  ['trial', 'On a trial'],
  ['deleted', 'Deleted'],
] as const;

export function filterByFlagReason<T extends { flags?: UserFlag[] }>(
  rows: T[],
  reason: string,
): T[] {
  if (reason === 'ALL') return rows;
  return rows.filter((row) => (row.flags ?? []).some((flag) => flag.code === reason));
}

export function FlagList({ flags }: { flags: Array<{ code: string; detail: string }> }) {
  if (!flags.length) return null;
  return (
    <div className="space-y-1.5">
      {flags.map((flag) => (
        <div key={flag.code} className="flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge label={flag.code} tone="warning" />
          <span className="text-muted-foreground">{flag.detail}</span>
        </div>
      ))}
    </div>
  );
}
