// ĐX-04 (NC1-051) — GET /api/admin/health-metrics?days=N — số đo sức khoẻ sản phẩm cho quản trị.
// Chỉ quản lý trung tâm (admin_super, admin_content), cùng quyền với /api/admin/funnel. Chỉ số tổng hợp: không có tên học sinh hay gia sư.
// `days` thiếu hoặc không hợp lệ → 30. Không cache (số thay đổi theo giờ và là dữ liệu quản trị).
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { loadHealthMetrics } from "@/lib/healthMetricsServer";
import { MIN_SAMPLE } from "@/lib/healthMetrics";

export async function GET(req: NextRequest) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const raw = req.nextUrl.searchParams.get("days");
  const n = raw === null ? 30 : Number(raw);
  const days = Number.isInteger(n) && n >= 1 && n <= 365 ? n : 30;
  const data = await loadHealthMetrics(days);
  return NextResponse.json({ ...data, minSample: MIN_SAMPLE }, { headers: { "Cache-Control": "no-store" } });
}
