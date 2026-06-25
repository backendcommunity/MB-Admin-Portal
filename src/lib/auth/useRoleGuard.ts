"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { UserRole } from "@/lib/constants/roles";
import { useAuthStore } from "@/store/authStore";

export function useRoleGuard(allowedRoles: UserRole[]) {
  const router = useRouter();
  const role = useAuthStore((state) => state.userRole);

  useEffect(() => {
    if (role && !allowedRoles.includes(role)) {
      router.replace("/403");
    }
  }, [allowedRoles, role, router]);

  return role;
}
