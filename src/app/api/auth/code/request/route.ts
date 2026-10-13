// POST { email } → gửi mã đăng nhập 6 số qua email (TK-170). Luôn trả cùng một dạng phản hồi dù email có tài khoản hay không.
import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/loginCode";
import { requestLoginCode, MAIL_SEND_FAILED } from "@/lib/loginCodeServer";
import { limitOrBlock, getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const blocked = limitOrBlock(getClientIp(req), "login-code-request", 10, 10 * 60_000); // 10 lần/10 phút/IP
  if (blocked) return blocked;

  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    if (!email) return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });

    // Thêm giới hạn theo email (bộ nhớ): không để ai dội thư vào hộp thư của người khác bằng cách đổi IP.
    if (!rateLimit(`login-code-email:${email}`, 6, 10 * 60_000)) {
      return NextResponse.json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau.", code: "wait", retryAfterSec: 600 }, { status: 429, headers: { "Retry-After": "600" } });
    }

    const r = await requestLoginCode(email);
    if (r.status === "sent") {
      return NextResponse.json({ sent: true, resendAfterSec: r.resendAfterSec, expiresInSec: r.expiresInSec });
    }
    const headers = { "Retry-After": String(r.retryAfterSec) };
    if (r.status === "wait") {
      return NextResponse.json({ error: `Gửi lại được sau ${r.retryAfterSec} giây`, code: "wait", retryAfterSec: r.retryAfterSec }, { status: 429, headers });
    }
    return NextResponse.json(
      { error: `Đăng nhập bằng email này đang bị khoá. Thử lại sau ${Math.ceil(r.retryAfterSec / 60)} phút.`, code: "locked", retryAfterSec: r.retryAfterSec },
      { status: 429, headers },
    );
  } catch (e) {
    if (e instanceof Error && e.message === MAIL_SEND_FAILED) {
      return NextResponse.json({ error: "Không gửi được email lúc này. Thử lại sau ít phút." }, { status: 502 });
    }
    console.error("[login-code/request]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
