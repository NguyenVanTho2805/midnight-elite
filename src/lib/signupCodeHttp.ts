// Phần HTTP dùng chung của xác thực email bằng mã 6 số (đăng ký, gia sư, băng vàng). File route.ts của Next chỉ được xuất GET/POST/… nên để ở đây.
// Thông báo KHÔNG chứa tên / email / số tiền và cùng dạng cho email có hay không có tài khoản.
import { NextResponse } from "next/server";
import type { RequestResult } from "@/lib/loginCodeServer";

export const MAIL_FAILED_MSG = "Chưa gửi được email lúc này. Thử lại sau ít phút hoặc liên hệ hỗ trợ.";

export function signupRequestResponse(r: RequestResult) {
  if (r.status === "sent") return NextResponse.json({ success: true, sent: true, resendAfterSec: r.resendAfterSec, expiresInSec: r.expiresInSec });
  const headers = { "Retry-After": String(r.retryAfterSec) };
  if (r.status === "wait") {
    return NextResponse.json({ error: `Gửi lại được sau ${r.retryAfterSec} giây`, code: "wait", retryAfterSec: r.retryAfterSec }, { status: 429, headers });
  }
  return NextResponse.json(
    { error: `Xác thực email này đang tạm khoá do nhập sai nhiều lần. Thử lại sau ${Math.ceil(r.retryAfterSec / 60)} phút.`, code: "locked", retryAfterSec: r.retryAfterSec },
    { status: 429, headers },
  );
}
