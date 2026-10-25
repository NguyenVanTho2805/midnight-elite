// KiN Pro — POST /api/admin/pro/grant-legacy: tặng Pro miễn phí (số ngày trong cài đặt, mặc định 60) cho mọi gia sư hiện có, mỗi người MỘT lần. Không có tiền. Chỉ MANAGE_REVENUE.
import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { grantLegacyTrial } from "@/lib/planServer";

export async function POST() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_REVENUE);
  if (isNextResponse(auth)) return auth;
  const r = await grantLegacyTrial(auth.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ granted: r.granted, skipped: r.skipped, days: r.days });
}
