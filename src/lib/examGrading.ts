import { prisma } from "@/lib/prisma";

// Trích số phút từ chuỗi thời lượng dạng "90 phút" — không parse được thì fallback 60.
export function parseDurationMinutes(duration: string): number {
  const m = duration.match(/\d+/);
  return m ? parseInt(m[0], 10) : 60;
}

// Chấm điểm 1 attempt hoàn toàn ở server (không tin điểm từ client), rồi cập nhật
// ExamResult chỉ khi điểm mới cao hơn điểm cũ (leaderboard giữ điểm tốt nhất qua các lần làm lại).
// No-op nếu attempt đã submitted/expired từ trước (idempotent).
export async function finalizeAttempt(
  attemptId: string,
  opts: { status: "submitted" | "expired"; at: Date }
) {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.examAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.status !== "in_progress") return attempt;

    const answers = await tx.examAnswer.findMany({
      where: { attemptId },
      include: {
        option: { select: { isCorrect: true } },
        question: { select: { points: true } },
      },
    });

    const rawEarned = answers.reduce(
      (sum, a) => sum + (a.option?.isCorrect ? a.question.points : 0),
      0
    );
    const rawTotal = attempt.totalPoints ?? 0;
    const score = rawTotal > 0 ? Math.round((rawEarned / rawTotal) * 150 * 100) / 100 : 0;

    const updated = await tx.examAttempt.update({
      where: { id: attemptId },
      data: { status: opts.status, submittedAt: opts.at, score },
    });

    const existing = await tx.examResult.findUnique({
      where: { userId_examId: { userId: attempt.userId, examId: attempt.examId } },
    });

    if (!existing) {
      await tx.examResult.create({
        data: {
          userId: attempt.userId,
          examId: attempt.examId,
          score,
          totalPoints: 150,
          completedAt: opts.at,
        },
      });
      await tx.exam.update({
        where: { id: attempt.examId },
        data: { participants: { increment: 1 } },
      });
    } else if (score > existing.score) {
      await tx.examResult.update({
        where: { userId_examId: { userId: attempt.userId, examId: attempt.examId } },
        data: { score, completedAt: opts.at },
      });
    }

    return updated;
  });
}
