// Truy vấn cho trang Hộp việc (xem tutorOverview.ts): phiếu học phí tháng này, lớp + sĩ số, lịch 7 ngày tới. Chỉ ĐỌC; khoá theo chính gia sư.
import { prisma } from "@/lib/prisma";
import { vnMonthKey } from "@/lib/revenue";
import { loadTutorSchedule } from "@/lib/reminderServer";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import { taughtSessionWhere } from "@/lib/taughtSessions";
import { expireOldRequests } from "@/lib/tutorRequestServer";
import { buildHopViecOverview, type HopViecOverview } from "@/lib/tutorOverview";

export async function loadHopViecOverview(tutorId: string, now: Date): Promise<HopViecOverview> {
  const own = { ownerId: tutorId };
  const todayKey = vnDateKeyOf(now);
  // HV-04: cả tháng hiện tại (theo giờ VN) để đếm buổi đã lên lịch / hoàn thành / đã nghỉ.
  const y = Number(todayKey.slice(0, 4)), m = Number(todayKey.slice(5, 7));
  const monthFrom = `${todayKey.slice(0, 7)}-01`, monthTo = `${todayKey.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  await expireOldRequests(now);
  const [invoices, courses, byCourse, students, sched, payout, scheduleCount, recordCount, invoiceCount, parentLinkCount, taughtCount, monthSched, closedInMonth, newRequests] = await Promise.all([
    prisma.tuitionInvoice.findMany({ where: { tutorId, yearMonth: vnMonthKey(now) }, select: { amountDue: true, paidAmount: true, status: true } }),
    prisma.course.findMany({ where: own, select: { id: true, name: true, classStatus: true } }),
    prisma.enrollment.groupBy({ by: ["courseId"], where: { status: "active", course: own }, _count: { _all: true } }),
    prisma.enrollment.findMany({ where: { status: "active", course: own }, select: { userId: true }, distinct: ["userId"] }),
    loadTutorSchedule(tutorId, todayKey, addDaysKey(todayKey, 6), now),
    // HV-10: số đếm thật cho checklist. Chỉ đếm, không đọc tên/SĐT học sinh hay phụ huynh.
    prisma.tutorPayoutAccount.count({ where: { userId: tutorId } }),
    prisma.classSchedule.count({ where: { active: true, course: own } }),
    prisma.attendanceRecord.count({ where: { session: { course: own } } }),
    prisma.tuitionInvoice.count({ where: { tutorId, status: { not: "cancelled" } } }),
    prisma.parentLink.count({ where: { student: { enrollments: { some: { course: own } } } } }),
    prisma.attendanceSession.count({ where: { course: own, ...taughtSessionWhere(now) } }),
    loadTutorSchedule(tutorId, monthFrom, monthTo, now),
    prisma.attendanceSession.findMany({ where: { course: own, state: "closed", date: { gte: new Date(`${monthFrom}T00:00:00Z`), lte: new Date(`${monthTo}T00:00:00Z`) } }, select: { courseId: true, date: true } }),
    prisma.tutorRequest.count({ where: { targetTutorId: tutorId, status: "new" } }), // HV-05
  ]);
  const countOf = new Map(byCourse.map(r => [r.courseId, r._count._all]));
  return buildHopViecOverview({
    now, invoices,
    monthOccurrences: monthSched.occurrences.map(o => ({ status: o.status, sessionState: o.sessionState })),
    extraClosedSessions: (() => { const seen = new Set(monthSched.occurrences.map(o => `${o.courseId}|${o.dateKey}`)); return closedInMonth.filter(x => !seen.has(`${x.courseId}|${x.date.toISOString().slice(0, 10)}`)).length; })(),
    newRequests,
    classes: courses.map(c => ({ id: c.id, name: c.name, classStatus: c.classStatus, students: countOf.get(c.id) ?? 0 })),
    totalStudents: students.length,
    setup: {
      payoutAccount: payout > 0, classes: courses.length, students: students.length, schedules: scheduleCount,
      attendanceRecords: recordCount, invoices: invoiceCount, parentLinks: parentLinkCount, taughtSessions: taughtCount,
    },
    occurrences: sched.occurrences.map(o => ({
      courseId: o.courseId, courseName: o.courseName, dateKey: o.dateKey, startAt: o.startAt, endAt: o.endAt, status: o.status,
      studentCount: o.students.length, pendingAbsences: o.pendingAbsences,
    })),
  });
}
