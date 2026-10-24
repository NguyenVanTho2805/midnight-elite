// QZ-08: lịch sử công bố và sửa điểm của đề (có tên học sinh; chỉ gia sư chủ đề).
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireOwnedExam, loadHistory } from "@/lib/quizGradeServer";

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const ctx = await requireOwnedExam(examId);
  if (isNextResponse(ctx)) return ctx;
  try {
    return NextResponse.json(await loadHistory(ctx.exam), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET quiz-cham history]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
