// KiN Pro — PUT /api/admin/pro/config: sửa hạn mức, giá, cài đặt tặng Pro / giá sáng lập. Chỉ MANAGE_REVENUE. Giá đổi ở đây KHÔNG đổi yêu cầu đã tạo (đã chụp giá).
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { savePlanConfig } from "@/lib/planServer";
import { validatePlanConfigInput } from "@/lib/planLimits";

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_REVENUE);
  if (isNextResponse(auth)) return auth;
  let body: unknown = null;
  try { body = await req.json(); } catch { /* báo lỗi bên dưới */ }
  const v = validatePlanConfigInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  if (v.plans.length === 0 && Object.keys(v.settings).length === 0) return NextResponse.json({ error: "Không có gì để lưu" }, { status: 400 });
  await savePlanConfig(auth.userId, v.plans, v.settings);
  return NextResponse.json({ ok: true });
}
