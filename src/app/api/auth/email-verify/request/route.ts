// POST { email } → gửi (lại) mã 6 số xác thực email cho màn "Kiểm tra hộp thư" sau đăng ký. Không cần phiên.
// Luôn cùng một dạng phản hồi dù email có tài khoản hay không (email lạ / đã xác thực / bị khoá chỉ được mô phỏng, không gửi thư).
import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/loginCode";
import { requestSignupCode, MAIL_SEND_FAILED } from "@/lib/loginCodeServer";
import { signupRequestResponse, MAIL_FAILED_MSG } from "@/lib/signupCodeHttp";
import { limitOrBlock, getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const blocked = limitOrBlock(getClientIp(req), "email-verify-request", 10, 10 * 60_000); // 10 lần/10 phút/IP
  if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    if (!email) return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
    // Theo email: không để ai dội thư vào hộp thư người khác bằng cách đổi IP.
    if (!rateLimit(`email-verify-email:${email}`, 6, 10 * 60_000)) {
      return NextResponse.json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau.", code: "wait", retryAfterSec: 600 }, { status: 429, headers: { "Retry-After": "600" } });
    }
    return signupRequestResponse(await requestSignupCode(email));
  } catch (e) {
    if (e instanceof Error && e.message === MAIL_SEND_FAILED) return NextResponse.json({ error: MAIL_FAILED_MSG }, { status: 502 });
    console.error("[email-verify/request]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
