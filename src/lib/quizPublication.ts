// Đọc trạng thái "đã công bố" của một bài quiz có tự luận, và số lượt tối đa. MÓNG MỎNG cho phía học sinh.
//
// Việc CÔNG BỐ kết quả là của gia sư (agent chấm quiz, bảng riêng). Phía học sinh chỉ đọc qua `loadPublishStates`; khi bảng công bố có mặt,
// chỉ cần nối vào ĐÚNG MỘT chỗ (`readPublishedFlag` bên dưới). Mặc định khi chưa có bảng:
//   - đề CHỈ trắc nghiệm / trả lời ngắn → coi là đã công bố (điểm chấm tự động hiện ngay như trước);
//   - đề CÓ câu tự luận → CHƯA công bố (an toàn: không lộ điểm dở dang, đáp án, lời giải).
import { prisma } from "@/lib/prisma";
import type { PublishState } from "@/lib/quizRoom";

/** NỐI VÀO ĐÂY khi có bảng công bố: trả true nếu gia sư đã công bố kết quả `examId` cho học sinh `userId`. Hiện luôn false (chưa có bảng). */
async function readPublishedFlag(_examId: string, _userId: string): Promise<boolean> {
  return false;
}

/** Trạng thái cho nhiều đề cùng lúc (danh sách kết quả) — 1 truy vấn đếm câu tự luận, không N+1 cho phần công bố khi đề không có tự luận. */
export async function loadPublishStates(examIds: string[], userId: string): Promise<Map<string, PublishState>> {
  const ids = [...new Set(examIds)];
  const out = new Map<string, PublishState>();
  if (ids.length === 0) return out;
  const essay = await prisma.examQuestion.groupBy({ by: ["examId"], where: { examId: { in: ids }, type: "ESSAY" }, _count: { _all: true } });
  const withEssay = new Set(essay.map(e => e.examId));
  for (const id of ids) {
    const hasEssay = withEssay.has(id);
    out.set(id, { hasEssay, published: hasEssay ? await readPublishedFlag(id, userId) : true });
  }
  return out;
}

export async function loadPublishState(examId: string, userId: string): Promise<PublishState> {
  return (await loadPublishStates([examId], userId)).get(examId) ?? { hasEssay: false, published: true };
}

/** Số lượt tối đa của đề; null = không giới hạn. */
export async function getMaxAttempts(examId: string): Promise<number | null> {
  const row = await prisma.quizAttemptLimit.findUnique({ where: { examId } });
  return row && row.maxAttempts > 0 ? row.maxAttempts : null;
}
