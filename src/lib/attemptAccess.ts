// Quyền GHI vào một lượt làm bài đang có (autosave, báo rời màn hình, nộp). Cùng quy tắc với POST /api/exams/[id]/start:
// đề gắn lớp (courseId) thì chỉ ghi danh ĐANG HỌC mới được; riêng đề thu phí còn đường ExamGuestAccess (gia sư duyệt tay).
// Lý do tách: /start chỉ kiểm lúc MỞ lượt, nên học sinh bị chuyển "suspended" giữa chừng vẫn nộp/lưu được. THUẦN + một hàm đọc DB.
// Chính sách XEM (chủ chọn "chặt" 06/11): chặn xem lượt dở / xem lại / chữa bài khi đã nghỉ lớp (suspended) HOẶC không còn bản ghi ghi danh nào
// (bị xoá hẳn) mà đề gắn lớp. Ngoại lệ: đề không gắn lớp, đề thu phí có ExamGuestAccess. Điểm của lượt ĐÃ NỘP (GET /attempts/[id]) vẫn trả — lịch sử điểm của chính em.
import { prisma } from "@/lib/prisma";
import { isEnrollmentActive } from "@/lib/enrollment";
import {
  ATTEMPT_SUSPENDED_MESSAGE, ENROLLMENT_SUSPENDED_CODE, ATTEMPT_LEFT_CLASS_MESSAGE, ENROLLMENT_REMOVED_CODE,
  ATTEMPT_BLOCKED_MESSAGE, ATTEMPT_LEFT_CLASS_BLOCKED_MESSAGE,
} from "@/lib/enrollmentMessages";

// Giữ đường import cũ (t-attempt-suspended-api, route cũ).
export { ATTEMPT_BLOCKED_MESSAGE, ATTEMPT_SUSPENDED_MESSAGE, ENROLLMENT_SUSPENDED_CODE, ATTEMPT_LEFT_CLASS_MESSAGE, ENROLLMENT_REMOVED_CODE, ATTEMPT_LEFT_CLASS_BLOCKED_MESSAGE };

type AccessInput = { courseId: string | null; price: number | null; enrollment: { status: string } | null; hasGuestAccess: boolean };
/** Lý do bị chặn: "suspended" = đã nghỉ lớp; "left" = không còn bản ghi ghi danh. */
export type AccessBlockKind = "suspended" | "left";
export type AccessBlock = { error: string; code: string };

/** THUẦN. true = được ghi vào lượt. Đề không gắn lớp: luôn true (đề công khai). */
export function canWriteAttempt(i: AccessInput): boolean {
  if (!i.courseId) return true;
  if (isEnrollmentActive(i.enrollment)) return true;
  return !!(i.price && i.price > 0 && i.hasGuestAccess);
}

const paidGuest = (i: AccessInput) => !!(i.price && i.price > 0 && i.hasGuestAccess);

/** THUẦN. Lý do chặn XEM, hoặc null. "pending_consent" và "active" không bị chặn ở đây. */
export function viewBlockKind(i: AccessInput): AccessBlockKind | null {
  if (!i.courseId || paidGuest(i)) return null;
  if (!i.enrollment) return "left";
  return i.enrollment.status === "suspended" ? "suspended" : null;
}

/** THUẦN. true = bị chặn XEM (đã nghỉ lớp hoặc không còn trong lớp của đề gắn lớp). */
export function isSuspendedForView(i: AccessInput): boolean {
  return viewBlockKind(i) !== null;
}

/** THUẦN. Lý do chặn GHI (khi canWriteAttempt = false): đã nghỉ lớp / pending → "suspended" (giữ thông điệp cũ), không còn ghi danh → "left". */
export function writeBlockKind(i: AccessInput): AccessBlockKind | null {
  if (canWriteAttempt(i)) return null;
  return i.enrollment ? "suspended" : "left";
}

export const viewBlockOf = (k: AccessBlockKind | null): AccessBlock | null =>
  k === "suspended" ? { error: ATTEMPT_SUSPENDED_MESSAGE, code: ENROLLMENT_SUSPENDED_CODE }
  : k === "left" ? { error: ATTEMPT_LEFT_CLASS_MESSAGE, code: ENROLLMENT_REMOVED_CODE } : null;

export const writeBlockOf = (k: AccessBlockKind | null): AccessBlock | null =>
  k === "suspended" ? { error: ATTEMPT_BLOCKED_MESSAGE, code: ENROLLMENT_SUSPENDED_CODE }
  : k === "left" ? { error: ATTEMPT_LEFT_CLASS_BLOCKED_MESSAGE, code: ENROLLMENT_REMOVED_CODE } : null;

async function rootExamOf(examId: string) {
  const sel = { id: true, courseId: true, price: true, variantOfId: true } as const;
  let exam = await prisma.exam.findUnique({ where: { id: examId }, select: sel });
  if (exam?.variantOfId) exam = (await prisma.exam.findUnique({ where: { id: exam.variantOfId }, select: sel })) ?? exam;
  return exam;
}

async function accessInputOf(userId: string, examId: string): Promise<AccessInput | null> {
  const exam = await rootExamOf(examId);
  if (!exam?.courseId) return null;
  const [enrollment, guest] = await Promise.all([
    prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: exam.courseId } }, select: { status: true } }),
    prisma.examGuestAccess.findUnique({ where: { userId_examId: { userId, examId: exam.id } }, select: { userId: true } }),
  ]);
  return { courseId: exam.courseId, price: exam.price, enrollment, hasGuestAccess: !!guest };
}

/** {error, code} 403 nếu người này đã nghỉ lớp / không còn trong lớp của đề `examId` (mã con quy về gốc) nên không được xem lượt/kết quả/chữa bài; null = được. */
export async function attemptViewBlock(userId: string, examId: string): Promise<AccessBlock | null> {
  const i = await accessInputOf(userId, examId);
  return i ? viewBlockOf(viewBlockKind(i)) : null;
}

/** {error, code} 403 nếu người này không còn quyền ghi vào lượt của đề `examId` (mã con quy về đề gốc như /start); null = được. */
export async function attemptWriteBlock(userId: string, examId: string): Promise<AccessBlock | null> {
  const i = await accessInputOf(userId, examId);
  return i ? writeBlockOf(writeBlockKind(i)) : null;
}
