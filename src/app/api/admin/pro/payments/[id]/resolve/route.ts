// KiN Pro — POST /api/admin/pro/payments/[id]/resolve: admin đã xử lý xong một khoản tiền "cần duyệt tay" (hoàn tiền ở ngân hàng, hoặc đã kích hoạt tay) và đánh dấu.
// Chỉ ĐỔI NHÃN trong sổ đối soát: không kích hoạt gì, không hoàn tiền, không động tới tiền. Chỉ MANAGE_REVENUE. Bấm lần hai → 409.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/auditLog";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_REVENUE);
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const r = await prisma.proPayment.updateMany({ where: { id, status: "review" }, data: { status: "resolved", resolvedBy: auth.userId, resolvedAt: new Date() } });
  if (r.count === 0) {
    const p = await prisma.proPayment.findUnique({ where: { id }, select: { status: true } });
    return p ? NextResponse.json({ error: "Khoản này không còn ở trạng thái cần duyệt" }, { status: 409 }) : NextResponse.json({ error: "Không tìm thấy khoản tiền" }, { status: 404 });
  }
  await logAction(auth.userId, "pro_payment.resolve", "ProPayment", id);
  return NextResponse.json({ ok: true });
}
