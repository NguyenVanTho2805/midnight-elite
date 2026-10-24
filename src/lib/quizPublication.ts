// Trạng thái "đã công bố" của một bài quiz với học sinh, và số lượt tối đa — phía học sinh CHỈ ĐỌC qua đây.
//
// MỘT nguồn sự thật với phía gia sư (QZ-08): việc giữ/công bố nằm ở src/lib/examHold.ts (bảng exam_publish_policies + exam_attempt_publishes).
//   - đề có tự luận tạo mới (hoặc gia sư bật chính sách) → GIỮ điểm, đáp án, lời giải tới khi gia sư công bố lượt đó;
//   - đề cũ / không tự luận (và chưa có chính sách) → coi là đã công bố, điểm tự chấm hiện ngay như trước.
import { prisma } from "@/lib/prisma";
import type { PublishState } from "@/lib/quizRoom";
import { examHolds } from "@/lib/examHold";

/** Đã có dòng công bố trong exam_attempt_publishes chưa: theo một lượt cụ thể, hoặc (không đưa lượt) lượt nào của học sinh này ở đề này. */
async function readPublishedFlag(examId: string, userId: string, attemptId?: string): Promise<boolean> {
  if (attemptId) {
    const own = await prisma.examAttempt.findFirst({ where: { id: attemptId, examId, userId }, select: { id: true } });
    if (!own) return false; // lượt không phải của học sinh này → không bao giờ coi là đã công bố
    return !!(await prisma.examAttemptPublish.findUnique({ where: { attemptId }, select: { attemptId: true } }));
  }
  const mine = await prisma.examAttempt.findMany({ where: { examId, userId }, select: { id: true } });
  if (mine.length === 0) return false;
  return (await prisma.examAttemptPublish.count({ where: { attemptId: { in: mine.map(a => a.id) } } })) > 0;
}

/** Trạng thái cho nhiều đề cùng lúc (danh sách kết quả). */
export async function loadPublishStates(examIds: string[], userId: string): Promise<Map<string, PublishState>> {
  const ids = [...new Set(examIds)];
  const out = new Map<string, PublishState>();
  if (ids.length === 0) return out;
  const essay = await prisma.examQuestion.groupBy({ by: ["examId"], where: { examId: { in: ids }, type: "ESSAY" }, _count: { _all: true } });
  const withEssay = new Set(essay.map(e => e.examId));
  for (const id of ids) {
    const hold = await examHolds(prisma, id);
    out.set(id, { hasEssay: withEssay.has(id), hold, published: hold ? await readPublishedFlag(id, userId) : true });
  }
  return out;
}

/** `attemptId` (nếu có) → xét đúng lượt đó; không có → xét mức đề (học sinh đã được công bố lượt nào chưa). */
export async function loadPublishState(examId: string, userId: string, attemptId?: string): Promise<PublishState> {
  const hold = await examHolds(prisma, examId);
  const essay = hold ? true : (await prisma.examQuestion.count({ where: { examId, type: "ESSAY" } })) > 0;
  return { hasEssay: essay, hold, published: hold ? await readPublishedFlag(examId, userId, attemptId) : true };
}

/** Số lượt tối đa của đề; null = không giới hạn. */
export async function getMaxAttempts(examId: string): Promise<number | null> {
  const row = await prisma.quizAttemptLimit.findUnique({ where: { examId } });
  return row && row.maxAttempts > 0 ? row.maxAttempts : null;
}
