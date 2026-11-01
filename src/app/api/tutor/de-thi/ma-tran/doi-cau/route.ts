// BU-03 P2 — POST { rows, rowIndex, itemId, current[], seed, scope?, exclude? } → { itemId, item } hoặc 409 NO_ALTERNATIVE. Chỉ xem trước, không ghi DB.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { failResponse, swapPreview } from "@/lib/deThiServer";

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không đọc được." }, { status: 400 });
    const out = await swapPreview(auth.userId, body);
    if (!out.ok) return failResponse(out);
    return NextResponse.json({ itemId: out.itemId, item: out.item }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[POST /api/tutor/de-thi/ma-tran/doi-cau]", e);
    return NextResponse.json({ error: "Chưa đổi được câu. Thử lại sau ít phút." }, { status: 500 });
  }
}
