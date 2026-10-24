import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { finalizeAttempt } from "@/lib/examGrading";
import { isAttemptHeld } from "@/lib/examHold";
import { computeQuizReward } from "@/lib/quizReward";
import { addQuizRewardCoins } from "@/lib/wallet";
import { MAX_QUIZ_REWARDS_PER_DAY } from "@/lib/wallet-constants";

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
    let justSubmitted = false;
    let lateSubmit = false;
    if (attempt.status === "in_progress") {
      const now = new Date();
      lateSubmit = now.getTime() > attempt.expiresAt.getTime(); // điểm vẫn chốt tại hạn, nhưng nộp trễ thì không thưởng Coin
      const cappedAt = lateSubmit ? attempt.expiresAt : now;
      finalized = (await finalizeAttempt(attemptId, { status: "submitted", at: cappedAt })) ?? attempt;
      justSubmitted = finalized.status === "submitted";
    }

    const [bestResult, exam] = await Promise.all([
      prisma.examResult.findUnique({
        where: { userId_examId: { userId: attempt.userId, examId: attempt.examId } },
      }),
      prisma.exam.findUnique({ where: { id: attempt.examId }, select: { totalPoints: true, ownerId: true } }),
    ]);

    // Thưởng Coin làm bài: chỉ học sinh, chỉ lượt vừa nộp đúng hạn, không phải đề của chính mình.
    // Lỗi ở đây không được làm hỏng việc nộp bài (điểm đã chốt) nên nuốt lỗi.
    let coinsEarned = 0;
    if (justSubmitted && !lateSubmit && session.role === "student" && exam && exam.ownerId !== attempt.userId) {
      try {
        const r = computeQuizReward({
          status: finalized.status, score: finalized.score, examTotalPoints: exam.totalPoints,
          startedAt: attempt.startedAt, submittedAt: finalized.submittedAt, expiresAt: attempt.expiresAt,
          tabSwitchCount: attempt.tabSwitchCount,
        });
        if (r.coins > 0 && (await addQuizRewardCoins(attempt.userId, r.coins, attempt.examId, MAX_QUIZ_REWARDS_PER_DAY)) === "granted") coinsEarned = r.coins;
      } catch (e) {
        console.error("[quiz reward]", e);
      }
    }

    // QZ-08: đề giữ điểm đến khi gia sư công bố → không trả điểm, không trả hạng (rank 0 = chưa có hạng).
    if (await isAttemptHeld(prisma, attempt)) {
      return NextResponse.json({ score: null, held: true, totalPoints: exam?.totalPoints ?? 150, rank: 0, coinsEarned });
    }

    const rankBase = bestResult?.score ?? finalized.score ?? 0;
    const above = await prisma.examResult.count({
      where: { examId: attempt.examId, score: { gt: rankBase } },
    });

    return NextResponse.json({
      score: finalized.score,
      totalPoints: exam?.totalPoints ?? 150,
      rank: above + 1,
      coinsEarned,
    });
  } catch (e) {
    console.error("[POST /api/exams/attempts/[attemptId]/submit]", e);
    return NextResponse.json({ error: "Nộp bài thất bại" }, { status: 500 });
  }
}
