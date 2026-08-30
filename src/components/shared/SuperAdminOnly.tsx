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
 * `userRole` is `null` for two different reasons — auth hasn't resolved yet,
 * or it resolved and there is no super-admin role — and this component
 * deliberately does not tell them apart. A viewer who isn't actually a super
 * admin must never see the control flash enabled before the role check lands,
 * so the strict `=== 'SUPER_ADMIN'` comparison fails closed on both an
 * unresolved and a resolved-but-lesser role, and only flips to enabled once
 * the role is positively known to be SUPER_ADMIN.
 */
export function SuperAdminOnly({
  children,
  reason = 'Super admin only',
}: {
  children: ReactNode;
  reason?: string;
}) {
  const role = useAuthStore((s) => s.userRole);
  if (role === 'SUPER_ADMIN') return <>{children}</>;

  return (
    <span className="inline-flex flex-col gap-1" title={reason}>
      <fieldset disabled className="contents">
        {children}
      </fieldset>
      <span className="text-xs text-muted-foreground">{reason}</span>
    </span>
  );
}
