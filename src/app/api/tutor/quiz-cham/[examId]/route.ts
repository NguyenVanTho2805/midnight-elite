// QZ-08: tổng quan chấm quiz của MỘT đề — cấu trúc đề, danh sách bài nộp kèm trạng thái Chờ chấm / Đã chấm / Đã công bố. Chỉ gia sư chủ đề.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireOwnedExam, loadAttemptRows } from "@/lib/quizGradeServer";
import { GRADE_STATE_LABEL } from "@/lib/quizGrade";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const ctx = await requireOwnedExam(examId);
  if (isNextResponse(ctx)) return ctx;
  try {
    const { rows, hasEssay, hold, objectiveMax, essayMax } = await loadAttemptRows(ctx.exam);
    const qs = await prisma.examQuestion.groupBy({ by: ["type"], where: { examId }, _count: { _all: true } });
    const count = (t: string) => qs.find(q => q.type === t)?._count._all ?? 0;
    const counts = { cho: 0, da_cham: 0, cong_bo: 0 };
    for (const r of rows) counts[r.state]++;
    return NextResponse.json({
      exam: { id: ctx.exam.id, title: ctx.exam.title, totalPoints: ctx.exam.totalPoints, courseName: ctx.exam.course?.name ?? null },
      structure: { objectiveQuestions: qs.reduce((s, q) => s + (q.type === "ESSAY" ? 0 : q._count._all), 0), essayQuestions: count("ESSAY"), objectiveMax, essayMax },
      hasEssay, hold, counts, stateLabels: GRADE_STATE_LABEL, attempts: rows,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tutor/quiz-cham/[examId]]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
