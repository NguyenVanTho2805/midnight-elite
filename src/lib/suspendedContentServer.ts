// Phần chạm DB của quy tắc "đã nghỉ lớp thì không xem nội dung lớp" (quyết định 06/11/2026). Quy tắc thuần ở suspendedContent.ts.
import { prisma } from "@/lib/prisma";
import { suspendedBlocksLesson, suspendedBody, contactTutorHref } from "@/lib/suspendedContent";

/** Thân 403 nếu `userId` đã nghỉ lớp chứa bài `lessonId` và bài không miễn phí; null = không chặn (kể cả bài không tồn tại hay chưa ghi danh: route tự xử như cũ). */
export async function suspendedLessonBlock(userId: string, lessonId: string): Promise<ReturnType<typeof suspendedBody> | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { isFree: true, chapter: { select: { section: { select: { course: { select: { id: true, ownerId: true } } } } } } },
  });
  if (!lesson) return null;
  const course = lesson.chapter.section.course;
  const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: course.id } }, select: { status: true } });
  return suspendedBlocksLesson(enr, lesson) ? suspendedBody(contactTutorHref(course)) : null;
}

/** Mã các lớp mà `userId` đã nghỉ (suspended). Dùng để ẩn tiến độ / dữ liệu học của các lớp đó. */
export async function suspendedCourseIds(userId: string): Promise<string[]> {
  const rows = await prisma.enrollment.findMany({ where: { userId, status: "suspended" }, select: { courseId: true } });
  return rows.map(r => r.courseId);
}
