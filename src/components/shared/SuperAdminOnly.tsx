'use client';

import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';

/**
 * Wraps a control only a super admin may use.
 *
 * Disabled with a reason rather than hidden: a control that disappears between
 * two admins' screens reads as a bug. The API enforces the rule regardless —
 * this is the explanation, not the guard.
 *
 * Gated on `authResolved` as well as `userRole`, deliberately: `useAuthStore`
 * persists `userRole` to localStorage (`partialize`) but never persists
 * `authResolved`, which always starts `false` on a fresh load. That means a
 * `role === 'SUPER_ADMIN'` check ALONE does not fail closed — on a real page
 * load `userRole` can be a stale cached value from a previous session (a
 * role change, or someone else's session on a shared machine) while
 * `authResolved` is still `false`. Checking role alone would flash-enable
 * this control on that stale value until the session check lands. Requiring
 * both `authResolved` and `role === 'SUPER_ADMIN'` is what actually fails
 * closed: the control stays disabled for every unresolved render, no matter
 * what role happens to be cached, and only enables once the current session
 * has positively confirmed SUPER_ADMIN.
 */
export function SuperAdminOnly({
  children,
  reason = 'Super admin only',
}: {
  children: ReactNode;
  reason?: string;
}) {
  const role = useAuthStore((s) => s.userRole);
  const authResolved = useAuthStore((s) => s.authResolved);
  if (authResolved && role === 'SUPER_ADMIN') return <>{children}</>;

  return (
    <span className="inline-flex flex-col gap-1" title={reason}>
      <fieldset disabled className="contents">
        {children}
      </fieldset>
      <span className="text-xs text-muted-foreground">{reason}</span>
    </span>
  );
}
