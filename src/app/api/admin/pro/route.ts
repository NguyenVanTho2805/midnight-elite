// KiN Pro — GET /api/admin/pro: cấu hình gói + danh sách yêu cầu + số đo ("đếm bóng"). Chỉ quản trị có quyền MANAGE_REVENUE (admin_super).
// Danh sách yêu cầu có tên và email gia sư vì admin cần đối chiếu sao kê; phần số đo là tổng hợp, KHÔNG có tên người.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { loadPlanConfigs, loadPlanMeasure, loadPlanSettings } from "@/lib/planServer";
import { isPlanEnforced, SETTING_DEFAULTS } from "@/lib/planLimits";
import { proPayConfig } from "@/lib/proPayment";

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_REVENUE);
  if (isNextResponse(auth)) return auth;
  const [configs, settings, measure, orders] = await Promise.all([
    loadPlanConfigs(), loadPlanSettings(), loadPlanMeasure(),
    prisma.proOrder.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);
  const pay = proPayConfig();
  return NextResponse.json({
    configs, settings, defaults: SETTING_DEFAULTS, measure,
    enforced: isPlanEnforced(),
    sale: { open: pay.open, reason: pay.reason, prefix: pay.prefix, configured: pay.configured },
    orders: orders.map(o => ({
      id: o.id, userName: o.user.name, userEmail: o.user.email, period: o.period, status: o.status, source: o.source, priceVnd: o.priceVnd,
      listPriceVnd: o.listPriceVnd, foundingDiscountPct: o.foundingDiscountPct, memoCode: o.memoCode, durationDays: o.durationDays,
      startDate: o.startDate?.toISOString() ?? null, endDate: o.endDate?.toISOString() ?? null, createdAt: o.createdAt.toISOString(), bankRef: o.bankRef,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
