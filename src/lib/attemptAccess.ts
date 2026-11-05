// Quyền GHI vào một lượt làm bài đang có (autosave, báo rời màn hình, nộp). Cùng quy tắc với POST /api/exams/[id]/start:
// đề gắn lớp (courseId) thì chỉ ghi danh ĐANG HỌC mới được; riêng đề thu phí còn đường ExamGuestAccess (gia sư duyệt tay).
// Lý do tách: /start chỉ kiểm lúc MỞ lượt, nên học sinh bị chuyển "suspended" giữa chừng vẫn nộp/lưu được. THUẦN + một hàm đọc DB.
import { prisma } from "@/lib/prisma";
import { isEnrollmentActive, ATTEMPT_SUSPENDED_MESSAGE, ENROLLMENT_SUSPENDED_CODE } from "@/lib/enrollment";

export const ATTEMPT_BLOCKED_MESSAGE = "Hồ sơ của em ở lớp này đang tạm dừng nên KiN chưa ghi nhận bài làm. Em nhắn gia sư của lớp để được mở lại nhé.";

/** THUẦN. true = được ghi vào lượt. Đề không gắn lớp: luôn true (đề công khai). */
export function canWriteAttempt(i: { courseId: string | null; price: number | null; enrollment: { status: string } | null; hasGuestAccess: boolean }): boolean {
  if (!i.courseId) return true;
  if (isEnrollmentActive(i.enrollment)) return true;
  return !!(i.price && i.price > 0 && i.hasGuestAccess);
}

// Học sinh đã nghỉ lớp (Enrollment.status = suspended) thì không xem được nội dung bài thi của lớp đó — kể cả bài đã nộp (quyết định của chủ 06/11).
export { ATTEMPT_SUSPENDED_MESSAGE, ENROLLMENT_SUSPENDED_CODE };

/** THUẦN. true = bị chặn XEM vì đã nghỉ lớp. Chỉ trạng thái "suspended" (không đụng người chưa ghi danh / chờ phụ huynh). Đề thu phí + quyền khách do gia sư duyệt tay thì vẫn xem được (như canWriteAttempt). */
export function isSuspendedForView(i: { courseId: string | null; price: number | null; enrollment: { status: string } | null; hasGuestAccess: boolean }): boolean {
  if (!i.courseId || i.enrollment?.status !== "suspended") return false;
  return !(i.price && i.price > 0 && i.hasGuestAccess);
}

async function rootExamOf(examId: string) {
  const sel = { id: true, courseId: true, price: true, variantOfId: true } as const;
  let exam = await prisma.exam.findUnique({ where: { id: examId }, select: sel });
  if (exam?.variantOfId) exam = (await prisma.exam.findUnique({ where: { id: exam.variantOfId }, select: sel })) ?? exam;
  return exam;
}

/** Thông điệp 403 nếu người này đã nghỉ lớp của đề `examId` (mã con quy về gốc) nên không được xem lượt/kết quả/chữa bài; null = được. */
export async function attemptViewBlock(userId: string, examId: string): Promise<string | null> {
  const exam = await rootExamOf(examId);
  if (!exam?.courseId) return null;
  const [enrollment, guest] = await Promise.all([
    prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: exam.courseId } }, select: { status: true } }),
    prisma.examGuestAccess.findUnique({ where: { userId_examId: { userId, examId: exam.id } }, select: { userId: true } }),
  ]);
  return isSuspendedForView({ courseId: exam.courseId, price: exam.price, enrollment, hasGuestAccess: !!guest }) ? ATTEMPT_SUSPENDED_MESSAGE : null;
}

/** Trả thông điệp 403 nếu người này không còn quyền ghi vào lượt của đề `examId` (mã con quy về đề gốc như /start); null = được. */
export async function attemptWriteBlock(userId: string, examId: string): Promise<string | null> {
  const exam = await rootExamOf(examId);
  if (!exam?.courseId) return null;
  const [enrollment, guest] = await Promise.all([
    prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: exam.courseId } }, select: { status: true } }),
    prisma.examGuestAccess.findUnique({ where: { userId_examId: { userId, examId: exam.id } }, select: { userId: true } }),
  ]);
  return canWriteAttempt({ courseId: exam.courseId, price: exam.price, enrollment, hasGuestAccess: !!guest }) ? null : ATTEMPT_BLOCKED_MESSAGE;
}
