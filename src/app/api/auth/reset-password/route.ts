// GET  ?token=… → { valid } : trang đặt lại hỏi trước khi người dùng gõ mật khẩu (link hết hạn thì báo ngay, khỏi gõ rồi mới biết).
// POST { token, password } → đặt mật khẩu mới, huỷ mọi link của tài khoản, xoá bộ đếm đăng nhập sai, gửi thư báo, đăng nhập luôn.
// Quy tắc thuần ở src/lib/passwordReset.ts; cơ sở dữ liệu chỉ lưu băm của link.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { sendPasswordChangedEmail } from "@/lib/email";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";
import { landingPath } from "@/lib/landing";
import { tutorPendingOf } from "@/lib/loginSession";
import { loginThrottle } from "@/lib/loginThrottle";
import {
  EXPIRED_MESSAGE, INVALID_MESSAGE, checkToken, hashResetToken, parseResetToken, validateNewPassword,
} from "@/lib/passwordReset";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET chưa được cấu hình");
  return s;
}

async function findRecord(rawToken: unknown) {
  const token = parseResetToken(rawToken);
  if (!token) return null;
  return prisma.passwordResetToken.findUnique({ where: { token: hashResetToken(token, secret()) }, include: { user: true } });
}

export async function GET(req: Request) {
  const blocked = limitOrBlock(getClientIp(req), "reset-check", 30, 10 * 60_000);
  if (blocked) return blocked;
  try {
    const record = await findRecord(new URL(req.url).searchParams.get("token"));
    const check = checkToken(record, new Date());
    return NextResponse.json(check.ok ? { valid: true } : { valid: false, reason: check.reason, error: check.reason === "expired" ? EXPIRED_MESSAGE : INVALID_MESSAGE });
  } catch (e) {
    console.error("[reset-password GET]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const blocked = limitOrBlock(getClientIp(req), "reset-password", 10, 10 * 60_000); // 10 lần/10 phút/IP
  if (blocked) return blocked;

  try {
    const body = (await req.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
    const passwordError = validateNewPassword(body?.password);
    if (!body || parseResetToken(body.token) === null) return NextResponse.json({ error: INVALID_MESSAGE, code: "invalid" }, { status: 400 });
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const record = await findRecord(body.token);
    const check = checkToken(record, new Date());
    if (!check.ok || !record) {
      return NextResponse.json({ error: check.ok ? INVALID_MESSAGE : check.reason === "expired" ? EXPIRED_MESSAGE : INVALID_MESSAGE, code: check.ok ? "invalid" : check.reason }, { status: 400 });
    }
    if (record.user.banned) {
      return NextResponse.json({ error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin để được hỗ trợ." }, { status: 403 });
    }

    const hashed = await bcrypt.hash(body.password as string, 10);

    // Đổi mật khẩu + huỷ MỌI link của tài khoản trong một giao dịch: không để link bị dùng lại nếu dừng giữa chừng.
    // Link đã mở được từ hộp thư nghĩa là người này kiểm soát hộp thư → coi email đã xác thực.
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { password: hashed, emailVerified: true } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    // Người vừa quên mật khẩu có thể đã gõ sai nhiều lần: xoá bộ đếm để lần đăng nhập đầu tiên bằng mật khẩu mới không bị chờ thêm.
    loginThrottle.ok(record.user.email.toLowerCase());

    // Thư báo: không chặn việc đặt lại nếu gửi lỗi.
    sendPasswordChangedEmail(record.user.email, record.user.name).catch(e => console.error("[reset-password] thư báo lỗi:", (e as Error).message));

    await createSession({
      userId: record.userId,
      role: record.user.role as "student" | "admin",
      ...(record.user.adminRole ? { adminRole: record.user.adminRole as "admin_super" | "admin_content" | "teacher" } : {}),
    });

    // BU-00 bước 5: gia sư chờ duyệt đặt lại mật khẩu xong cũng về trang chờ duyệt (cùng cách tính với đăng nhập).
    return NextResponse.json({ success: true, role: record.user.role, adminRole: record.user.adminRole, next: landingPath(record.user.role, record.user.adminRole, tutorPendingOf(record.user)) });
  } catch (e) {
    console.error("[reset-password]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
