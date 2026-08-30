import type { UserRole } from '@/lib/constants/roles';

/**
 * Fails closed. An unrecognised role gets no portal role, not the highest one —
 * the previous default handed a `USER` every super-admin control on screen.
 */
const PORTAL_ROLES: Record<string, UserRole> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  INSTRUCTOR: 'INSTRUCTOR',
};

export function mapAcademyRoleToPortalRole(role: string | undefined): UserRole | null {
  return (role && PORTAL_ROLES[role]) || null;
}
