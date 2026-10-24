// QT-04 — "Hôm nay cần làm gì": số việc đang chờ theo QUYỀN của người xem. Chỉ đếm, không trả tên người.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadTodayList } from "@/lib/adminOpsServer";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Không có quyền admin" }, { status: 403 });
  try {
    return NextResponse.json(await loadTodayList(session, new Date()), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/hom-nay]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
