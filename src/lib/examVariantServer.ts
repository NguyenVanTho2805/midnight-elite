// BU-04 — phần CÓ DB của định tuyến mã đề cho phòng thi học sinh. Luật thuần ở examVariantRoute.ts.
// Mã con mồ côi (đề gốc đã bị xoá thủ công) coi như đề thường: nhóm chỉ có chính nó.
import { prisma } from "@/lib/prisma";
import { memberIds, normalizeMembers, rootIdOf } from "@/lib/examVariantRoute";

export interface ExamGroup {
  rootId: string;
  /** Theo variantNo tăng dần; đề gốc luôn là 1. */
  members: { id: string; variantNo: number }[];
  ids: string[];
}

/** Nhóm mã đề của `examId` (nhận id gốc HOẶC id mã con). Đề không tồn tại → null. */
export async function loadGroup(examId: string): Promise<ExamGroup | null> {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, variantOfId: true } });
  if (!exam) return null;
  let rootId = rootIdOf(exam);
  if (rootId !== exam.id) {
    const root = await prisma.exam.findUnique({ where: { id: rootId }, select: { id: true } });
    if (!root) rootId = exam.id; // mồ côi
  }
  const children = await prisma.exam.findMany({ where: { variantOfId: rootId }, select: { id: true, variantNo: true }, orderBy: { variantNo: "asc" } });
  const members = normalizeMembers(rootId, [{ id: rootId, variantNo: 1 }, ...children]);
  return { rootId, members, ids: memberIds(rootId, members) };
}

/** Số lượt đã tạo của học sinh trong cả nhóm (kể cả đang làm). */
export function countGroupAttempts(userId: string, ids: string[]) {
  return prisma.examAttempt.count({ where: { userId, examId: { in: ids } } });
}

/** Lượt đang làm dở (mới nhất) trong cả nhóm. */
export function findInProgressInGroup(userId: string, ids: string[]) {
  return prisma.examAttempt.findFirst({ where: { userId, examId: { in: ids }, status: "in_progress" }, orderBy: { startedAt: "desc" } });
}

/** Id gốc của một đề (nhận id gốc hoặc id mã con; mồ côi → chính nó). Không có đề → null. */
export async function rootIdOfExam(examId: string): Promise<string | null> {
  return (await loadGroup(examId))?.rootId ?? null;
}
