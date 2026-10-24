// QZ-06: phân tích kết quả quiz — số liệu tổng hợp, KHÔNG có tên học sinh. Chỉ gia sư chủ đề.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireOwnedExam, loadAnalytics } from "@/lib/quizGradeServer";

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const ctx = await requireOwnedExam(examId);
  if (isNextResponse(ctx)) return ctx;
  try {
    return NextResponse.json(await loadAnalytics(ctx.exam), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET quiz-cham thong-ke]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
