import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { finalizeAttempt, parseDurationMinutes } from "@/lib/examGrading";

// POST /api/exams/[id]/start — tạo attempt mới hoặc resume attempt in_progress đang có.
// Idempotent: gọi lại nhiều lần (vd sau khi refresh trang) sẽ trả về cùng 1 attempt
// kèm các câu trả lời đã lưu, cho tới khi attempt đó submit hoặc hết giờ.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id: examId } = await params;

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examQuestions: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
    });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (exam.examQuestions.length === 0) {
      return NextResponse.json(
        { error: "Đề thi này chưa có câu hỏi trong platform" },
        { status: 409 }
      );
    }

    let attempt = await prisma.examAttempt.findFirst({
      where: { userId: session.userId, examId, status: "in_progress" },
      orderBy: { startedAt: "desc" },
    });

    // Lazy-expiry: attempt cũ đã hết giờ nhưng chưa được chấm — chấm luôn rồi tạo attempt mới
    if (attempt && attempt.expiresAt.getTime() <= Date.now()) {
      await finalizeAttempt(attempt.id, { status: "expired", at: attempt.expiresAt });
      attempt = null;
    }

    if (!attempt) {
      const totalPoints = exam.examQuestions.reduce((sum, q) => sum + q.points, 0);
      const minutes = parseDurationMinutes(exam.duration);
      attempt = await prisma.examAttempt.create({
        data: {
          userId: session.userId,
          examId,
          expiresAt: new Date(Date.now() + minutes * 60_000),
          totalPoints,
        },
      });
    }

    const savedAnswers = await prisma.examAnswer.findMany({ where: { attemptId: attempt.id } });
    const answers: Record<string, string | null> = {};
    for (const a of savedAnswers) answers[a.questionId] = a.optionId;

    const questions = exam.examQuestions.map(q => ({
      id: q.id,
      order: q.order,
      text: q.text,
      imageUrl: q.imageUrl,
      points: q.points,
      options: q.options.map(o => ({ id: o.id, order: o.order, text: o.text })),
    }));

    return NextResponse.json({
      attemptId: attempt.id,
      expiresAt: attempt.expiresAt,
      questions,
      answers,
    });
  } catch (e) {
    console.error("[POST /api/exams/[id]/start]", e);
    return NextResponse.json({ error: "Không thể bắt đầu bài thi" }, { status: 500 });
  }
}
