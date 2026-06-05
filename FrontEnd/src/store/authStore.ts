"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { UserRole } from "@/lib/constants/roles";

interface AuthState {
  token: string | null;
  userRole: UserRole | null;
  login: (token: string, userRole: UserRole) => void;
  logout: () => void;
  tokenRefresh: (token: string) => void;
}

const storage =
  typeof window !== "undefined"
    ? createJSONStorage(() => localStorage)
    : undefined;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userRole: null,
      login: (token, userRole) => set({ token, userRole }),
      logout: () => set({ token: null, userRole: null }),
      tokenRefresh: (token) => set((state) => ({ ...state, token })),
    }),
    {
      name: "mb_token",
      storage,
      partialize: (state) => ({ token: state.token, userRole: state.userRole }),
    }
  )
);