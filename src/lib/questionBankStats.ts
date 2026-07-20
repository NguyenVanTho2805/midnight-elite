import { prisma } from "@/lib/prisma";
import { normalizeShortAnswer } from "@/lib/examGrading";

export interface BankItemStats {
  usageCount: number; // số ExamQuestion đã copy từ bản ghi này (mọi đề, mọi lần copy)
  examCount: number; // số đề THI KHÁC NHAU có dùng câu này (usageCount có thể > examCount nếu dùng lại nhiều đề)
  correctRatio: number | null; // % học viên trả lời đúng trên tổng lượt trả lời đã nộp bài — null = chưa có dữ liệu hoặc câu ESSAY (chấm tay, không có đúng/sai khách quan)
}

// Giai đoạn 4 — thống kê mức dùng lại + tỉ lệ trả lời đúng của 1 nhóm
// QuestionBankItem, tính trực tiếp trên dữ liệu sống (không cache) qua
// sourceBankItemId (đã có sẵn từ GĐ2/3). Chỉ tính đúng/sai cho MC (option
// isCorrect), SHORT_ANSWER (so khớp text đã chuẩn hoá — cùng logic
// normalizeShortAnswer ở examGrading.ts) và TRUE_FALSE_CLUSTER (tỉ lệ ý đúng
// trong cụm). ESSAY chấm tay — không có đúng/sai khách quan, loại khỏi
// correctRatio.
export async function computeBankItemStats(bankItemIds: string[]): Promise<Map<string, BankItemStats>> {
  const result = new Map<string, BankItemStats>();
  if (bankItemIds.length === 0) return result;

  const examQuestions = await prisma.examQuestion.findMany({
    where: { sourceBankItemId: { in: bankItemIds } },
    select: {
      id: true, examId: true, sourceBankItemId: true, type: true,
      options: { select: { id: true, text: true, isCorrect: true } },
    },
  });
  if (examQuestions.length === 0) return result;

  const questionIds = examQuestions.map(q => q.id);
  const [answers, boolAnswers] = await Promise.all([
    prisma.examAnswer.findMany({
      where: { questionId: { in: questionIds }, attempt: { status: "submitted" } },
      select: { questionId: true, optionId: true, textAnswer: true },
    }),
    prisma.examAnswerBoolean.findMany({
      where: { option: { questionId: { in: questionIds } }, attempt: { status: "submitted" } },
      select: { answerTrue: true, option: { select: { questionId: true, isCorrect: true } } },
    }),
  ]);
  const answersByQuestion = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = answersByQuestion.get(a.questionId) ?? [];
    list.push(a);
    answersByQuestion.set(a.questionId, list);
  }
  const boolAnswersByQuestion = new Map<string, typeof boolAnswers>();
  for (const a of boolAnswers) {
    const qid = a.option.questionId;
    const list = boolAnswersByQuestion.get(qid) ?? [];
    list.push(a);
    boolAnswersByQuestion.set(qid, list);
  }

  const byBankItem = new Map<string, typeof examQuestions>();
  for (const q of examQuestions) {
    const id = q.sourceBankItemId!;
    const list = byBankItem.get(id) ?? [];
    list.push(q);
    byBankItem.set(id, list);
  }

  for (const [bankItemId, questions] of byBankItem) {
    const examCount = new Set(questions.map(q => q.examId)).size;
    let correct = 0, total = 0;

    for (const q of questions) {
      if (q.type === "MC") {
        const optionsById = new Map(q.options.map(o => [o.id, o.isCorrect]));
        for (const a of answersByQuestion.get(q.id) ?? []) {
          if (a.optionId === null) continue;
          total++;
          if (optionsById.get(a.optionId)) correct++;
        }
      } else if (q.type === "SHORT_ANSWER") {
        const correctText = q.options.find(o => o.isCorrect)?.text;
        if (!correctText) continue;
        const normalizedCorrect = normalizeShortAnswer(correctText);
        for (const a of answersByQuestion.get(q.id) ?? []) {
          if (!a.textAnswer) continue;
          total++;
          if (normalizeShortAnswer(a.textAnswer) === normalizedCorrect) correct++;
        }
      } else if (q.type === "TRUE_FALSE_CLUSTER") {
        for (const a of boolAnswersByQuestion.get(q.id) ?? []) {
          if (a.answerTrue === null) continue;
          total++;
          if (a.answerTrue === a.option.isCorrect) correct++;
        }
      }
      // ESSAY: bỏ qua — chấm tay, không có đúng/sai khách quan.
    }

    result.set(bankItemId, {
      usageCount: questions.length,
      examCount,
      correctRatio: total > 0 ? correct / total : null,
    });
  }

  return result;
}
