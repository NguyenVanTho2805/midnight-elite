import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { finalizeAttempt } from "@/lib/examGrading";

// POST /api/exams/attempts/[attemptId]/submit — chấm điểm hoàn toàn ở server.
// Idempotent: nếu attempt đã submitted/expired trước đó, trả lại kết quả đã có thay vì lỗi.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { attemptId } = await params;

  try {
    const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.userId !== session.userId) {
      return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
    }

    let finalized = attempt;
    if (attempt.status === "in_progress") {
      const now = new Date();
      const cappedAt = now.getTime() > attempt.expiresAt.getTime() ? attempt.expiresAt : now;
      finalized = (await finalizeAttempt(attemptId, { status: "submitted", at: cappedAt })) ?? attempt;
    }

    const bestResult = await prisma.examResult.findUnique({
      where: { userId_examId: { userId: attempt.userId, examId: attempt.examId } },
    });
    const rankBase = bestResult?.score ?? finalized.score ?? 0;
    const above = await prisma.examResult.count({
      where: { examId: attempt.examId, score: { gt: rankBase } },
    });

    return NextResponse.json({
      score: finalized.score,
      totalPoints: 150,
      rank: above + 1,
    });
  } catch (e) {
    console.error("[POST /api/exams/attempts/[attemptId]/submit]", e);
    return NextResponse.json({ error: "Nộp bài thất bại" }, { status: 500 });
  }
}
