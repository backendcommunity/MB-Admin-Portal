'use client';

import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/lib/constants/roles';

/**
 * Shared rendering for any role-gated control: disabled with a visible
 * reason for anyone whose role isn't in `roles`, rendered plainly otherwise.
 *
 * Disabled with a reason rather than hidden: a control that disappears between
 * two admins' screens reads as a bug. The API enforces the rule regardless —
 * this is the explanation, not the guard.
 *
 * Gated on `authResolved` as well as `userRole`, deliberately: `useAuthStore`
 * persists `userRole` to localStorage (`partialize`) but never persists
 * `authResolved`, which always starts `false` on a fresh load. That means a
 * `roles.includes(role)` check ALONE does not fail closed — on a real page
 * load `userRole` can be a stale cached value from a previous session (a
 * role change, or someone else's session on a shared machine) while
 * `authResolved` is still `false`. Checking role alone would flash-enable
 * this control on that stale value until the session check lands. Requiring
 * both `authResolved` and a matching role is what actually fails closed: the
 * control stays disabled for every unresolved render, no matter what role
 * happens to be cached, and only enables once the current session has
 * positively confirmed a permitted role.
 */
function RoleGuardedControl({
  children,
  roles,
  reason,
}: {
  children: ReactNode;
  roles: readonly UserRole[];
  reason: string;
}) {
  const role = useAuthStore((s) => s.userRole);
  const authResolved = useAuthStore((s) => s.authResolved);
  if (authResolved && role && (roles as readonly string[]).includes(role)) return <>{children}</>;

  return (
    <span className="inline-flex flex-col gap-1" title={reason}>
      <fieldset disabled className="contents">
        {children}
      </fieldset>
      <span className="text-xs text-muted-foreground">{reason}</span>
    </span>
  );
}

/** Wraps a control only a super admin may use. See `RoleGuardedControl` for the fail-closed rationale. */
export function SuperAdminOnly({
  children,
  reason = 'Super admin only',
}: {
  children: ReactNode;
  reason?: string;
}) {
  return (
    <RoleGuardedControl roles={['SUPER_ADMIN']} reason={reason}>
      {children}
    </RoleGuardedControl>
  );
}

/**
 * Wraps a control only platform staff (ADMIN or SUPER_ADMIN) may use — one
 * rung down from `SuperAdminOnly`, same fail-closed contract. Matches the
 * academy repo's `isPlatformStaff` (staff-scope.ts): instructors get full
 * CRUD on their own content but not on fields the API reserves for admins,
 * e.g. Ship pricing (`MONETISATION_FIELDS` in field-guard.ts).
 */
export function StaffOnly({
  children,
  reason = 'Admin only',
}: {
  children: ReactNode;
  reason?: string;
}) {
  return (
    <RoleGuardedControl roles={['SUPER_ADMIN', 'ADMIN']} reason={reason}>
      {children}
    </RoleGuardedControl>
  );
}
