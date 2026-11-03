// BU-03 P2 — GET /api/tutor/de-thi?lop=&trangThai= → { items } các đề GỐC của gia sư (mã đề con gộp vào đề gốc, phiên bản cũ ẩn).
// Mỗi dòng: { id, title, status (draft|upcoming|available|completed), mode, variants (số mã), questionCount, courseId, courseName, updatedAt, extractedFrom }.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { failResponse, listRootExams } from "@/lib/deThiServer";

export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const sp = new URL(req.url).searchParams;
    const out = await listRootExams(auth.userId, { lop: sp.get("lop"), trangThai: sp.get("trangThai") });
    if (!out.ok) return failResponse(out);
    return NextResponse.json({ items: out.items }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tutor/de-thi]", e);
    return NextResponse.json({ error: "Chưa tải được danh sách đề. Thử lại sau ít phút." }, { status: 500 });
  }
}
