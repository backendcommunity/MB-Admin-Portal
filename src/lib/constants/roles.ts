export const USER_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"] as const;

export type UserRole = (typeof USER_ROLES)[number];
