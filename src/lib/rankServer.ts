// STU-003 — hạng của một học sinh theo điểm đề tốt nhất, TÍNH Ở CƠ SỞ DỮ LIỆU thay vì tải cả bảng điểm rồi gộp trong bộ nhớ.
// Ngữ nghĩa GIỮ NGUYÊN hàm cũ của GET /api/users/me/stats: mỗi người có "điểm tốt nhất" = max điểm trên các đề đã công bố / không giữ điểm (examHold);
// hạng = 1 + số người có điểm tốt nhất CAO HƠN `myBest` (đồng điểm cùng hạng). Chỉ trả SỐ — không có tên hay mã người nào ra khỏi hàm.
import { prisma } from "@/lib/prisma";
import { dropHeldResults, holdingExamIds } from "@/lib/examHold";

/**
 * Số người có điểm tốt nhất > myBest.
 * - Không đề nào đang giữ điểm (trường hợp thường): MỘT truy vấn gộp ở máy chủ cơ sở dữ liệu (GROUP BY userId HAVING MAX(score) > myBest), chỉ trả mã người "hơn mình".
 * - Có đề đang giữ điểm: điểm của từng người phụ thuộc lượt đã công bố (examHold) nên gộp phần KHÔNG giữ ở cơ sở dữ liệu, chỉ tải riêng các dòng của đề đang giữ
 *   (ít) rồi gộp hai phần — vẫn chính xác như hàm cũ nhưng không còn tải toàn bộ bảng điểm.
 */
export async function countUsersWithBetterBest(myBest: number): Promise<number> {
  const examIds = (await prisma.examResult.groupBy({ by: ["examId"] })).map(g => g.examId);
  const holding = await holdingExamIds(examIds);
  if (holding.size === 0) {
    const better = await prisma.examResult.groupBy({ by: ["userId"], having: { score: { _max: { gt: myBest } } } });
    return better.length;
  }
  const heldIds = [...holding];
  const [plain, heldRows] = await Promise.all([
    prisma.examResult.groupBy({ by: ["userId"], where: { examId: { notIn: heldIds } }, _max: { score: true } }),
    prisma.examResult.findMany({ where: { examId: { in: heldIds } }, select: { userId: true, examId: true, score: true } }),
  ]);
  const best = new Map<string, number>();
  for (const p of plain) if (p._max.score !== null) best.set(p.userId, p._max.score);
  for (const r of await dropHeldResults(heldRows)) best.set(r.userId, Math.max(best.get(r.userId) ?? 0, r.score));
  let n = 0;
  for (const b of best.values()) if (b > myBest) n++;
  return n;
}

/** Cách TÍNH CŨ (tải hết rồi gộp trong bộ nhớ) — giữ làm chuẩn đối chiếu trong test, KHÔNG dùng ở đường chạy. */
export async function countUsersWithBetterBestLegacy(myBest: number): Promise<number> {
  const everyone = await dropHeldResults(await prisma.examResult.findMany({ select: { userId: true, examId: true, score: true } }));
  const bestByUser = new Map<string, number>();
  for (const r of everyone) bestByUser.set(r.userId, Math.max(bestByUser.get(r.userId) ?? 0, r.score));
  return [...bestByUser.values()].filter(b => b > myBest).length;
}
