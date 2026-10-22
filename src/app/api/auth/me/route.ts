import { NextResponse } from "next/server";
import { createSession, deleteSession, getSession, renewSessionIfDue, type SessionPayload } from "@/lib/session";
import { isAdminSession, isPastMaxAge } from "@/lib/sessionPolicy";
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

  // Đồng bộ vai: vai trong phiên (đã qua kiểm chữ ký + hạn) lệch vai trong DB (gia sư mới được duyệt, quản trị bị gỡ vai…)
  // → cấp lại cookie theo DB. Chỉ lấy vai từ DB; giữ NGUYÊN mốc iat nên không kéo dài phiên. Tài khoản bị khoá: không cấp gì.
  let effective: SessionPayload = session;
  let roleSynced = false;
  if (!user.banned) {
    const dbRole: SessionPayload["role"] = user.role === "admin" ? "admin" : "student";
    const dbAdminRole = user.adminRole === "admin_super" || user.adminRole === "admin_content" || user.adminRole === "teacher" ? user.adminRole : undefined;
    if (session.role !== dbRole || (session.adminRole ?? undefined) !== dbAdminRole) {
      const synced: SessionPayload = { userId: user.id, role: dbRole, ...(dbAdminRole ? { adminRole: dbAdminRole } : {}), iat: session.iat };
      if (isAdminSession(synced) && isPastMaxAge(synced, Date.now())) {
        await deleteSession(); // vai quản trị mà phiên đã quá 12 giờ kể từ lần đăng nhập thật → phải đăng nhập lại
        return NextResponse.json(null);
      }
      await createSession(synced, { iat: session.iat });
      effective = synced;
      roleSynced = true;
    }
  }

  // Phiên 30 ngày của gia sư/học sinh gia hạn mỗi lần dùng (tối đa 1 lần/24 giờ). Tài khoản bị khoá không được gia hạn.
  if (!user.banned) await renewSessionIfDue(effective);

  // NC2-029: chỉ MỘT cờ cho chính người dùng này — "đã nộp đơn gia sư, chưa được duyệt, chưa bị từ chối" (vẫn là role học viên). Không trả ngày/lý do.
  const { banned: _banned, phoneVerifiedAt, tutorAppliedAt, tutorVerified, tutorRejectedAt, ...publicUser } = user;
  void _banned;
  const tutorPending = user.role === "student" && !user.adminRole && tutorApplicationStatus({ tutorAppliedAt, tutorVerified, tutorRejectedAt }) === "pending";
  // sessionRefreshed: báo cho trình duyệt dựng lại phần máy chủ (vỏ gia sư đọc cookie) ngay lần tải này.
  return NextResponse.json({ ...publicUser, phoneVerified: phoneVerifiedAt !== null, tutorPending, ...(roleSynced ? { sessionRefreshed: true } : {}) });
}
