// Logic dùng chung giữa /api/question-bank/draw (Giai đoạn 5, môn×độ khó) và
// /api/question-bank/draw-matrix (ma trận chủ đề×độ khó×loại câu) — cả 2 đều
// cần "chống trùng với N đề gần nhất đã dùng ngân hàng" theo đúng cùng 1
// định nghĩa "gần nhất".
import { prisma } from "@/lib/prisma";

// "N đề gần nhất" suy từ ExamQuestion.createdAt (DateTime thật) thay vì
// Exam.createdAt (chỉ là String "DD/MM/YYYY", không tin được để sắp xếp
// cùng ngày) — duyệt các ExamQuestion có sourceBankItemId mới tạo gần đây
// nhất, gom theo examId cho tới khi đủ N đề riêng biệt.
export async function computeExcludedBankItemIds(excludeRecentExams: number): Promise<Set<string>> {
  const excludedIds = new Set<string>();
  const n = Number(excludeRecentExams) || 0;
  if (n <= 0) return excludedIds;

  const recentLinks = await prisma.examQuestion.findMany({
    where: { sourceBankItemId: { not: null } },
    select: { examId: true, sourceBankItemId: true },
    orderBy: { createdAt: "desc" },
    take: 2000, // đủ rộng để phủ N đề gần nhất mà không kéo toàn bộ bảng
  });
  const recentExamIds: string[] = [];
  for (const link of recentLinks) {
    if (!recentExamIds.includes(link.examId)) {
      if (recentExamIds.length >= n) continue;
      recentExamIds.push(link.examId);
    }
  }
  for (const link of recentLinks) {
    if (recentExamIds.includes(link.examId) && link.sourceBankItemId) {
      excludedIds.add(link.sourceBankItemId);
    }
  }
  return excludedIds;
}
