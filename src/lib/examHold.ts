// QZ-08: lượt thi nào đang bị GIỮ điểm với học sinh (đề bật "giữ đến khi công bố" và gia sư chưa công bố lượt đó).
// Nơi duy nhất trả lời câu này: các API phía học sinh, bảng xếp hạng (ExamResult) và màn chấm của gia sư đều đi qua đây.
// Đề không có dòng chính sách → không giữ (đề cũ giữ nguyên hành vi). Quy tắc thuần ở quizGrade.isHeld.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { isHeld } from "@/lib/quizGrade";

type Db = Pick<Prisma.TransactionClient, "examPublishPolicy" | "examAttemptPublish">;

export async function isAttemptHeld(db: Db, attempt: { id: string; examId: string }): Promise<boolean> {
  const policy = await db.examPublishPolicy.findUnique({ where: { examId: attempt.examId }, select: { holdUntilPublish: true } });
  if (!policy?.holdUntilPublish) return false;
  const pub = await db.examAttemptPublish.findUnique({ where: { attemptId: attempt.id }, select: { attemptId: true } });
  return isHeld(policy, !!pub);
}

/** Cho nhiều lượt cùng một đề (danh sách lịch sử của học sinh): trả tập id lượt đang bị giữ. */
export async function heldAttemptIds(examId: string, attemptIds: string[]): Promise<Set<string>> {
  const policy = await prisma.examPublishPolicy.findUnique({ where: { examId }, select: { holdUntilPublish: true } });
  if (!policy?.holdUntilPublish || attemptIds.length === 0) return new Set();
  const pubs = await prisma.examAttemptPublish.findMany({ where: { attemptId: { in: attemptIds } }, select: { attemptId: true } });
  const published = new Set(pubs.map(p => p.attemptId));
  return new Set(attemptIds.filter(id => isHeld(policy, published.has(id))));
}
