"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { UserRole } from "@/lib/constants/roles";

interface AuthState {
  token: string | null;
  userRole: UserRole | null;
  login: (userRole: UserRole) => void;
  setUserRole: (userRole: UserRole | null) => void;
  logout: () => void;
  tokenRefresh: (token: string) => void;
}

    
const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

const storage =
  typeof window !== "undefined"
    ? createJSONStorage(() => localStorage)
    : undefined;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userRole: isAuthDisabled ? "SUPER_ADMIN" : null,
      login: (userRole) => set({ userRole }),
      setUserRole: (userRole) => set({ userRole }),
      logout: () => {
        if (typeof document !== "undefined") {
          document.cookie =
            "mb_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
        set({
          token: null,
          userRole: isAuthDisabled ? "SUPER_ADMIN" : null,
        });
      },
      tokenRefresh: (token) => set((state) => ({ ...state, token })),
    }),
    {
      name: isAuthDisabled ? "mb_role_dev" : "mb_role",
      storage,
      partialize: (state) => ({ userRole: state.userRole }),
    }
  )
);