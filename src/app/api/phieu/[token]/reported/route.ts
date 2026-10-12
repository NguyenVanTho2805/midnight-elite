// TT-199 — nút "Tôi đã chuyển" trên trang phiếu riêng (/phieu/[token]), phụ huynh không đăng nhập.
// Token chỉ cho báo trên đúng phiếu của nó và chỉ khi link còn hạn.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidPortalToken } from "@/lib/parentPortal";
import { limitOrBlock } from "@/lib/rate-limit";
import { markParentReported } from "@/lib/invoiceServer";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidPortalToken(token)) return NextResponse.json({ error: "Mã không hợp lệ" }, { status: 404 });
  const blocked = limitOrBlock(token, "phieu-reported", 20, 60 * 60_000);
  if (blocked) return blocked;
  const inv = await prisma.tuitionInvoice.findFirst({ where: { viewToken: token }, select: { studentId: true, code: true, viewTokenExpiresAt: true } });
  if (!inv) return NextResponse.json({ error: "Mã không hợp lệ" }, { status: 404 });
  if (!inv.viewTokenExpiresAt || inv.viewTokenExpiresAt.getTime() <= Date.now()) return NextResponse.json({ error: "Link đã hết hạn — nhờ gia sư gửi lại" }, { status: 410 });
  const r = await markParentReported(inv.studentId, inv.code);
  return r.ok ? NextResponse.json({ ok: true, alreadyReported: r.alreadyReported }) : NextResponse.json({ error: r.error }, { status: r.status });
}
