// BU-03 P2 — POST { rows, seed?, scope?, locked?, exclude? } → { picks:[{rowIndex,itemIds,items[]}], shortages, seed }. CHỈ XEM TRƯỚC, không ghi DB.
// Kho = kho thấy được của gia sư (đã duyệt của mọi người ∪ của mình); nháp của gia sư khác không bao giờ được bốc. Không trả tên người.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { drawPreview, failResponse } from "@/lib/deThiServer";

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không đọc được." }, { status: 400 });
    const out = await drawPreview(auth.userId, body);
    if (!out.ok) return failResponse(out);
    return NextResponse.json(out.result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[POST /api/tutor/de-thi/ma-tran/rut]", e);
    return NextResponse.json({ error: "Chưa bốc được câu. Thử lại sau ít phút." }, { status: 500 });
  }
}
