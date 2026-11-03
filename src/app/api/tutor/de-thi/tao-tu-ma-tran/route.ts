// BU-03 P2 — POST { title, courseId?, blueprintId?, itemIds[], mode?, allowShort? } → 201 { examId, shortages }.
// Tạo đề NHÁP, SAO CHÉP câu + phương án từ ngân hàng (sourceBankItemId giữ dấu vết). Ma trận còn thiếu mà chưa allowShort → 422 SHORTAGE.
// Câu không thuộc kho thấy được → 403; không còn → 404. Lớp lạ → 403 NOT_YOUR_CLASS; không có → 404. Giá luôn null (đề gia sư không bán).
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { createExamFromBank, failResponse } from "@/lib/deThiServer";

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không đọc được." }, { status: 400 });
    const out = await createExamFromBank(auth.userId, body);
    if (!out.ok) return failResponse(out);
    return NextResponse.json({ examId: out.examId, shortages: out.shortages }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tutor/de-thi/tao-tu-ma-tran]", e);
    return NextResponse.json({ error: "Chưa tạo được đề. Thử lại sau ít phút." }, { status: 500 });
  }
}
