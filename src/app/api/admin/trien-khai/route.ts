// QT-03 — "Triển khai và hạn mức": CHỈ ĐỌC. Cờ môi trường (chỉ bật/tắt, không bao giờ trả giá trị biến), lần gọi tác vụ định kỳ gần nhất,
// hạn mức gói đang cấu hình và số đo hiện có. Muốn đổi: đổi biến ở Vercel (cờ) hoặc dùng trang Gói KiN Pro (hạn mức). Cùng quyền với trang Gói KiN Pro.
import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { deployEnv, deployFlags } from "@/lib/adminOps";
import { loadCronViews } from "@/lib/adminOpsServer";
import { loadPlanConfigs, loadPlanMeasure } from "@/lib/planServer";

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_REVENUE);
  if (isNextResponse(auth)) return auth;
  try {
    const now = new Date();
    const [crons, configs, measure] = await Promise.all([loadCronViews(now), loadPlanConfigs(), loadPlanMeasure(now)]);
    return NextResponse.json({
      env: deployEnv(), flags: deployFlags(), crons,
      limits: { free: { studentLimit: configs.free.studentLimit, aiExtractPerMonth: configs.free.aiExtractPerMonth }, pro: { studentLimit: configs.pro.studentLimit, aiExtractPerMonth: configs.pro.aiExtractPerMonth } },
      measure: { tutors: measure.tutors, byState: measure.byState, maxStudents: measure.maxStudents, shadowWouldBlock30d: measure.shadowWouldBlock30d, enforcedBlocked30d: measure.enforcedBlocked30d, aiExtractThisMonth: measure.aiExtractThisMonth, proNow: measure.proNow },
      generatedAt: now.toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/trien-khai]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
