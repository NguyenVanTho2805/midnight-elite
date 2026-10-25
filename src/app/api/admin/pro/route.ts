// KiN Pro — GET /api/admin/pro: cấu hình gói + danh sách yêu cầu + số đo ("đếm bóng"). Chỉ quản trị có quyền MANAGE_REVENUE (admin_super).
// Danh sách yêu cầu có tên và email gia sư vì admin cần đối chiếu sao kê; phần số đo là tổng hợp, KHÔNG có tên người.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { loadPlanConfigs, loadPlanMeasure, loadPlanSettings } from "@/lib/planServer";
import { isPlanEnforced, SETTING_DEFAULTS } from "@/lib/planLimits";
import { PRO_REVIEW_REASON_TEXT, proPayConfig, proWebhookConfig, type ProReviewReason } from "@/lib/proPayment";

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_REVENUE);
  if (isNextResponse(auth)) return auth;
  const [configs, settings, measure, orders, payments] = await Promise.all([
    loadPlanConfigs(), loadPlanSettings(), loadPlanMeasure(),
    prisma.proOrder.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.proPayment.findMany({ where: { status: "review" }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const pay = proPayConfig(), hook = proWebhookConfig();
  return NextResponse.json({
    configs, settings, defaults: SETTING_DEFAULTS, measure,
    enforced: isPlanEnforced(),
    sale: { open: pay.open, reason: pay.reason, prefix: pay.prefix, configured: pay.configured },
    webhook: { enabled: hook.enabled, reason: hook.reason },
    // Khoản tiền SePay báo về nhưng KHÔNG tự kích hoạt được: admin đối chiếu, xử lý ở ngoài (hoàn tiền / kích hoạt tay) rồi đánh dấu. Không có tên người.
    payments: payments.map(p => ({
      id: p.id, amount: p.amount, content: p.content, matchedCode: p.matchedCode, orderId: p.orderId, providerTxId: p.providerTxId,
      reason: p.reason, reasonText: PRO_REVIEW_REASON_TEXT[(p.reason ?? "no_code") as ProReviewReason] ?? "Cần xem lại", occurredAt: p.occurredAt.toISOString(), createdAt: p.createdAt.toISOString(),
    })),
    orders: orders.map(o => ({
      id: o.id, userName: o.user.name, userEmail: o.user.email, period: o.period, status: o.status, source: o.source, priceVnd: o.priceVnd,
      listPriceVnd: o.listPriceVnd, foundingDiscountPct: o.foundingDiscountPct, memoCode: o.memoCode, durationDays: o.durationDays,
      startDate: o.startDate?.toISOString() ?? null, endDate: o.endDate?.toISOString() ?? null, createdAt: o.createdAt.toISOString(), bankRef: o.bankRef,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
