import { NextResponse } from "next/server";
import { TUTOR_VIP_PLANS } from "@/lib/tutorSubscription";

// GET /api/subscriptions — danh sách 3 gói VIP cho gia sư. Public (ai cũng
// xem được giá) để trang landing + trang settings của gia sư cùng dùng.
export async function GET() {
  const plans = Object.values(TUTOR_VIP_PLANS).map(p => ({
    code:         p.code,
    name:         p.name,
    priceCoin:    p.priceCoin,
    durationDays: p.durationDays,
  }));
  return NextResponse.json({ plans });
}
