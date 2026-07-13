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
  VIEW_SALES_LEADS:     "VIEW_SALES_LEADS",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type AdminRole  = "admin_super" | "admin_content" | "teacher";

// "teacher" = giáo viên trong 1 trung tâm nhiều giáo viên — chỉ quản lý được
// khoá học/đề thi do chính mình tạo (scope theo Course.ownerId/Exam.ownerId,
// xem src/lib/auth-guard.ts). admin_super/admin_content là quản lý trung tâm,
// thấy & sửa được mọi nội dung bất kể ai tạo.
export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  admin_super:   Object.values(PERMISSIONS) as Permission[],
  admin_content: [
    PERMISSIONS.MANAGE_COURSES,
    PERMISSIONS.MANAGE_CURRICULUM,
    PERMISSIONS.MANAGE_HONOR,
    PERMISSIONS.MANAGE_NEWS,
    PERMISSIONS.MANAGE_COMMUNITY,
  ],
  teacher: [
    PERMISSIONS.MANAGE_COURSES,
    PERMISSIONS.MANAGE_CURRICULUM,
  ],
};

export function checkPermission(adminRole: AdminRole | undefined | null, permission: Permission): boolean {
  if (!adminRole) return false;
  return ROLE_PERMISSIONS[adminRole]?.includes(permission) ?? false;
}
