// SCL-A (P2-7) — phần đọc DB cho canSeeClassExam (luật thuần ở src/lib/examResultRules.ts). Dùng ở GET /api/exam-results?examId= và GET /api/exams/[id].
import { ENROLLMENT_ACCESS_SELECT } from "@/lib/enrollment";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { canSeeClassExam } from "@/lib/examResultRules";
import { viewBlockKind, viewBlockOf, type AccessBlock } from "@/lib/attemptAccess";
import { isActiveHelperOfCourse } from "@/lib/courseAccessServer";

const NOT_IN_CLASS: AccessBlock = { error: "Bạn không có quyền với lớp này", code: "not_in_class" };

/** `exam` là đề GỐC (mã con đã quy về gốc). null = được xem; còn lại {error, code} cho 403 — học sinh nhận đúng mã nghỉ lớp / không còn trong lớp như phòng thi. */
export async function classExamViewBlock(session: SessionPayload, exam: { id: string; ownerId: string | null; courseId: string | null; price: number | null }): Promise<AccessBlock | null> {
  if (!exam.courseId) return null;
  const courseId = exam.courseId;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  const isStudent = session.role !== "admin";
  const [isHelper, enrollment, guest] = await Promise.all([
    isActiveHelperOfCourse(session, courseId, course?.ownerId ?? null),
    isStudent ? prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId } }, select: ENROLLMENT_ACCESS_SELECT }) : null,
    isStudent ? prisma.examGuestAccess.findUnique({ where: { userId_examId: { userId: session.userId, examId: exam.id } }, select: { userId: true } }) : null,
  ]);
  const facts = { courseId, examOwnerId: exam.ownerId, courseOwnerId: course?.ownerId ?? null, price: exam.price, isHelper, enrollment, hasGuestAccess: !!guest };
  if (canSeeClassExam(session, facts)) return null;
  return (isStudent && viewBlockOf(viewBlockKind(facts))) || NOT_IN_CLASS;
}
