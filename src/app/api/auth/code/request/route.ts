// POST { email } | { phone } | { identifier } → gửi mã đăng nhập 6 số qua email hoặc SMS (TK-170). Luôn trả cùng một dạng phản hồi dù
// email/số có tài khoản hay không. SMS chỉ gửi tới số ĐÃ XÁC MINH của một tài khoản; số lạ được mô phỏng, không tốn một tin nhắn nào.
import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/loginCode";
import { requestLoginCode, requestPhoneLoginCode, MAIL_SEND_FAILED } from "@/lib/loginCodeServer";
import { codeRequestResponse, phoneLimitOk, smsDailyOk } from "@/lib/loginCodeHttp";
import { classifyIdentifier, normalizeVnPhone, type Identifier } from "@/lib/phone";
import { SMS_SEND_FAILED, smsEnabled } from "@/lib/sms";
import { limitOrBlock, getClientIp, rateLimit } from "@/lib/rate-limit";

function pick(body: Record<string, unknown> | null): Identifier | { error: string } {
  if (typeof body?.phone === "string") {
    const e164 = normalizeVnPhone(body.phone);
    return e164 ? { kind: "phone", e164 } : { error: "Số điện thoại không hợp lệ (số di động Việt Nam, 10 số)" };
  }
  if (typeof body?.email === "string") {
    const email = normalizeEmail(body.email);
    return email ? { kind: "email", email } : { error: "Email không hợp lệ" };
  }
  const id = classifyIdentifier(body?.identifier, normalizeEmail);
  return id ?? { error: "Nhập số điện thoại hoặc email hợp lệ" };
}

export async function POST(req: Request) {
  const blocked = limitOrBlock(getClientIp(req), "login-code-request", 10, 10 * 60_000); // 10 lần/10 phút/IP
  if (blocked) return blocked;

  try {
    const body = await req.json().catch(() => null);
    const id = pick(body);
    if ("error" in id) return NextResponse.json({ error: id.error }, { status: 400 });

    if (id.kind === "phone") {
      if (!smsEnabled()) return NextResponse.json({ error: "Đăng nhập bằng số điện thoại chưa mở. Hãy dùng email.", code: "sms-off" }, { status: 503 });
      // SMS tốn tiền: chặt hơn email (5 lần/10 phút/số, chờ 60 giây giữa hai lần) và có trần cả ngày.
      if (!phoneLimitOk(id.e164)) {
        return NextResponse.json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau.", code: "wait", retryAfterSec: 600 }, { status: 429, headers: { "Retry-After": "600" } });
      }
      if (!smsDailyOk()) return NextResponse.json({ error: "Hôm nay hệ thống tạm ngưng gửi SMS. Hãy dùng email.", code: "sms-off" }, { status: 503 });
      return codeRequestResponse(await requestPhoneLoginCode(id.e164), "phone");
    }

    // Thêm giới hạn theo email (bộ nhớ): không để ai dội thư vào hộp thư của người khác bằng cách đổi IP.
    if (!rateLimit(`login-code-email:${id.email}`, 6, 10 * 60_000)) {
      return NextResponse.json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau.", code: "wait", retryAfterSec: 600 }, { status: 429, headers: { "Retry-After": "600" } });
    }
    return codeRequestResponse(await requestLoginCode(id.email), "email");
  } catch (e) {
    if (e instanceof Error && e.message === MAIL_SEND_FAILED) {
      return NextResponse.json({ error: "Không gửi được email lúc này. Thử lại sau ít phút." }, { status: 502 });
    }
    if (e instanceof Error && e.message === SMS_SEND_FAILED) {
      return NextResponse.json({ error: "Không gửi được tin nhắn lúc này. Thử lại sau ít phút hoặc dùng email." }, { status: 502 });
    }
    console.error("[login-code/request]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
