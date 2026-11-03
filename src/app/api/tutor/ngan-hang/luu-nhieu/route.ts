// BU-03 P1 — POST /api/tutor/ngan-hang/luu-nhieu { categoryId, items: QuizQuestionInput[] (≤200, mỗi câu có thể kèm difficulty/categoryId), defaultDifficulty? }
// → { saved, skippedDuplicate, skippedInvalid, ids }. Lưu hàng loạt vào Ngân hàng câu hỏi: status theo initialStatusFor (gia sư → draft, riêng chủ),
// bỏ trùng contentHash trong cùng nút, KHÔNG gọi nhúng/AI. Câu thiếu đáp án hoặc không có mức (và không có defaultDifficulty) → skippedInvalid.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { saveManyToBank } from "@/lib/deThiBankServer";

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const body = await req.json().catch(() => null) as { categoryId?: unknown; items?: unknown; defaultDifficulty?: unknown } | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không đọc được." }, { status: 400 });
  try {
    const out = await saveManyToBank(auth.userId, auth.adminRole, { categoryId: body.categoryId, items: body.items, defaultDifficulty: body.defaultDifficulty });
    if (!out.ok) return NextResponse.json({ error: out.error, ...(out.code ? { code: out.code } : {}) }, { status: out.status });
    return NextResponse.json(out.result, { status: out.result.saved > 0 ? 201 : 200 });
  } catch (e) {
    console.error("[POST /api/tutor/ngan-hang/luu-nhieu]", e);
    return NextResponse.json({ error: "Chưa lưu được vào ngân hàng. Thử lại sau ít phút." }, { status: 500 });
  }
}
