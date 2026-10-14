// POST { email | phone, code } → đổi mã 6 số lấy phiên đăng nhập (TK-170). Sai 5 lần thì khoá email/số 15 phút; đúng thì mã bị xoá ngay.
import { NextResponse } from "next/server";
import { normalizeCodeInput, normalizeEmail } from "@/lib/loginCode";
import { verifyLoginCode, verifyPhoneLoginCode } from "@/lib/loginCodeServer";
import { normalizeVnPhone } from "@/lib/phone";
import { signInResponse } from "@/lib/loginSession";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const blocked = limitOrBlock(getClientIp(req), "login-code-verify", 30, 10 * 60_000); // 30 lần/10 phút/IP
  if (blocked) return blocked;

  try {
    const body = await req.json().catch(() => null);
    const isPhone = typeof body?.phone === "string";
    const email = isPhone ? null : normalizeEmail(body?.email);
    const e164 = isPhone ? normalizeVnPhone(body.phone) : null;
    if (isPhone ? !e164 : !email) {
      return NextResponse.json({ error: isPhone ? "Số điện thoại không hợp lệ (số di động Việt Nam, 10 số)" : "Email không hợp lệ" }, { status: 400 });
    }
    const code = normalizeCodeInput(body?.code);
    if (!code) return NextResponse.json({ error: "Mã gồm đúng 6 chữ số", code: "format" }, { status: 400 });

    const r = isPhone ? await verifyPhoneLoginCode(e164!, code) : await verifyLoginCode(email!, code);
    switch (r.status) {
      case "ok":
        return await signInResponse(r.user);
      case "wrong":
        return NextResponse.json({ error: "Mã không đúng", code: "wrong", attemptsLeft: r.attemptsLeft }, { status: 401 });
      case "locked":
        return NextResponse.json(
          { error: `Đăng nhập bằng ${isPhone ? "số điện thoại" : "email"} này đang bị khoá. Thử lại sau ${Math.ceil(r.retryAfterSec / 60)} phút.`, code: "locked", retryAfterSec: r.retryAfterSec },
          { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
        );
      default:
        return NextResponse.json({ error: "Mã đã hết hạn hoặc chưa được gửi. Hãy xin mã mới.", code: "expired" }, { status: 401 });
    }
  } catch (e) {
    console.error("[login-code/verify]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
