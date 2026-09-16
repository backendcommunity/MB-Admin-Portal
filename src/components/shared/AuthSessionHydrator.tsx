'use client';

import { useEffect } from 'react';

import type { UserRole } from '@/lib/constants/roles';
import { refreshSession } from '@/lib/auth/session-refresh';
import { useAuthStore } from '@/store/authStore';

/**
 * Pages that must never be redirected away from — the login page would
 * otherwise bounce to itself forever, since it is below the same providers.
 */
const PUBLIC_PATHS = new Set(['/', '/login', '/forgot-password', '/403']);

function toLogin() {
  const { pathname, search } = window.location;
  if (PUBLIC_PATHS.has(pathname)) return false;
  window.location.replace(`/login?returnUrl=${encodeURIComponent(pathname + search)}`);
  return true;
}

async function fetchMe() {
  return fetch('/api/auth/me', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
}

export default function AuthSessionHydrator() {
  const setUserRole = useAuthStore((state) => state.setUserRole);

  useEffect(() => {
    let active = true;

    const syncRole = async () => {
      try {
        let response = await fetchMe();

        // 401 here means the access token ran out, which happens every hour.
        // The refresh token is good for a 14-day sliding window, so try to
        // renew before concluding anything about the user.
        if (!response.ok && response.status === 401) {
          const refreshed = await refreshSession();
          if (!active) return;
          if (refreshed) response = await fetchMe();
        }

        if (!active) return;

        if (!response.ok) {
          // No session, and no way to get one back. Send them to log in —
          // NOT to /403, which claims they are forbidden from a page they are
          // perfectly entitled to, and offers no way back in.
          //
          // `setUserRole(null)` is deliberately not called first: it sets
          // `authResolved`, and `useRoleGuard` reads a resolved null role as
          // "known, and not allowed", flashing /403 on the way out.
          if (toLogin()) return;
          setUserRole(null);
          return;
        }

        const payload = (await response.json()) as {
          authenticated?: boolean;
          role?: UserRole | null;
        };

        if (!active) return;

        // Authenticated but with no portal role is a genuine 403: a real
        // signed-in user who is not staff. That redirect stays the guard's
        // job, and this is what tells it so.
        setUserRole(payload.authenticated && payload.role ? payload.role : null);
      } catch {
        if (!active) return;
        // The API being unreachable is not proof the session is over. Resolve
        // as role-less rather than throwing the user out of a session that
        // may well still be valid.
        setUserRole(null);
      }
    };

    void syncRole();

    return () => {
      active = false;
    };
  }, [setUserRole]);

  return null;
}
