// BU-03 P3 — tải Excel kết quả (?chon=dau|cuoi|cao-nhat). Sheet "Tổng quan", "Bảng điểm", "Theo câu"; mọi ô chuỗi/số thuần (không công thức); tên tệp ASCII.
// Có tên học sinh — chỉ gia sư chủ đề. Chưa có lượt nộp → vẫn trả tệp (bảng rỗng).
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { failResponse } from "@/lib/deThiServer";
import { CHON_DEFAULT, isChon } from "@/lib/deThiResults";
import { loadXlsx } from "@/lib/deThiResultsServer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const raw = new URL(req.url).searchParams.get("chon");
    if (raw !== null && !isChon(raw)) return NextResponse.json({ error: "chon phải là dau, cuoi hoặc cao-nhat.", code: "BAD_CHON" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const out = await loadXlsx(auth.userId, id, raw ?? CHON_DEFAULT);
    if (!out.ok) return failResponse(out);
    return new NextResponse(out.bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${out.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[GET /api/tutor/de-thi/[id]/ket-qua/xuat-xlsx]", e);
    return NextResponse.json({ error: "Chưa tạo được tệp Excel. Thử lại sau ít phút." }, { status: 500 });
  }
}
