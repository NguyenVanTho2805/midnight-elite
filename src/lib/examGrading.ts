import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type ExamQuestionWithOptions = Prisma.ExamQuestionGetPayload<{ include: { options: true } }>;

// Sắp lại câu hỏi/đáp án theo đúng snapshot đã xáo lúc tạo attempt (persist ở
// ExamAttempt.questionOrder/optionOrderByQuestion) — dùng chung cho cả lúc
// bắt đầu và lúc resume (GET), để 2 lần gọi luôn trả về đúng 1 thứ tự suốt
// attempt. Attempt cũ (tạo trước khi có tính năng này) không có snapshot —
// fallback về thứ tự gốc theo `order`, không phá dữ liệu đang làm dở.
export function applyAttemptOrder(
  examQuestions: ExamQuestionWithOptions[],
  attempt: { questionOrder: unknown; optionOrderByQuestion: unknown }
) {
  const questionsById = new Map(examQuestions.map(q => [q.id, q]));
  const savedQuestionOrder = attempt.questionOrder as string[] | null;
  const orderedQuestions = savedQuestionOrder?.length
    ? savedQuestionOrder.map(qid => questionsById.get(qid)).filter((q): q is ExamQuestionWithOptions => !!q)
    : examQuestions;

  const savedOptionOrder = attempt.optionOrderByQuestion as Record<string, string[]> | null;
  return orderedQuestions.map(q => {
    const optionsById = new Map(q.options.map(o => [o.id, o]));
    const optionOrder = savedOptionOrder?.[q.id];
    const orderedOptions = optionOrder?.length
      ? optionOrder.map(oid => optionsById.get(oid)).filter((o): o is ExamQuestionWithOptions["options"][number] => !!o)
      : q.options;
    return {
      id: q.id,
      order: q.order,
      text: q.text,
      imageUrl: q.imageUrl,
      points: q.points,
      options: orderedOptions.map(o => ({ id: o.id, order: o.order, text: o.text })),
    };
  });
}

// Trích số phút từ chuỗi thời lượng dạng "90 phút" — không parse được thì fallback 60.
export function parseDurationMinutes(duration: string): number {
  const m = duration.match(/\d+/);
  return m ? parseInt(m[0], 10) : 60;
}

// Fisher-Yates — dùng để xáo thứ tự câu hỏi/đáp án mỗi lượt thi mới (chống
// chép bài). Không đổi ID, chỉ đổi thứ tự hiển thị, nên không ảnh hưởng logic
// chấm điểm (vẫn dựa vào optionId/isCorrect, không dựa vào vị trí).
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
