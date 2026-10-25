// Lượt thi nào đang bị GIỮ điểm với học sinh. MỘT nguồn sự thật cho cả QZ-08 (chấm quiz hỗn hợp) và QZ-11 (phòng thi của học sinh):
// các API phía học sinh, bảng xếp hạng (ExamResult), báo cáo tháng, bảng vinh danh và màn chấm của gia sư đều đi qua đây.
// Quy tắc thuần ở quizGrade.examHoldsResults / isHeld:
//   - đề có dòng chính sách (exam_publish_policies) → theo dòng đó;
//   - chưa có dòng → đề CÓ tự luận tạo từ mốc HOLD_DEFAULT_SINCE thì giữ; đề cũ / không tự luận → không giữ (hành vi cũ);
//   - đang giữ mà lượt đã có dòng công bố (exam_attempt_publishes) → hiện.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { examHoldsResults } from "@/lib/quizGrade";

type Db = Pick<Prisma.TransactionClient, "examPublishPolicy" | "examAttemptPublish" | "exam" | "examQuestion">;

/** Đề này có giữ điểm tới khi công bố không (chưa xét lượt). Đề không tồn tại → false. */
export async function examHolds(db: Db, examId: string): Promise<boolean> {
  const policy = await db.examPublishPolicy.findUnique({ where: { examId }, select: { holdUntilPublish: true } });
  if (policy) return policy.holdUntilPublish;
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { createdAt: true } });
  if (!exam) return false;
  const essay = await db.examQuestion.count({ where: { examId, type: "ESSAY" } });
  return examHoldsResults(null, { hasEssay: essay > 0, createdAt: exam.createdAt });
}

export async function isAttemptHeld(db: Db, attempt: { id: string; examId: string }): Promise<boolean> {
  if (!(await examHolds(db, attempt.examId))) return false;
  const pub = await db.examAttemptPublish.findUnique({ where: { attemptId: attempt.id }, select: { attemptId: true } });
  return !pub;
}

/** Cho nhiều lượt cùng một đề (danh sách lịch sử của học sinh): trả tập id lượt đang bị giữ. */
export async function heldAttemptIds(examId: string, attemptIds: string[]): Promise<Set<string>> {
  if (attemptIds.length === 0 || !(await examHolds(prisma, examId))) return new Set();
  const pubs = await prisma.examAttemptPublish.findMany({ where: { attemptId: { in: attemptIds } }, select: { attemptId: true } });
  const published = new Set(pubs.map(p => p.attemptId));
  return new Set(attemptIds.filter(id => !published.has(id)));
}

/** Trong các đề này, đề nào đang giữ điểm (không xét lượt). Dùng cho các phép tổng hợp (xếp hạng, GPA, báo cáo). */
export async function holdingExamIds(examIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(examIds)];
  if (ids.length === 0) return new Set();
  const [policies, exams, essays] = await Promise.all([
    prisma.examPublishPolicy.findMany({ where: { examId: { in: ids } }, select: { examId: true, holdUntilPublish: true } }),
    prisma.exam.findMany({ where: { id: { in: ids } }, select: { id: true, createdAt: true } }),
    prisma.examQuestion.groupBy({ by: ["examId"], where: { examId: { in: ids }, type: "ESSAY" }, _count: { _all: true } }),
  ]);
  const pol = new Map(policies.map(p => [p.examId, p]));
  const hasEssay = new Set(essays.map(e => e.examId));
  const out = new Set<string>();
  for (const e of exams) if (examHoldsResults(pol.get(e.id) ?? null, { hasEssay: hasEssay.has(e.id), createdAt: e.createdAt })) out.add(e.id);
  return out;
}

/** Id các lượt (trong tập đưa vào) đang bị giữ — theo từng đề. Dùng khi phép tổng hợp đọc thẳng ExamAttempt. */
export async function heldAttemptIdsAmong(attempts: { id: string; examId: string }[]): Promise<Set<string>> {
  if (attempts.length === 0) return new Set();
  const holding = await holdingExamIds(attempts.map(a => a.examId));
  const cand = attempts.filter(a => holding.has(a.examId));
  if (cand.length === 0) return new Set();
  const pubs = await prisma.examAttemptPublish.findMany({ where: { attemptId: { in: cand.map(a => a.id) } }, select: { attemptId: true } });
  const published = new Set(pubs.map(p => p.attemptId));
  return new Set(cand.filter(a => !published.has(a.id)).map(a => a.id));
}

/**
 * Bỏ các dòng ExamResult (điểm vào bảng xếp hạng / GPA / báo cáo) thuộc đề đang GIỮ điểm mà học sinh đó chưa được công bố lượt nào.
 * finalizeAttempt vốn đã không ghi ExamResult khi đang giữ, nhưng dòng cũ (trước khi gia sư bật giữ điểm, hoặc sau khi chấm lại) có thể còn —
 * mọi phép TỔNG HỢP điểm (xếp hạng, GPA tháng, báo cáo phụ huynh, bảng vinh danh) đi qua đây để số của đề đang giữ không lọt vào.
 * Đề không giữ → trả nguyên, số không đổi.
 */
export async function dropHeldResults<T extends { userId: string; examId: string }>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;
  const holding = await holdingExamIds(rows.map(r => r.examId));
  if (holding.size === 0) return rows;
  const pubs = await prisma.examAttemptPublish.findMany({ where: { examId: { in: [...holding] } }, select: { attemptId: true } });
  const owners = pubs.length === 0 ? [] : await prisma.examAttempt.findMany({ where: { id: { in: pubs.map(p => p.attemptId) } }, select: { userId: true, examId: true } });
  const published = new Set(owners.map(o => `${o.userId}|${o.examId}`));
  return rows.filter(r => !holding.has(r.examId) || published.has(`${r.userId}|${r.examId}`));
}
