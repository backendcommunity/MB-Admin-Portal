'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import type { UserRole } from '@/lib/constants/roles';
import { useAuthStore } from '@/store/authStore';

/**
 * Distinguishes "we don't know the role yet" from "we know, and it's not
 * allowed." Both look like `role === null`, but only the second one may be
 * sent to /403 — bouncing on the first would 403 every legitimate admin on
 * first paint, before the session check has had a chance to run.
 */
export function useRoleGuard(allowedRoles: UserRole[]) {
  const router = useRouter();
  const role = useAuthStore((state) => state.userRole);
  const resolved = useAuthStore((state) => state.authResolved);

  useEffect(() => {
    if (!resolved) return;
    if (!role || !allowedRoles.includes(role)) {
      router.replace('/403');
    }
  }, [allowedRoles, resolved, role, router]);

  return { role, resolved };
}
