import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type ExamQuestionWithOptions = Prisma.ExamQuestionGetPayload<{ include: { options: true } }>;

// Sắp lại câu hỏi/đáp án theo đúng snapshot đã xáo lúc tạo attempt (persist ở
// ExamAttempt.questionOrder/optionOrderByQuestion) — giữ nguyên toàn bộ field
// gốc (kể cả isCorrect/explanation). CHỈ dùng cho các route đã tự kiểm tra
// quyền xem đáp án (admin, hoặc review sau khi nộp) — KHÔNG dùng trực tiếp
// cho lúc học viên đang làm bài (dùng applyAttemptOrder bên dưới, đã lược
// isCorrect/explanation, cho trường hợp đó).
export function orderQuestionsAndOptionsFull(
  examQuestions: ExamQuestionWithOptions[],
  attempt: { questionOrder: unknown; optionOrderByQuestion: unknown }
): ExamQuestionWithOptions[] {
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
    return { ...q, options: orderedOptions };
  });
}

// Bản "an toàn cho học viên" của trên — lược isCorrect/explanation, dùng lúc
// đang làm bài (start/resume), trước khi biết học viên có được xem đáp án
// hay không.
export function applyAttemptOrder(
  examQuestions: ExamQuestionWithOptions[],
  attempt: { questionOrder: unknown; optionOrderByQuestion: unknown }
) {
  return orderQuestionsAndOptionsFull(examQuestions, attempt).map(q => ({
    id: q.id,
    order: q.order,
    type: q.type,
    text: q.text,
    imageUrl: q.imageUrl,
    points: q.points,
    options: q.options.map(o => ({ id: o.id, order: o.order, text: o.text, subLabel: o.subLabel })),
  }));
}

// Thang % điểm câu Đúng-Sai 4 ý theo số ý trả lời đúng (index = số ý đúng
// 0-4) — mặc định theo Azota (10/25/50/100%). Giáo viên có thể tuỳ chỉnh qua
// Exam.clusterScorePercents (Giai đoạn 7) — mảng 4 số [1 ý, 2 ý, 3 ý, 4 ý đúng]
// tính theo %, vd [10,25,50,100].
const DEFAULT_CLUSTER_PERCENT_BY_CORRECT_COUNT = [0, 0.1, 0.25, 0.5, 1] as const;

export function getClusterPercentTable(clusterScorePercents: unknown): readonly number[] {
  if (!Array.isArray(clusterScorePercents) || clusterScorePercents.length !== 4) {
    return DEFAULT_CLUSTER_PERCENT_BY_CORRECT_COUNT;
  }
  const nums = clusterScorePercents.map(Number);
  if (nums.some(n => !Number.isFinite(n) || n < 0 || n > 100)) {
    return DEFAULT_CLUSTER_PERCENT_BY_CORRECT_COUNT;
  }
  return [0, ...nums.map(n => n / 100)];
}

// Tải toàn bộ câu trả lời đã lưu của 1 attempt, gộp cả 3 dạng (MC: optionId,
// ESSAY: textAnswer, TRUE_FALSE_CLUSTER: answers theo từng optionId con) —
// dùng chung cho lúc bắt đầu (POST start) và lúc resume (GET attempt).
export async function loadAnswerState(attemptId: string) {
  const [savedAnswers, boolAnswers] = await Promise.all([
    prisma.examAnswer.findMany({ where: { attemptId } }),
    prisma.examAnswerBoolean.findMany({ where: { attemptId } }),
  ]);

  const answers: Record<string, string | null> = {};
  const textAnswers: Record<string, string> = {};
  for (const a of savedAnswers) {
    if (a.optionId) answers[a.questionId] = a.optionId;
    if (a.textAnswer !== null) textAnswers[a.questionId] = a.textAnswer;
  }

  const boolAnswersByOption: Record<string, boolean | null> = {};
  for (const a of boolAnswers) boolAnswersByOption[a.optionId] = a.answerTrue;

  return { answers, textAnswers, boolAnswersByOption };
}

// Trích số phút từ chuỗi thời lượng dạng "90 phút" — không parse được thì fallback 60.
export function parseDurationMinutes(duration: string): number {
  const m = duration.match(/\d+/);
  return m ? parseInt(m[0], 10) : 60;
}

// "Đã hết thời hạn làm bài của đề" (không phải hết giờ của 1 attempt cụ thể)
// — dùng cho answerVisibility === "after_exam_ends". Tính tại chỗ từ
// date+time+duration thay vì dựa vào Exam.status (field đó chỉ được cập nhật
// khi admin sửa đề, có thể cũ so với thời gian thật).
export function hasExamWindowEnded(exam: { date: string; time: string; duration: string }): boolean {
  const [day, month, year] = (exam.date || "01/01/2000").split("/");
  const [hh, mm] = (exam.time || "00:00").split(":");
  const startsAt = new Date(+year, +month - 1, +day, +hh, +mm);
  const endsAt = new Date(startsAt.getTime() + parseDurationMinutes(exam.duration) * 60_000);
  return endsAt.getTime() <= Date.now();
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

type Tx = Prisma.TransactionClient;

// Tính tổng điểm thô (thang gốc theo points từng câu, chưa quy đổi /150) của
// 1 attempt — dùng chung cho lúc nộp bài lần đầu (finalizeAttempt) và lúc
// chấm/sửa điểm tự luận sau đó (regradeAttempt). Tách riêng vì 2 nơi gọi có
// vòng đời transaction khác nhau nhưng công thức tính điểm phải giống hệt.
async function computeRawEarned(tx: Tx, attempt: { id: string; examId: string }): Promise<number> {
  // MC: cộng điểm nếu optionId đã chọn đúng là đáp án đúng. ESSAY dùng điểm
  // giáo viên đã chấm tay (pointsAwarded), null = chưa chấm = cộng 0.
  // TRUE_FALSE_CLUSTER không nằm trong bảng này (xem dưới, trả lời ở bảng khác).
  const answers = await tx.examAnswer.findMany({
    where: { attemptId: attempt.id },
    include: {
      option: { select: { isCorrect: true } },
      question: { select: { points: true, type: true } },
    },
  });
  let rawEarned = answers.reduce((sum, a) => {
    if (a.question.type === "MC") return sum + (a.option?.isCorrect ? a.question.points : 0);
    if (a.question.type === "ESSAY") return sum + (a.pointsAwarded ?? 0);
    return sum;
  }, 0);

  // TRUE_FALSE_CLUSTER: chấm theo % số ý đúng trong cụm 4 ý (thang mặc định
  // hoặc Exam.clusterScorePercents nếu giáo viên đã tuỳ chỉnh) — trả lời nằm
  // ở ExamAnswerBoolean, không phải ExamAnswer, nên cộng riêng ở đây.
  const clusterQuestions = await tx.examQuestion.findMany({
    where: { examId: attempt.examId, type: "TRUE_FALSE_CLUSTER" },
    include: { options: true },
  });
  if (clusterQuestions.length > 0) {
    const exam = await tx.exam.findUnique({ where: { id: attempt.examId }, select: { clusterScorePercents: true } });
    const percentTable = getClusterPercentTable(exam?.clusterScorePercents);

    const boolAnswers = await tx.examAnswerBoolean.findMany({
      where: { attemptId: attempt.id },
      include: { option: { select: { questionId: true, isCorrect: true } } },
    });
    const byQuestion = new Map<string, typeof boolAnswers>();
    for (const a of boolAnswers) {
      const qid = a.option.questionId;
      const list = byQuestion.get(qid) ?? [];
      list.push(a);
      byQuestion.set(qid, list);
    }
    for (const q of clusterQuestions) {
      const given = byQuestion.get(q.id) ?? [];
      const correctCount = given.filter(a => a.answerTrue !== null && a.answerTrue === a.option.isCorrect).length;
      const pct = percentTable[Math.min(correctCount, 4)];
      rawEarned += q.points * pct;
    }
  }

  return rawEarned;
}

// Cập nhật ExamResult (bảng xếp hạng) theo đúng quy tắc "giữ điểm tốt nhất
// qua các lần làm lại" đã dùng xuyên suốt hệ thống — dùng chung cho nộp bài
// lần đầu và cho chấm lại tự luận sau đó.
async function upsertBestResult(tx: Tx, attempt: { userId: string; examId: string }, score: number, at: Date) {
  const existing = await tx.examResult.findUnique({
    where: { userId_examId: { userId: attempt.userId, examId: attempt.examId } },
  });

  if (!existing) {
    await tx.examResult.create({
      data: { userId: attempt.userId, examId: attempt.examId, score, totalPoints: 150, completedAt: at },
    });
    await tx.exam.update({ where: { id: attempt.examId }, data: { participants: { increment: 1 } } });
  } else if (score > existing.score) {
    await tx.examResult.update({
      where: { userId_examId: { userId: attempt.userId, examId: attempt.examId } },
      data: { score, completedAt: at },
    });
  }
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

    const rawEarned = await computeRawEarned(tx, attempt);
    const rawTotal = attempt.totalPoints ?? 0;
    const score = rawTotal > 0 ? Math.round((rawEarned / rawTotal) * 150 * 100) / 100 : 0;

    const updated = await tx.examAttempt.update({
      where: { id: attemptId },
      data: { status: opts.status, submittedAt: opts.at, score },
    });

    await upsertBestResult(tx, attempt, score, opts.at);

    return updated;
  });
}

// Chấm lại điểm sau khi giáo viên sửa điểm 1 câu tự luận (Giai đoạn 6) — khác
// finalizeAttempt ở chỗ áp dụng được cho attempt đã "submitted" từ trước
// (không no-op), vì mục đích chính là cập nhật điểm sau khi bài đã nộp.
export async function regradeAttempt(attemptId: string) {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.examAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.status === "in_progress") return attempt;

    const rawEarned = await computeRawEarned(tx, attempt);
    const rawTotal = attempt.totalPoints ?? 0;
    const score = rawTotal > 0 ? Math.round((rawEarned / rawTotal) * 150 * 100) / 100 : 0;

    const updated = await tx.examAttempt.update({ where: { id: attemptId }, data: { score } });
    await upsertBestResult(tx, attempt, score, attempt.submittedAt ?? new Date());

    return updated;
  });
}
