import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { signInResponse } from "@/lib/loginSession";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";
import { loginThrottle } from "@/lib/loginThrottle";
import { parsePasswordLogin, wrongMessage, waitMessage } from "@/lib/passwordLogin";
import { isAdminSession } from "@/lib/sessionPolicy";
import { AUTO_NOT_ALLOWED } from "@/lib/savedLogin";

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
    const body = await req.json().catch(() => null);
    // `auto: true` = trình duyệt tự đăng nhập bằng thông tin đã lưu (src/lib/savedLogin.ts), không phải người dùng bấm. Phải đúng kiểu boolean `true`.
    const auto = (body as { auto?: unknown } | null)?.auto === true;
    const parsed = parsePasswordLogin(body);
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
    // Quản trị chỉ sống 12 giờ và không tự gia hạn (sessionPolicy.ts): máy bỏ quên thì hết đường, muốn tiếp phải đăng nhập lại có chủ ý. Nếu trình duyệt tự đưa mật khẩu
    // đã lưu để vào lại thì mốc 12 giờ mất tác dụng, nên từ chối ở đây (đã kiểm mật khẩu đúng, CHƯA cấp phiên) và để người dùng tự bấm "Đăng nhập".
    if (auto && isAdminSession({ role: user.role, adminRole: user.adminRole })) {
      return NextResponse.json(
        { error: "Tài khoản quản trị không tự đăng nhập. Bấm “Đăng nhập” để vào.", code: AUTO_NOT_ALLOWED },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    return await signInResponse(user, req);
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
