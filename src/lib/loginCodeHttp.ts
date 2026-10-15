// Phần HTTP dùng chung của các route xin mã (đăng nhập và xác minh số). Để ở đây vì file route.ts của Next chỉ được xuất hàm GET/POST/…
import { NextResponse } from "next/server";
import type { RequestResult } from "@/lib/loginCodeServer";
import { rateLimit } from "@/lib/rate-limit";

/** Trần số SMS gửi trong 24 giờ (theo tiến trình máy chủ): chặn việc ai đó đốt tiền SMS bằng cách xin mã liên tục. Chỉnh bằng SMS_DAILY_LIMIT. */
export const smsDailyOk = (): boolean =>
  rateLimit("sms-daily", Number(process.env.SMS_DAILY_LIMIT) > 0 ? Number(process.env.SMS_DAILY_LIMIT) : 500, 24 * 3_600_000);

/** Mỗi SỐ chỉ nhận tối đa 5 yêu cầu mã trong 10 phút (cả đăng nhập lẫn xác minh dùng chung bộ đếm); giữa hai lần còn phải chờ 60 giây. */
export const PHONE_LIMIT = { max: 5, windowMs: 10 * 60_000 } as const;
export const phoneLimitOk = (e164: string): boolean => rateLimit(`login-code-phone:${e164}`, PHONE_LIMIT.max, PHONE_LIMIT.windowMs);

export function codeRequestResponse(r: RequestResult, channel: "email" | "phone") {
  if (r.status === "sent") return NextResponse.json({ sent: true, resendAfterSec: r.resendAfterSec, expiresInSec: r.expiresInSec });
  const headers = { "Retry-After": String(r.retryAfterSec) };
  if (r.status === "wait") {
    return NextResponse.json({ error: `Gửi lại được sau ${r.retryAfterSec} giây`, code: "wait", retryAfterSec: r.retryAfterSec }, { status: 429, headers });
  }
  return NextResponse.json(
    { error: `Đăng nhập bằng ${channel === "phone" ? "số điện thoại" : "email"} này đang bị khoá. Thử lại sau ${Math.ceil(r.retryAfterSec / 60)} phút.`, code: "locked", retryAfterSec: r.retryAfterSec },
    { status: 429, headers },
  );
}
