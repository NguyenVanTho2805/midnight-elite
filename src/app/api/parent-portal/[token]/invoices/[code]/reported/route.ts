// TT-200 — nút "Tôi đã chuyển" trên "Sổ của con" (phụ huynh mở link, không đăng
// nhập). Token chỉ cho phép báo trên phiếu CỦA ĐÚNG EM đó; không đọc được gì khác.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidPortalToken } from "@/lib/parentPortal";
import { limitOrBlock } from "@/lib/rate-limit";
import { markParentReported } from "@/lib/invoiceServer";
import { isInvoiceCode } from "@/lib/tuitionInvoice";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string; code: string }> }) {
  const { token, code } = await params;
  if (!isValidPortalToken(token) || !isInvoiceCode(code)) return NextResponse.json({ error: "Mã không hợp lệ" }, { status: 404 });
  const blocked = limitOrBlock(token, "portal-invoice-reported", 20, 60 * 60_000);
  if (blocked) return blocked;
  const link = await prisma.parentLink.findFirst({ where: { portalToken: token, status: "verified" }, select: { studentId: true } });
  if (!link) return NextResponse.json({ error: "Mã không hợp lệ hoặc đã bị thu hồi" }, { status: 404 });
  const r = await markParentReported(link.studentId, code);
  return r.ok ? NextResponse.json({ ok: true, alreadyReported: r.alreadyReported }) : NextResponse.json({ error: r.error }, { status: r.status });
}
