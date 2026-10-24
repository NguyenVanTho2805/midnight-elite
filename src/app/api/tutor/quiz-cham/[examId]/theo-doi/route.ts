// QZ-06: theo dõi lượt làm theo học sinh (có tên; chỉ gia sư chủ đề): số lượt, đang làm dở, rời tab, học sinh trong lớp chưa làm.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireOwnedExam, loadTracking } from "@/lib/quizGradeServer";

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const ctx = await requireOwnedExam(examId);
  if (isNextResponse(ctx)) return ctx;
  try {
    return NextResponse.json(await loadTracking(ctx.exam, ctx.auth.userId), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET quiz-cham theo-doi]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
