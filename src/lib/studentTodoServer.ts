// "Việc của tôi": đọc dữ liệu thật của một học sinh rồi đưa cho src/lib/studentTodo.ts quyết định. Chỉ đọc, không ghi.
import { prisma } from "@/lib/prisma";
import { loadStudentScheduleEvents } from "@/lib/studentSchedule";
import { buildStudentTodo, OVERDUE_KEEP_MS, DONE_KEEP_MS, type StudentTodoItem, type TodoAssignment } from "@/lib/studentTodo";

export async function loadStudentTodo(userId: string, now: Date = new Date()): Promise<{ items: StudentTodoItem[]; badge: number }> {
  const enrollments = await prisma.enrollment.findMany({ where: { userId, status: "active" }, select: { courseId: true } });
  const courseIds = enrollments.map(e => e.courseId);
  if (courseIds.length === 0) return { items: [], badge: 0 };

  // Chỉ cần bài có hạn trong khoảng còn có thể hiện: quá hạn chưa nộp ≤ 14 ngày, hoặc đã nộp/chấm ≤ 14 ngày (hạn có thể xa hơn lúc nộp sớm).
  const since = new Date(now.getTime() - Math.max(OVERDUE_KEEP_MS, DONE_KEEP_MS) - 14 * 86_400_000);
  const rows = await prisma.assignment.findMany({
    where: { dueDate: { gte: since }, lesson: { chapter: { section: { courseId: { in: courseIds } } } } },
    select: {
      id: true, title: true, instructions: true, fileUrl: true, maxPoints: true, dueDate: true, mode: true, createdAt: true, lessonId: true,
      lesson: { select: { chapter: { select: { section: { select: { course: { select: { name: true, instructor: true } } } } } } } },
      submissions: { where: { userId }, select: { submittedAt: true, score: true, gradedAt: true, comment: true } },
      questions: { select: { answers: { where: { userId }, select: { id: true } } } },
    },
    orderBy: { dueDate: "desc" },
    take: 300,
  });

  const assignments: TodoAssignment[] = rows.map(r => {
    const course = r.lesson.chapter.section.course;
    return {
      id: r.id, title: r.title, instructions: r.instructions, fileUrl: r.fileUrl, maxPoints: r.maxPoints, dueDate: r.dueDate, mode: r.mode,
      createdAt: r.createdAt, lessonId: r.lessonId, courseName: course.name, teacher: course.instructor,
      submission: r.submissions[0] ?? null,
      answeredCount: r.questions.reduce((n, q) => n + q.answers.length, 0),
    };
  });

  const events = await loadStudentScheduleEvents(userId, now);
  return buildStudentTodo({ assignments, events, now });
}
