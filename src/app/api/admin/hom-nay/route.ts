// QT-04 / BU-08 — "Hôm nay cần làm gì": số việc đang chờ theo QUYỀN của người xem, chia nhóm (duyet · theo-doi · he-thong) kèm vài chỉ số ĐẾM.
// Chỉ đếm: không tên người, không số điện thoại, không tổng tiền. Gia sư (teacher) → 403.
import { NextResponse } from "next/server";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { isNextResponse } from "@/lib/auth-guard";
import { loadTodayList } from "@/lib/adminOpsServer";

export async function GET() {
  const session = await requireCenterAdmin();
  if (isNextResponse(session)) return session;
  try {
    return NextResponse.json(await loadTodayList(session, new Date()), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/hom-nay]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
