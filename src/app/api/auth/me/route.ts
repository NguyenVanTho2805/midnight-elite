import { NextResponse } from "next/server";
import { getSession, renewSessionIfDue } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { tutorApplicationStatus } from "@/lib/tutorProfile";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json(null);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, adminRole: true, phone: true, parentPhone: true, parentName: true, school: true, highSchool: true, city: true, studentId: true, facebookUrl: true, zaloPhone: true, emailVerified: true, banned: true, phoneVerifiedAt: true, tutorAppliedAt: true, tutorVerified: true, tutorRejectedAt: true },
  });
  if (!user) return NextResponse.json(null);

  // Phiên 30 ngày của gia sư/học sinh gia hạn mỗi lần dùng (tối đa 1 lần/24 giờ). Tài khoản bị khoá không được gia hạn.
  if (!user.banned) await renewSessionIfDue(session);

  // NC2-029: chỉ MỘT cờ cho chính người dùng này — "đã nộp đơn gia sư, chưa được duyệt, chưa bị từ chối" (vẫn là role học viên). Không trả ngày/lý do.
  const { banned: _banned, phoneVerifiedAt, tutorAppliedAt, tutorVerified, tutorRejectedAt, ...publicUser } = user;
  void _banned;
  const tutorPending = user.role === "student" && !user.adminRole && tutorApplicationStatus({ tutorAppliedAt, tutorVerified, tutorRejectedAt }) === "pending";
  return NextResponse.json({ ...publicUser, phoneVerified: phoneVerifiedAt !== null, tutorPending });
}
