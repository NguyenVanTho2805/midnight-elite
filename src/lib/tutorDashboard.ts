// FE-141..143 — số liệu tổng quan của gia sư. Mỗi con số là 1 truy vấn đếm/gộp,
// không tải danh sách học viên.
import { prisma } from "@/lib/prisma";
import { vnMonthKey } from "@/lib/revenue";

export async function loadTutorDashboard(tutorId: string) {
  const now = new Date();
  const monthStart = new Date(`${vnMonthKey(now)}-01T00:00:00+07:00`);
  const own = { ownerId: tutorId };

  const [courses, byCourse, students, collected, bankPending, needBankCheck, drafts, pendingConsent, classReports, ungradedFiles, ungradedEssays] = await Promise.all([
    prisma.course.findMany({ where: own, select: { id: true, name: true, category: true, status: true, classStatus: true, capacity: true }, orderBy: { createdAt: "desc" } }),
    prisma.enrollment.groupBy({ by: ["courseId"], where: { status: "active", course: own }, _count: { _all: true } }),
    prisma.enrollment.findMany({ where: { status: "active", course: own }, select: { userId: true }, distinct: ["userId"] }),
    prisma.bankTransaction.aggregate({
      where: { tutorId, status: { in: ["matched", "resolved"] }, occurredAt: { gte: monthStart } },
      _sum: { appliedAmount: true },
    }),
    prisma.bankTransaction.count({ where: { tutorId, status: "pending" } }),
    prisma.tuitionInvoice.count({ where: { tutorId, status: "parent_reported", parentReportedAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } }),
    prisma.tuitionInvoice.count({ where: { tutorId, status: "draft" } }),
    prisma.enrollment.count({ where: { status: "pending_consent", course: own } }),
    prisma.threadReport.count({ where: { status: "pending", thread: { deletedAt: null, course: own } } }),
    prisma.assignmentSubmission.count({ where: { score: null, assignment: { lesson: { chapter: { section: { course: own } } } } } }),
    prisma.assignmentAnswer.count({
      where: { pointsAwarded: null, textAnswer: { not: null }, question: { type: "ESSAY", assignment: { lesson: { chapter: { section: { course: own } } } } } },
    }),
  ]);

  const countOf = new Map(byCourse.map(r => [r.courseId, r._count._all]));
  return {
    classes: courses.map(c => ({ ...c, students: countOf.get(c.id) ?? 0 })),
    totalStudents: students.length,
    openClasses: courses.filter(c => c.classStatus === "open").length,
    collectedThisMonth: collected._sum.appliedAmount ?? 0,
    todo: { bankPending, needBankCheck, draftInvoices: drafts, pendingConsent, classReports, ungraded: ungradedFiles + ungradedEssays },
  };
}
