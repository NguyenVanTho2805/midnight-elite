// Truy vấn cho bảng "Lớp học" (xem tutorClassTable.ts). Chỉ ĐỌC; khoá theo chính gia sư.
import { prisma } from "@/lib/prisma";
import { formatScheduleRules, type TutorClassRow } from "@/lib/tutorClassTable";

export async function loadTutorClassTable(tutorId: string): Promise<{ rows: TutorClassRow[]; totalStudents: number }> {
  const own = { ownerId: tutorId };
  const [courses, byCourse, students, rules, taught] = await Promise.all([
    prisma.course.findMany({ where: own, select: { id: true, name: true, category: true, status: true, classStatus: true, capacity: true }, orderBy: { createdAt: "desc" } }),
    prisma.enrollment.groupBy({ by: ["courseId"], where: { status: "active", course: own }, _count: { _all: true } }),
    prisma.enrollment.findMany({ where: { status: "active", course: own }, select: { userId: true }, distinct: ["userId"] }),
    prisma.classSchedule.findMany({ where: { active: true, course: own }, select: { courseId: true, dayOfWeek: true, startTime: true, endTime: true } }),
    prisma.attendanceSession.groupBy({ by: ["courseId"], where: { course: own }, _count: { _all: true } }),
  ]);
  const countOf = new Map(byCourse.map(r => [r.courseId, r._count._all]));
  const taughtOf = new Map(taught.map(r => [r.courseId, r._count._all]));
  return {
    totalStudents: students.length,
    rows: courses.map(c => ({
      id: c.id, name: c.name, category: c.category, classStatus: c.classStatus, hidden: !c.status,
      students: countOf.get(c.id) ?? 0, capacity: c.capacity,
      schedule: formatScheduleRules(rules.filter(r => r.courseId === c.id)),
      sessionsTaught: taughtOf.get(c.id) ?? 0,
    })),
  };
}
