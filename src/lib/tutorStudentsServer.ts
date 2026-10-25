// Danh sách học sinh của gia sư (Figma "Gia sư · Học sinh" 299:113083). CHỈ học sinh ghi danh vào lớp do chính gia sư này làm chủ (Course.ownerId).
// Trường trả ra đúng bằng trang danh sách học sinh của lớp (/api/courses/[id]/students): tên, email, SĐT, trường, ngày ghi danh — không thêm trường mới.
// Chỉ lấy ghi danh "active" (đang học) và "suspended" (đã nghỉ); "pending_consent" (chờ phụ huynh xác nhận) không hiện ở đây, việc đó nằm ở Hộp việc.
import { prisma } from "@/lib/prisma";
import { absenceStreakOf, reportLinkOf, type StudentSignals } from "@/lib/tutorStudentView";
import { UNPAID_STATUSES } from "@/lib/tuitionInvoice";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";

export interface TutorStudentRow {
  key: string; // userId:courseId
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  school: string | null;
  courseId: string;
  courseName: string;
  enrolledAt: string;
  status: "active" | "suspended";
}

export async function loadTutorStudents(tutorId: string): Promise<TutorStudentRow[]> {
  const rows = await prisma.enrollment.findMany({
    where: { status: { in: ["active", "suspended"] }, course: { ownerId: tutorId } },
    select: {
      userId: true, courseId: true, createdAt: true, status: true,
      user: { select: { name: true, email: true, phone: true, school: true } },
      course: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(r => ({
    key: `${r.userId}:${r.courseId}`,
    userId: r.userId, name: r.user.name, email: r.user.email, phone: r.user.phone, school: r.user.school,
    courseId: r.courseId, courseName: r.course.name, enrolledAt: r.createdAt.toISOString(),
    status: r.status === "suspended" ? "suspended" : "active",
  }));
}

// ─── Tín hiệu cho danh sách (HS-01) ─────────────────────────────────────────────
// Chỉ ĐỌC dữ liệu đã có, khoá theo gia sư: phiếu của chính gia sư, buổi bù và điểm danh ở lớp của chính gia sư, liên kết phụ huynh đã xác nhận của em.
// Không tên phụ huynh, không số tiền: chỉ số đếm.

const STREAK_LOOKBACK_DAYS = 120;

export async function loadTutorStudentSignals(tutorId: string, rows: readonly TutorStudentRow[], now: Date = new Date()): Promise<StudentSignals[]> {
  const userIds = [...new Set(rows.map(r => r.userId))];
  if (!userIds.length) return [];
  const from = new Date(`${addDaysKey(vnDateKeyOf(now), -STREAK_LOOKBACK_DAYS)}T00:00:00Z`);
  const [invoices, makeups, links, sessions] = await Promise.all([
    prisma.tuitionInvoice.groupBy({ by: ["studentId"], where: { tutorId, studentId: { in: userIds }, status: { in: [...UNPAID_STATUSES] } }, _count: { _all: true } }),
    prisma.makeupCredit.groupBy({ by: ["studentId"], where: { studentId: { in: userIds }, course: { ownerId: tutorId }, status: "active", expiresAt: { gt: now } }, _count: { _all: true } }),
    prisma.parentLink.findMany({ where: { studentId: { in: userIds } }, select: { studentId: true, status: true, portalToken: true } }),
    prisma.attendanceSession.findMany({
      where: { course: { ownerId: tutorId }, date: { gte: from, lte: new Date(`${vnDateKeyOf(now)}T00:00:00Z`) } },
      select: { id: true, courseId: true, date: true, records: { where: { userId: { in: userIds } }, select: { userId: true, status: true } } },
      orderBy: { date: "desc" },
    }),
  ]);
  const unpaid = new Map(invoices.map(g => [g.studentId, g._count._all]));
  const makeup = new Map(makeups.map(g => [g.studentId, g._count._all]));
  const linksOf = new Map<string, { status: string; portalToken: string | null }[]>();
  for (const l of links) { const a = linksOf.get(l.studentId) ?? []; a.push(l); linksOf.set(l.studentId, a); }
  // Mỗi lớp: các buổi mới → cũ; trạng thái của từng em ở từng buổi.
  const byCourse = new Map<string, { dateKey: string; at: Map<string, string> }[]>();
  for (const s of sessions) {
    const a = byCourse.get(s.courseId) ?? [];
    a.push({ dateKey: s.date.toISOString().slice(0, 10), at: new Map(s.records.map(r => [r.userId, r.status])) });
    byCourse.set(s.courseId, a);
  }
  const worst = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "active") continue;
    const enrolledKey = vnDateKeyOf(new Date(r.enrolledAt));
    const seq: (string | undefined)[] = [];
    for (const s of byCourse.get(r.courseId) ?? []) { if (s.dateKey < enrolledKey) break; seq.push(s.at.get(r.userId)); }
    worst.set(r.userId, Math.max(worst.get(r.userId) ?? 0, absenceStreakOf(seq)));
  }
  return userIds.map(userId => ({
    userId, unpaidCount: unpaid.get(userId) ?? 0, absentStreak: worst.get(userId) ?? 0, makeupLeft: makeup.get(userId) ?? 0,
    reportLink: reportLinkOf(linksOf.get(userId) ?? []),
  }));
}

/** Em có ghi danh (đang học hoặc đã nghỉ) ở lớp của gia sư này không. "pending_consent" không tính. */
export async function tutorHasStudent(tutorId: string, userId: string): Promise<boolean> {
  const e = await prisma.enrollment.findFirst({ where: { userId, status: { in: ["active", "suspended"] }, course: { ownerId: tutorId } }, select: { id: true } });
  return !!e;
}
