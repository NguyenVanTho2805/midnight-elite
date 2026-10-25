// KiN Pro — POST /api/tutor/goi/mua { period: "month" | "quarter" | "year" }: tạo YÊU CẦU mua Pro (thu QR theo kỳ, kích hoạt tay bởi admin).
// KHÔNG dùng Coin, KHÔNG tự động trừ tiền. Chưa cấu hình nhận tiền / đang chạy thử / bản xem trước → 409 "Chưa mở bán".
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { buildTutorPlanView, createProOrder } from "@/lib/planServer";
import { logAction } from "@/lib/auditLog";
import { BILLING_PERIODS, type BillingPeriod } from "@/lib/planLimits";

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  let body: { period?: unknown } = {};
  try { body = await req.json(); } catch { /* thiếu body → báo lỗi bên dưới */ }
  const period = BILLING_PERIODS.find(p => p === body.period) as BillingPeriod | undefined;
  if (!period) return NextResponse.json({ error: "Chọn kỳ 1 tháng, 3 tháng hoặc 12 tháng" }, { status: 400 });

  const r = await createProOrder(auth.userId, period);
  if (!r.ok) return NextResponse.json({ error: r.error, saleClosed: r.status === 409 }, { status: r.status });
  if (r.created) await logAction(auth.userId, "pro_order.create", "ProOrder", r.order.id, { period, priceVnd: r.order.priceVnd, foundingDiscountPct: r.order.foundingDiscountPct });
  return NextResponse.json({ created: r.created, ...(await buildTutorPlanView(auth.userId)) }, { status: r.created ? 201 : 200 });
}
