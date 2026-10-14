// POST { phone, code } (đã đăng nhập) → nhập mã SMS để xác minh số. Đúng → số gắn vào tài khoản (phoneE164 + phoneVerifiedAt).
// Một số chỉ gắn được với MỘT tài khoản: số đã thuộc tài khoản khác → 409 (người này đã chứng minh có số trong tay nên nói thẳng được).
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { normalizeCodeInput } from "@/lib/loginCode";
import { verifyPhoneClaimCode } from "@/lib/loginCodeServer";
import { normalizeVnPhone, toNationalVn } from "@/lib/phone";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const blocked = limitOrBlock(getClientIp(req), "phone-claim-confirm", 30, 10 * 60_000);
  if (blocked) return blocked;

  try {
    const body = await req.json().catch(() => null);
    const e164 = normalizeVnPhone(body?.phone);
    if (!e164) return NextResponse.json({ error: "Số điện thoại không hợp lệ (số di động Việt Nam, 10 số)" }, { status: 400 });
    const code = normalizeCodeInput(body?.code);
    if (!code) return NextResponse.json({ error: "Mã gồm đúng 6 chữ số", code: "format" }, { status: 400 });

    const r = await verifyPhoneClaimCode(session.userId, e164, code);
    if (r.status === "wrong") return NextResponse.json({ error: "Mã không đúng", code: "wrong", attemptsLeft: r.attemptsLeft }, { status: 401 });
    if (r.status === "locked") {
      return NextResponse.json({ error: `Số này đang bị khoá xác minh. Thử lại sau ${Math.ceil(r.retryAfterSec / 60)} phút.`, code: "locked", retryAfterSec: r.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } });
    }
    if (r.status !== "ok") return NextResponse.json({ error: "Mã đã hết hạn hoặc chưa được gửi. Hãy xin mã mới.", code: "expired" }, { status: 401 });

    try {
      await prisma.user.update({ where: { id: session.userId }, data: { phoneE164: e164, phoneVerifiedAt: new Date(), phone: toNationalVn(e164) } });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "Số này đã gắn với một tài khoản khác. Hãy đăng nhập tài khoản đó hoặc dùng số khác.", code: "taken" }, { status: 409 });
      }
      throw e;
    }
    return NextResponse.json({ ok: true, verified: true, phone: toNationalVn(e164) });
  } catch (e) {
    console.error("[phone/confirm]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
