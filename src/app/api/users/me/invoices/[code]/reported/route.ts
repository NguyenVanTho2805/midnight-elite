// TT-200 — nút "Tôi đã chuyển" của học viên. Chỉ ghi nhận BÁO đã chuyển, chưa
// phải đã nhận tiền; quá 24 giờ chưa thấy tiền vào thì gia sư được nhắc kiểm sao kê.
import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { limitOrBlock } from "@/lib/rate-limit";
import { markParentReported } from "@/lib/invoiceServer";
import { isInvoiceCode } from "@/lib/tuitionInvoice";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const { code } = await params;
  if (!isInvoiceCode(code)) return NextResponse.json({ error: "Mã phiếu không hợp lệ" }, { status: 400 });
  const blocked = limitOrBlock(auth.userId, "invoice-reported", 30, 60 * 60_000);
  if (blocked) return blocked;
  const r = await markParentReported(auth.userId, code);
  return r.ok ? NextResponse.json({ ok: true, alreadyReported: r.alreadyReported }) : NextResponse.json({ error: r.error }, { status: r.status });
}
