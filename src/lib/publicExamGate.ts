// DG (14/11/2026): chặn link trực tiếp tới đề thi thử CÔNG KHAI của KiN khi cờ THI_THU_CONG_KHAI tắt.
// "Đề thi thử công khai" = đề không gắn lớp VÀ không do gia sư làm chủ (quản trị KiN soạn, hoặc không còn chủ).
// Đề riêng của gia sư không gắn lớp KHÔNG bị chặn: gia sư vẫn gửi link đề đó cho học sinh của mình như trước. Đề gắn lớp không bị ảnh hưởng.
import { prisma } from "@/lib/prisma";
import { publicExamClosed } from "@/lib/features";

/** THUẦN. true = đề này là thi thử công khai đang đóng. `ownerAdminRole` = adminRole của chủ đề (null khi không có chủ). */
export function isClosedPublicExam(i: { courseId: string | null | undefined; ownerAdminRole: string | null | undefined }, env?: Parameters<typeof publicExamClosed>[1]): boolean {
  if (!publicExamClosed(i.courseId, env)) return false;
  return i.ownerAdminRole !== "teacher";
}

/** Đọc chủ đề từ DB rồi áp isClosedPublicExam. */
export async function closedPublicExam(exam: { courseId: string | null; ownerId: string | null }): Promise<boolean> {
  if (!publicExamClosed(exam.courseId)) return false;
  const owner = exam.ownerId ? await prisma.user.findUnique({ where: { id: exam.ownerId }, select: { adminRole: true } }) : null;
  return isClosedPublicExam({ courseId: exam.courseId, ownerAdminRole: owner?.adminRole ?? null });
}
