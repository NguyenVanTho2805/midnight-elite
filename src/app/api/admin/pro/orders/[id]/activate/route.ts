// KiN Pro — POST /api/admin/pro/orders/[id]/activate { bankRef? }: admin đã đối chiếu sao kê, bấm kích hoạt. Cộng dồn hạn, ghi audit. Chỉ MANAGE_REVENUE.
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { activateProOrder } from "@/lib/planServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_REVENUE);
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  let body: { bankRef?: unknown } = {};
  try { body = await req.json(); } catch { /* không bắt buộc */ }
  const r = await activateProOrder(id, auth.userId, { bankRef: typeof body.bankRef === "string" ? body.bankRef : null });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ order: { id: r.order.id, status: r.order.status, startDate: r.order.startDate, endDate: r.order.endDate } });
}
