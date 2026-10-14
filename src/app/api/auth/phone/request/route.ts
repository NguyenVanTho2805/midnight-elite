// POST { phone } (đã đăng nhập) → gửi mã 6 số tới số đó để GẮN số vào tài khoản. Sau khi xác minh, số này dùng để đăng nhập bằng SMS.
// Chống lạm dụng gửi SMS tới số lạ: phải đăng nhập + email đã xác minh, giới hạn theo IP / người dùng / số / cả ngày.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { requestPhoneClaimCode } from "@/lib/loginCodeServer";
import { normalizeVnPhone } from "@/lib/phone";
import { SMS_SEND_FAILED, smsEnabled } from "@/lib/sms";
import { limitOrBlock, getClientIp, rateLimit } from "@/lib/rate-limit";
import { codeRequestResponse, phoneLimitOk, smsDailyOk } from "@/lib/loginCodeHttp";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const blocked = limitOrBlock(getClientIp(req), "phone-claim-request", 10, 10 * 60_000);
  if (blocked) return blocked;

  try {
    if (!smsEnabled()) return NextResponse.json({ error: "Đăng nhập bằng số điện thoại chưa mở.", code: "sms-off" }, { status: 503 });
    const body = await req.json().catch(() => null);
    const e164 = normalizeVnPhone(body?.phone);
    if (!e164) return NextResponse.json({ error: "Số điện thoại không hợp lệ (số di động Việt Nam, 10 số)" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { emailVerified: true, banned: true, phoneE164: true } });
    if (!user || user.banned) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    if (!user.emailVerified) return NextResponse.json({ error: "Hãy xác minh email trước khi thêm số điện thoại.", code: "email-unverified" }, { status: 403 });
    if (user.phoneE164 === e164) return NextResponse.json({ alreadyVerified: true });

    const tooMany = () => NextResponse.json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau.", code: "wait", retryAfterSec: 600 }, { status: 429, headers: { "Retry-After": "600" } });
    if (!rateLimit(`phone-claim-user:${session.userId}`, 5, 3_600_000)) return tooMany();
    if (!phoneLimitOk(e164)) return tooMany(); // cùng bộ đếm với đăng nhập: tổng SMS tới một số bị chặn chung
    if (!smsDailyOk()) return NextResponse.json({ error: "Hôm nay hệ thống tạm ngưng gửi SMS. Thử lại ngày mai.", code: "sms-off" }, { status: 503 });

    return codeRequestResponse(await requestPhoneClaimCode(session.userId, e164), "phone");
  } catch (e) {
    if (e instanceof Error && e.message === SMS_SEND_FAILED) return NextResponse.json({ error: "Không gửi được tin nhắn lúc này. Thử lại sau ít phút." }, { status: 502 });
    console.error("[phone/request]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
