// KiN Pro F4 — GET /api/tutor/thong-ke-chuyen-can: xu hướng chuyên cần theo tuần/tháng, em vắng liên tiếp, so sánh lớp. Chỉ gia sư, chỉ lớp của mình.
// Khối này là của gói Pro: gia sư Free (khi cổng hạn mức BẬT) nhận { locked: true } và KHÔNG có dữ liệu nào (không chỉ che trên giao diện). Cổng TẮT → ai cũng xem được.
// Sáu chỉ số cơ bản và doanh thu theo lớp/tháng nằm ở API khác và không bao giờ bị khoá.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { canUse } from "@/lib/planServer";
import { loadAttendanceInsights } from "@/lib/attendanceInsightsServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    if (!(await canUse(auth.userId, "advanced_stats"))) return NextResponse.json({ locked: true }, { headers: NO_STORE });
    return NextResponse.json({ locked: false, ...(await loadAttendanceInsights(auth.userId)) }, { headers: NO_STORE });
  } catch (e) {
    console.error("[GET /api/tutor/thong-ke-chuyen-can]", e);
    return NextResponse.json({ error: "Không tải được thống kê chuyên cần, thử lại sau" }, { status: 500, headers: NO_STORE });
  }
}
