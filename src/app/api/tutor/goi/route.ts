// KiN Pro — GET /api/tutor/goi: dữ liệu màn "Gói của tôi" (gói hiện tại, hạn mức x/N, bảng giá từ cấu hình, yêu cầu mua đang chờ kèm QR).
// Chỉ gia sư, chỉ dữ liệu của chính mình. Không số tài khoản nào nếu chưa cấu hình nhận tiền ("Chưa mở bán").
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { buildTutorPlanView } from "@/lib/planServer";

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    return NextResponse.json(await buildTutorPlanView(auth.userId), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tutor/goi]", e);
    return NextResponse.json({ error: "Không tải được thông tin gói, thử lại sau" }, { status: 500 });
  }
}
