// Shared permission definitions — usable on both server (API routes) and client (AuthContext).
// No "use client" directive needed.

export const PERMISSIONS = {
  VIEW_REVENUE:         "VIEW_REVENUE",
  MANAGE_REVENUE:       "MANAGE_REVENUE",
  VIEW_STUDENTS:        "VIEW_STUDENTS",
  MANAGE_STUDENTS:      "MANAGE_STUDENTS",
  MANAGE_COURSES:       "MANAGE_COURSES",
  MANAGE_CURRICULUM:    "MANAGE_CURRICULUM",
  MANAGE_HONOR:         "MANAGE_HONOR",
  MANAGE_ADMINS:        "MANAGE_ADMINS",
  MANAGE_NEWS:          "MANAGE_NEWS",
  MANAGE_COMMUNITY:     "MANAGE_COMMUNITY",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type AdminRole  = "admin_super" | "admin_content";

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  admin_super:   Object.values(PERMISSIONS) as Permission[],
  admin_content: [
    PERMISSIONS.MANAGE_COURSES,
    PERMISSIONS.MANAGE_CURRICULUM,
    PERMISSIONS.MANAGE_HONOR,
    PERMISSIONS.MANAGE_NEWS,
    PERMISSIONS.MANAGE_COMMUNITY,
  ],
};

export function checkPermission(adminRole: AdminRole | undefined | null, permission: Permission): boolean {
  if (!adminRole) return false;
  return ROLE_PERMISSIONS[adminRole]?.includes(permission) ?? false;
}
