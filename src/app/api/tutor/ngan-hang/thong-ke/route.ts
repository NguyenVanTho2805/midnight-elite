// BU-03 P1 — GET /api/tutor/ngan-hang/thong-ke?root=<id>&scope=mine|shared|all
// Cây ngân hàng câu hỏi kèm số câu theo mức NB/TH/VD/VDC (own = đúng nút, sub = cả cây con) và bảng chương × yêu cầu cần đạt.
// Chỉ gia sư (requireTutor). Chỉ đếm "kho thấy được" (đã duyệt của mọi người ∪ của mình). Không trả tên người, không trả nội dung câu.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { bankStats, isBankScope } from "@/lib/deThiBankServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const sp = new URL(req.url).searchParams;
  const scopeRaw = sp.get("scope");
  if (scopeRaw !== null && scopeRaw !== "" && !isBankScope(scopeRaw)) {
    return NextResponse.json({ error: "scope phải là mine, shared hoặc all.", code: "BAD_SCOPE" }, { status: 400, headers: NO_STORE });
  }
  const scope = scopeRaw && isBankScope(scopeRaw) ? scopeRaw : "all";
  const root = sp.get("root")?.trim() || null;
  try {
    const res = await bankStats(auth.userId, root, scope);
    if (!res) return NextResponse.json({ error: "Không tìm thấy nút ngân hàng này." }, { status: 404, headers: NO_STORE });
    return NextResponse.json(res, { headers: NO_STORE });
  } catch (e) {
    console.error("[GET /api/tutor/ngan-hang/thong-ke]", e);
    return NextResponse.json({ error: "Chưa tải được thống kê ngân hàng. Thử lại sau ít phút." }, { status: 500, headers: NO_STORE });
  }
}
