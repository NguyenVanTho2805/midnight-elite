// POST { email, code } → đổi mã 6 số lấy xác thực email + tự đăng nhập (cùng kết quả với GET /api/auth/verify-email?token=).
// Sai 5 lần thì khoá email đó 15 phút; đúng thì mã bị xoá ngay (dùng một lần). Mã chỉ khớp với đúng email đã nhập (băm gắn khoá "verify:<email>").
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { landingPath } from "@/lib/landing";
import { tutorApplicationStatus } from "@/lib/tutorProfile";
import { normalizeCodeInput, normalizeEmail } from "@/lib/loginCode";
import { verifySignupCode } from "@/lib/loginCodeServer";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const blocked = limitOrBlock(getClientIp(req), "email-verify-confirm", 30, 10 * 60_000); // 30 lần/10 phút/IP
  if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    if (!email) return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
    const code = normalizeCodeInput(body?.code);
    if (!code) return NextResponse.json({ error: "Mã gồm đúng 6 chữ số", code: "format" }, { status: 400 });

    const r = await verifySignupCode(email, code);
    switch (r.status) {
      case "ok": {
        const u = r.user;
        await prisma.user.update({ where: { id: u.id }, data: { emailVerified: true } });
        await prisma.verifyToken.deleteMany({ where: { userId: u.id } });
        await createSession({
          userId: u.id,
          role: u.role as "student" | "admin",
          ...(u.adminRole ? { adminRole: u.adminRole as "admin_super" | "admin_content" } : {}),
        });
        const tutorPending = u.role === "student" && !u.adminRole && tutorApplicationStatus(u) === "pending";
        return NextResponse.json({ success: true, name: u.name, landing: landingPath(u.role, u.adminRole, tutorPending), tutorPending });
      }
      case "wrong":
        return NextResponse.json({ error: "Mã không đúng", code: "wrong", attemptsLeft: r.attemptsLeft }, { status: 401 });
      case "locked":
        return NextResponse.json(
          { error: `Xác thực email này đang tạm khoá do nhập sai nhiều lần. Thử lại sau ${Math.ceil(r.retryAfterSec / 60)} phút.`, code: "locked", retryAfterSec: r.retryAfterSec },
          { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
        );
      default:
        return NextResponse.json({ error: "Mã đã hết hạn hoặc chưa được gửi. Hãy xin mã mới.", code: "expired" }, { status: 401 });
    }
  } catch (e) {
    console.error("[email-verify/confirm]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
