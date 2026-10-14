import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { signInResponse } from "@/lib/loginSession";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";
import { loginThrottle } from "@/lib/loginThrottle";
import { parsePasswordLogin, wrongMessage, waitMessage } from "@/lib/passwordLogin";

// Đăng nhập bằng "tài khoản + mật khẩu" (đường chính từ 14/10/2026; đăng nhập bằng mã 6 số là đường song song ở /api/auth/code/*).
// Body: { identifier, password } — `identifier` là email hoặc số di động VN đã xác minh; tên cũ `email` vẫn được nhận.
//
// Ba điều phải giữ:
//   - Email lạ cũng chạy bcrypt.compare (với một băm giả): nếu không, tài khoản có thật trả lời chậm hơn ~88 ms và ai cũng liệt kê được
//     email nào đã đăng ký (docs/kin/nhung-cho-de-sai.md).
//   - Không lộ tài khoản có tồn tại hay không: sai tài khoản và sai mật khẩu cho CÙNG một câu.
//   - Chặn dò mật khẩu theo máy; theo tài khoản chỉ làm chậm, không khoá (xem src/lib/loginThrottle.ts).
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= bcrypt.hash(randomBytes(16).toString("hex"), 10)); // cùng độ khó (10) với băm thật

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const blocked = limitOrBlock(ip, "login", 10, 60_000); // 10 lần/phút
  if (blocked) return blocked;

  try {
    const parsed = parsePasswordLogin(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { target, password } = parsed;

    const wait = loginThrottle.ipWaitSec(ip);
    if (wait > 0) {
      return NextResponse.json(
        { error: waitMessage(wait), code: "wait", retryAfterSec: wait },
        { status: 429, headers: { "Retry-After": String(wait) } },
      );
    }
    const delay = loginThrottle.accountDelayMs(target.key);
    if (delay > 0) await sleep(delay);

    let user = null;
    if (target.kind === "email") {
      user = await prisma.user.findUnique({ where: { email: target.email } });
    } else {
      // Chỉ số ĐÃ XÁC MINH mới là "tài khoản" (xem passwordLogin.ts).
      const u = await prisma.user.findUnique({ where: { phoneE164: target.e164 } });
      user = u && u.phoneVerifiedAt ? u : null;
    }

    const valid = await bcrypt.compare(password, user?.password ?? (await dummyHash()));
    if (!user || !valid) {
      loginThrottle.fail(ip, target.key);
      return NextResponse.json({ error: wrongMessage(target) }, { status: 401 });
    }

    loginThrottle.ok(target.key);
    return await signInResponse(user);
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
