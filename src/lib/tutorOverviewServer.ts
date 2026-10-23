// Truy vấn cho trang Hộp việc (xem tutorOverview.ts): phiếu học phí tháng này, lớp + sĩ số, lịch 7 ngày tới. Chỉ ĐỌC; khoá theo chính gia sư.
import { prisma } from "@/lib/prisma";
import { vnMonthKey } from "@/lib/revenue";
import { loadTutorSchedule } from "@/lib/reminderServer";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import { buildHopViecOverview, type HopViecOverview } from "@/lib/tutorOverview";

export async function loadHopViecOverview(tutorId: string, now: Date): Promise<HopViecOverview> {
  const own = { ownerId: tutorId };
  const todayKey = vnDateKeyOf(now);
  const [invoices, courses, byCourse, students, sched] = await Promise.all([
    prisma.tuitionInvoice.findMany({ where: { tutorId, yearMonth: vnMonthKey(now) }, select: { amountDue: true, paidAmount: true, status: true } }),
    prisma.course.findMany({ where: own, select: { id: true, name: true, classStatus: true } }),
    prisma.enrollment.groupBy({ by: ["courseId"], where: { status: "active", course: own }, _count: { _all: true } }),
    prisma.enrollment.findMany({ where: { status: "active", course: own }, select: { userId: true }, distinct: ["userId"] }),
    loadTutorSchedule(tutorId, todayKey, addDaysKey(todayKey, 6), now),
  ]);
  const countOf = new Map(byCourse.map(r => [r.courseId, r._count._all]));
  return buildHopViecOverview({
    now, invoices,
    classes: courses.map(c => ({ id: c.id, name: c.name, classStatus: c.classStatus, students: countOf.get(c.id) ?? 0 })),
    totalStudents: students.length,
    occurrences: sched.occurrences.map(o => ({
      courseId: o.courseId, courseName: o.courseName, dateKey: o.dateKey, startAt: o.startAt, endAt: o.endAt, status: o.status,
      studentCount: o.students.length, pendingAbsences: o.pendingAbsences,
    })),
  });
}
