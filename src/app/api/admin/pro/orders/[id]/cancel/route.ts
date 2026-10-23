// KiN Pro — POST /api/admin/pro/orders/[id]/cancel: huỷ yêu cầu đang chờ (không đụng yêu cầu đã kích hoạt). Chỉ MANAGE_REVENUE.
import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { cancelProOrder } from "@/lib/planServer";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_REVENUE);
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const r = await cancelProOrder(id, auth.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
