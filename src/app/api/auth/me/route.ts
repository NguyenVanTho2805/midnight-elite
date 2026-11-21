import { NextResponse } from "next/server";
import { createSession, deleteSession, getSession, renewSessionIfDue, type SessionPayload } from "@/lib/session";
import { isAdminSession, isPastMaxAge } from "@/lib/sessionPolicy";
import { prisma } from "@/lib/prisma";
import { AUTH_ME_SELECT, publicAuthUser } from "@/lib/authUserServer";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json(null);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: AUTH_ME_SELECT,
  });
  if (!user) return NextResponse.json(null);
  // Mốc thu hồi (chiếm lại / đặt lại mật khẩu / xác minh email) đã được getSession() kiểm cho yêu cầu GET này (getSessionChecked) → ở đây không kiểm lại.

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

  // NC2-029: chỉ MỘT cờ cho chính người dùng này (tutorPending) — xem publicAuthUser (src/lib/authUserServer.ts, dùng chung với vỏ học sinh).
  // sessionRefreshed: báo cho trình duyệt dựng lại phần máy chủ (vỏ gia sư đọc cookie) ngay lần tải này.
  return NextResponse.json({ ...publicAuthUser(user), ...(roleSynced ? { sessionRefreshed: true } : {}) });
}
