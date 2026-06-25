"use client";

import { useEffect } from "react";

import type { UserRole } from "@/lib/constants/roles";
import { useAuthStore } from "@/store/authStore";

export default function AuthSessionHydrator() {
  const setUserRole = useAuthStore((state) => state.setUserRole);

  useEffect(() => {
    let active = true;

    const syncRole = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!active) return;

        if (!response.ok) {
          setUserRole(null);
          return;
        }

        const payload = (await response.json()) as {
          authenticated?: boolean;
          role?: UserRole;
        };

        if (payload.authenticated && payload.role) {
          setUserRole(payload.role);
        } else {
          setUserRole(null);
        }
      } catch {
        if (!active) return;
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
