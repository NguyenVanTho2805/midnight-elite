// TT-200 — học viên xem phiếu học phí của mình (phiếu nháp và đã huỷ ẩn).
// QR VietQR dựng từ tài khoản của GIA SƯ ra phiếu — không phải tài khoản của KiN.
import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { parseYearMonth } from "@/lib/tuition";
import { loadPartyInvoices } from "@/lib/invoiceServer";

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const raw = new URL(req.url).searchParams.get("yearMonth");
  const ym = raw ? parseYearMonth(raw) : null;
  if (raw && !ym) return NextResponse.json({ error: "yearMonth phải định dạng YYYY-MM" }, { status: 400 });
  const all = await loadPartyInvoices(auth.userId, ym?.yearMonth);
  return NextResponse.json({ invoices: all });
}
