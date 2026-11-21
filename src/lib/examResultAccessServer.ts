// SCL-A (P2-7) — phần đọc DB cho canSeeClassExam (luật thuần ở src/lib/examResultRules.ts). Dùng ở GET /api/exam-results?examId= và GET /api/exams/[id].
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { canSeeClassExam } from "@/lib/examResultRules";
import { isActiveHelperOfCourse } from "@/lib/courseAccessServer";

/** `exam` là đề GỐC (mã con đã quy về gốc). */
export async function mayViewClassExam(session: SessionPayload, exam: { id: string; ownerId: string | null; courseId: string | null; price: number | null }): Promise<boolean> {
  if (!exam.courseId) return true;
  const courseId = exam.courseId;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  const isStudent = session.role !== "admin";
  const [isHelper, enrollment, guest] = await Promise.all([
    isActiveHelperOfCourse(session, courseId, course?.ownerId ?? null),
    isStudent ? prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId } }, select: { status: true } }) : null,
    isStudent ? prisma.examGuestAccess.findUnique({ where: { userId_examId: { userId: session.userId, examId: exam.id } }, select: { userId: true } }) : null,
  ]);
  return canSeeClassExam(session, {
    courseId, examOwnerId: exam.ownerId, courseOwnerId: course?.ownerId ?? null, price: exam.price, isHelper, enrollment, hasGuestAccess: !!guest,
  });
}
