import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { regradeAttempt } from "@/lib/examGrading";

// PATCH /api/exams/attempts/[attemptId]/answers/[questionId]/grade — giáo
// viên: chấm điểm + nhận xét 1 câu tự luận, chấm lại điểm tổng attempt ngay
// sau đó (không chờ học viên nộp lại — bài đã nộp rồi).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string; questionId: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { attemptId, questionId } = await params;

  try {
    const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });

    const exam = await prisma.exam.findUnique({ where: { id: attempt.examId }, select: { ownerId: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (!ownsResource(auth, exam.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
    }

    const question = await prisma.examQuestion.findFirst({ where: { id: questionId, type: "ESSAY" } });
    if (!question) return NextResponse.json({ error: "Câu hỏi không hợp lệ (không phải tự luận)" }, { status: 400 });

    const { points, comment } = await req.json() as { points?: number; comment?: string };
    if (typeof points !== "number" || isNaN(points) || points < 0 || points > question.points) {
      return NextResponse.json({ error: `Điểm phải từ 0 đến ${question.points}` }, { status: 400 });
    }

    await prisma.examAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: { attemptId, questionId, pointsAwarded: points, teacherComment: comment?.trim() || null },
      update: { pointsAwarded: points, teacherComment: comment?.trim() || null },
    });

    const updated = await regradeAttempt(attemptId);

    return NextResponse.json({ success: true, score: updated?.score ?? null });
  } catch (e) {
    console.error("[PATCH /api/exams/attempts/[attemptId]/answers/[questionId]/grade]", e);
    return NextResponse.json({ error: "Chấm điểm thất bại" }, { status: 400 });
  }
}
