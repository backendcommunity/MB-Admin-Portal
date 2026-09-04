'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { UserRole } from '@/lib/constants/roles';

interface AuthState {
  token: string | null;
  userRole: UserRole | null;
  /**
   * Whether auth resolution has actually completed at least once — NOT
   * whether a role is present. `userRole` starts `null` for two very
   * different reasons: "haven't checked yet" and "checked, and there is no
   * portal role." A consumer that can't tell those apart (like a role guard)
   * either flashes /403 at every legitimate user on first paint, or renders
   * protected content to a role-less viewer while it waits. This flag is set
   * exactly once auth resolution finishes, on both the success and the
   * failure path, so `userRole === null && authResolved` is the only signal
   * that means "known, and not allowed."
   */
  authResolved: boolean;
  login: (userRole: UserRole) => void;
  setUserRole: (userRole: UserRole | null) => void;
  logout: () => void;
  tokenRefresh: (token: string) => void;
}

const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

const storage = typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userRole: isAuthDisabled ? 'SUPER_ADMIN' : null,
      // The dev auth-bypass never runs a session check, so there is nothing
      // to "resolve" — it is already a known, final state.
      authResolved: isAuthDisabled,
      login: (userRole) => set({ userRole, authResolved: true }),
      setUserRole: (userRole) => set({ userRole, authResolved: true }),
      logout: () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'mb_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
        set({
          token: null,
          userRole: isAuthDisabled ? 'SUPER_ADMIN' : null,
          authResolved: isAuthDisabled,
        });
      },
      tokenRefresh: (token) => set((state) => ({ ...state, token })),
    }),
    {
      name: isAuthDisabled ? 'mb_role_dev' : 'mb_role',
      storage,
      // Deliberately excludes `authResolved`: it must start false (or true
      // only via isAuthDisabled) on every fresh load and be earned again by
      // an actual session check, never assumed from a stale cached value.
      partialize: (state) => ({ userRole: state.userRole }),
    },
  ),
);
