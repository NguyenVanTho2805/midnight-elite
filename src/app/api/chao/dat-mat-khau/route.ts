// SCL đợt 5 (D2) — POST /api/chao/dat-mat-khau (form của trang /chao/<mã>): đặt mật khẩu MỘT lần cho tài khoản do phiếu BCA tạo, rồi đăng nhập luôn và 303 sang
// /student/viec-cua-toi. Mã đi trong thân form (không trên URL đích). Mã sai / hết hạn ⇒ 303 về trang chào (màn "Link đã hết hạn"). Tài khoản đã có mật khẩu ⇒ không đổi gì.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";
import { validateNewPassword } from "@/lib/passwordPolicy";
import { hashWelcomeToken, welcomeNeedsPassword } from "@/lib/intakeServer";
import { logAction } from "@/lib/auditLog";

const NO_STORE = { "Cache-Control": "no-store" };
const go = (req: Request, path: string) => NextResponse.redirect(new URL(path, req.url), { status: 303, headers: NO_STORE });

export async function POST(req: Request) {
  const blocked = limitOrBlock(getClientIp(req), "chao-mat-khau", 30, 10 * 60_000);
  if (blocked) return blocked;
  const fd = await req.formData().catch(() => null);
  const token = String(fd?.get("token") ?? "");
  if (!/^[\w-]{20,100}$/.test(token)) return go(req, "/chao/het-han");
  const back = (loi: string) => go(req, `/chao/${token}?loi=${loi}`);
  const password = fd?.get("password"), confirm = fd?.get("confirm");
  if (validateNewPassword(password)) return back("ngan");
  if (password !== confirm) return back("khop");

  const w = await prisma.intakeWelcome.findUnique({ where: { tokenHash: hashWelcomeToken(token) }, select: { id: true, userId: true, expiresAt: true, passwordSetAt: true, user: { select: { role: true, banned: true, emailVerified: true } } } });
  if (!w || w.expiresAt <= new Date() || w.user.banned) return go(req, `/chao/${token}`);
  if (w.passwordSetAt || !(await welcomeNeedsPassword(w.userId, w.user.emailVerified))) return back("da-dat");

  const hashed = await bcrypt.hash(password as string, 10);
  // Giữ chỗ mã TRƯỚC khi đổi mật khẩu: hai lần bấm song song chỉ một lần thắng.
  const claimed = await prisma.intakeWelcome.updateMany({ where: { id: w.id, passwordSetAt: null }, data: { passwordSetAt: new Date() } });
  if (claimed.count === 0) return back("da-dat");
  await prisma.user.update({ where: { id: w.userId }, data: { password: hashed } });
  await logAction(w.userId, "intake.password_set", "User", w.userId);
  await createSession({ userId: w.userId, role: w.user.role as "student" | "admin" });
  return go(req, "/student/viec-cua-toi");
}
