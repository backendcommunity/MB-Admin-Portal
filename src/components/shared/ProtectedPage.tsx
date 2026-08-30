'use client';

import type { ReactNode } from 'react';

import type { UserRole } from '@/lib/constants/roles';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

export function ProtectedPage({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const { role, resolved } = useRoleGuard(allowedRoles);

  // Unresolved: we don't yet know the role, so render nothing that depends
  // on it rather than guessing. Resolved-but-disallowed: the redirect effect
  // above is already navigating away — render nothing while that happens.
  if (!resolved || !role || !allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
