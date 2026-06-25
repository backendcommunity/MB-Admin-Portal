import type { UserRole } from "@/lib/constants/roles";

export function mapAcademyRoleToPortalRole(role: string | undefined): UserRole {
  if (role === "INSTRUCTOR") return "INSTRUCTOR";
  if (role === "ADMIN") return "ADMIN";
  return "SUPER_ADMIN";
}
