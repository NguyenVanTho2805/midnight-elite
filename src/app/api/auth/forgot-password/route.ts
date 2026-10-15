// POST { email } → gửi link đặt lại mật khẩu (sống 30 phút, dùng một lần). Quy tắc thuần ở src/lib/passwordReset.ts.
//
// Không để lộ email nào có tài khoản: email lạ, tài khoản bị khoá và lần xin quá sớm (đang chờ 60 giây) đều trả CÙNG một dạng phản hồi,
// và các nhánh không gửi thư cũng chờ một khoảng gần bằng thời gian gửi thư thật.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { limitOrBlock, getClientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/loginCode";
import {
  MAX_REQUESTS, REQUEST_WINDOW_MS, RESEND_MS, RESET_TTL_MS,
  generateResetToken, hashResetToken, planRequest,
} from "@/lib/passwordReset";

/** Nhánh không gửi thư chờ chừng này để thời gian trả lời không tố ai có tài khoản (gửi thư thật qua Gmail mất cỡ 0,7–2 giây). */
const QUIET_DELAY_MS = 900;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET chưa được cấu hình");
  return s;
}

const sentResponse = (resendAfterSec: number) => NextResponse.json({ success: true, resendAfterSec });

export async function POST(req: Request) {
  const blocked = limitOrBlock(getClientIp(req), "forgot-password", 10, 10 * 60_000); // 10 lần/10 phút/IP
  if (blocked) return blocked;

  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail((body as { email?: unknown } | null)?.email);
    if (!email) return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });

    // Giới hạn theo email (áp cho mọi email như nhau, kể cả email lạ → không tố ai có tài khoản): chống dội thư vào hộp thư người khác bằng cách đổi IP.
    if (!rateLimit(`forgot-email:${email}`, MAX_REQUESTS, REQUEST_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Bạn đã xin link quá nhiều lần. Hãy thử lại sau ít phút.", code: "wait", retryAfterSec: Math.ceil(REQUEST_WINDOW_MS / 1000) },
        { status: 429, headers: { "Retry-After": String(Math.ceil(REQUEST_WINDOW_MS / 1000)) } },
      );
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, banned: true } });
    if (!user || user.banned) {
      await sleep(QUIET_DELAY_MS);
      return sentResponse(RESEND_MS / 1000);
    }

    const now = new Date();
    const existing = await prisma.passwordResetToken.findFirst({ where: { userId: user.id }, orderBy: { expiresAt: "desc" } });
    const plan = planRequest(existing, now);
    if (plan.action === "wait") {
      await sleep(QUIET_DELAY_MS);
      return sentResponse(plan.retryAfterSec); // link đang sống vẫn dùng được; không gửi thêm, không đổi link
    }

    // Mỗi tài khoản chỉ một link còn hiệu lực: link cũ chết ngay khi có link mới.
    const token = generateResetToken();
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({ data: { token: hashResetToken(token, secret()), userId: user.id, expiresAt: new Date(now.getTime() + RESET_TTL_MS) } }),
    ]);

    try {
      await sendPasswordResetEmail(user.email, user.name, token);
    } catch (e) {
      // Không gửi được thì bỏ link vừa tạo: nếu không, thời gian chờ 60 giây sẽ chặn đúng lần thử lại của người dùng.
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }).catch(() => {});
      console.error("[forgot-password] gửi thư lỗi:", (e as Error).message);
      return NextResponse.json({ error: "Không gửi được email lúc này. Thử lại sau ít phút." }, { status: 502 });
    }

    return sentResponse(RESEND_MS / 1000);
  } catch (e) {
    console.error("[forgot-password]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
