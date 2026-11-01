// BU-03 P3 — kết quả một đề: 5 khối (cơ bản · phân bố 5 khoảng % · tần số bước 0,5 · từng câu gộp theo variantKey · theo mã đề). KHÔNG có tên học sinh.
// id phải là đề GỐC (mã đề con → 400 IS_VARIANT). Chưa có lượt nộp → 200 với số liệu rỗng.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { failResponse } from "@/lib/deThiServer";
import { loadKetQua } from "@/lib/deThiResultsServer";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const out = await loadKetQua(auth.userId, id);
    if (!out.ok) return failResponse(out);
    return NextResponse.json(out.ketQua, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tutor/de-thi/[id]/ket-qua]", e);
    return NextResponse.json({ error: "Chưa tải được kết quả. Thử lại sau ít phút." }, { status: 500 });
  }
}
