import { NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { getActiveTutorSubscription } from "@/lib/tutorSubscription";

// GET /api/users/me/subscription — gia sư xem trạng thái VIP của chính
// mình. Dùng cho dashboard của gia sư và trang settings. Trả null nếu chưa
// VIP / đã hết hạn — client biết hiển thị CTA "nâng cấp VIP".
export async function GET() {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const sub = await getActiveTutorSubscription(auth.userId);
  return NextResponse.json({ subscription: sub });
}
