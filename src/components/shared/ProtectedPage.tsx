"use client";

import type { ReactNode } from "react";

import type { UserRole } from "@/lib/constants/roles";
import { useRoleGuard } from "@/lib/auth/useRoleGuard";

export function ProtectedPage({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  useRoleGuard(allowedRoles);

  return <>{children}</>;
}
