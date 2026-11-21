// SCL-H (P2-30): MỘT cách dựng "người đang đăng nhập" cho cả GET /api/auth/me và vỏ học sinh dựng ở máy chủ ((student)/layout.tsx) — hai chỗ không lệch cột nhau.
// Chỉ đọc; đồng bộ vai + gia hạn phiên vẫn là việc riêng của /api/auth/me (cần ghi cookie, layout không ghi được).
import "server-only";
import { prisma } from "@/lib/prisma";
import { tutorApplicationStatus } from "@/lib/tutorProfile";

export const AUTH_ME_SELECT = {
  id: true, name: true, email: true, role: true, adminRole: true, phone: true, parentPhone: true, parentName: true, school: true, highSchool: true, city: true,
  studentId: true, facebookUrl: true, zaloPhone: true, emailVerified: true, banned: true, phoneVerifiedAt: true, tutorAppliedAt: true, tutorVerified: true, tutorRejectedAt: true,
} as const;

type MeRow = NonNullable<Awaited<ReturnType<typeof findMe>>>;
const findMe = (userId: string) => prisma.user.findUnique({ where: { id: userId }, select: AUTH_ME_SELECT });

/** Bỏ cột nội bộ (khoá, ngày nộp/duyệt đơn), thêm `phoneVerified` + cờ `tutorPending` (NC2-029: chỉ một cờ, không ngày/lý do). */
export function publicAuthUser(user: MeRow) {
  const { banned: _banned, phoneVerifiedAt, tutorAppliedAt, tutorVerified, tutorRejectedAt, ...publicUser } = user;
  void _banned;
  const tutorPending = user.role === "student" && !user.adminRole && tutorApplicationStatus({ tutorAppliedAt, tutorVerified, tutorRejectedAt }) === "pending";
  return { ...publicUser, phoneVerified: phoneVerifiedAt !== null, tutorPending };
}

export async function loadAuthUser(userId: string) {
  const u = await findMe(userId);
  return u ? publicAuthUser(u) : null;
}
