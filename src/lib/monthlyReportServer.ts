// NV-189 — báo cáo tháng gửi phụ huynh (phần chạm DB). Quy tắc thuần ở monthlyReport.ts.
//
// Nguồn số liệu (tất cả TÍNH LẠI từ dữ liệu thật mỗi lần mở, không cache):
//   Chuyên cần — AttendanceRecord của em, buổi có ngày trong tháng (computeAttendanceStats: hệ số 1/0,9/0,8/0,5)
//   Bài về nhà — Assignment của lớp có hạn nộp (dueDate) trong tháng giờ VN; "đúng hạn" = có bài nộp lúc ≤ hạn.
//                Bài không đặt hạn không tính (không có mốc để xét đúng hạn)
//   Năng lực   — ExamResult của em ở các đề gắn với lớp (Exam.courseId), điểm quy về thang 10
//   Buổi gia sư dời/huỷ — ClassSessionChange của các lớp em đang học, buổi có NGÀY GỐC (theo lịch tuần) trong tháng; gia sư bấm Dời/Huỷ ở trang Lịch.
import { prisma } from "@/lib/prisma";
import { computeAttendanceStats } from "@/lib/attendance";
import { vnMonthKey } from "@/lib/revenue";
import { buildSubjectMetrics, type SubjectMonthMetrics, type TutorChangedSession } from "@/lib/monthlyReport";
import { changesToTutorChanged } from "@/lib/sessionChange";

export const isYearMonth = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

function nextYearMonth(ym: string): string {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function monthBounds(ym: string) {
  const nxt = nextYearMonth(ym);
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  const ny = Number(nxt.slice(0, 4)), nm = Number(nxt.slice(5, 7));
  return {
    start: new Date(`${ym}-01T00:00:00+07:00`),
    end: new Date(`${nxt}-01T00:00:00+07:00`),
    // Buổi điểm danh lưu ngày VN dưới dạng 00:00 UTC của ngày đó (normalizeAttendanceDate).
    attStart: new Date(Date.UTC(y, m - 1, 1)),
    attEnd: new Date(Date.UTC(ny, nm - 1, 1)),
  };
}

/** Không cho lập báo cáo cho tháng chưa tới (giờ VN). */
export const isFutureMonth = (ym: string, now: Date = new Date()) => ym > vnMonthKey(now);

/** Học sinh trong các lớp của gia sư (mọi trạng thái ghi danh còn tồn tại), kèm tên lớp. */
export async function listTutorStudents(tutorId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { course: { ownerId: tutorId }, status: { in: ["active", "suspended"] } },
    select: { userId: true, course: { select: { id: true, name: true } }, user: { select: { id: true, name: true, parentName: true, parentPhone: true } } },
    orderBy: { user: { name: "asc" } },
  });
  const byStudent = new Map<string, { id: string; name: string; parentName: string | null; parentPhone: string | null; courses: { id: string; name: string }[] }>();
  for (const e of enrollments) {
    const cur = byStudent.get(e.userId) ?? { id: e.user.id, name: e.user.name, parentName: e.user.parentName, parentPhone: e.user.parentPhone, courses: [] };
    cur.courses.push(e.course);
    byStudent.set(e.userId, cur);
  }
  return [...byStudent.values()];
}

/** Số liệu từng môn của một học sinh trong tháng, chỉ tính các lớp của `tutorId`. null nếu em không học lớp nào của gia sư. */
export async function loadStudentMonth(tutorId: string, studentId: string, yearMonth: string): Promise<{ student: { id: string; name: string; parentName: string | null; parentPhone: string | null }; subjects: SubjectMonthMetrics[]; changedSessions: TutorChangedSession[] } | null> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: studentId, status: { in: ["active", "suspended"] }, course: { ownerId: tutorId } },
    select: { course: { select: { id: true, name: true } }, user: { select: { id: true, name: true, parentName: true, parentPhone: true } } },
    orderBy: { course: { name: "asc" } },
  });
  if (enrollments.length === 0) return null;
  const courses = enrollments.map(e => e.course);
  const courseIds = courses.map(c => c.id);
  const { start, end, attStart, attEnd } = monthBounds(yearMonth);

  const [records, assignments, results, changes] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { userId: studentId, session: { courseId: { in: courseIds }, date: { gte: attStart, lt: attEnd } } },
      select: { status: true, session: { select: { courseId: true } } },
    }),
    prisma.assignment.findMany({
      where: { dueDate: { gte: start, lt: end }, lesson: { chapter: { section: { courseId: { in: courseIds } } } } },
      select: { id: true, dueDate: true, lesson: { select: { chapter: { select: { section: { select: { courseId: true } } } } } } },
    }),
    prisma.examResult.findMany({
      where: { userId: studentId, exam: { courseId: { in: courseIds } } },
      select: { score: true, totalPoints: true, completedAt: true, exam: { select: { courseId: true } } },
    }),
    prisma.classSessionChange.findMany({
      where: { courseId: { in: courseIds }, dateKey: { gte: `${yearMonth}-01`, lt: `${nextYearMonth(yearMonth)}-01` } },
      select: { dateKey: true, kind: true, courseId: true },
    }),
  ]);
  const subs = assignments.length
    ? await prisma.assignmentSubmission.findMany({ where: { userId: studentId, assignmentId: { in: assignments.map(a => a.id) } }, select: { assignmentId: true, submittedAt: true } })
    : [];
  const subOf = new Map(subs.map(s => [s.assignmentId, s.submittedAt]));

  const subjects = courses.map(c => {
    const att = computeAttendanceStats(records.filter(r => r.session.courseId === c.id));
    const mine = assignments.filter(a => a.lesson.chapter.section.courseId === c.id);
    const onTime = mine.filter(a => { const at = subOf.get(a.id); return !!at && !!a.dueDate && at.getTime() <= a.dueDate.getTime(); }).length;
    const scores = results
      .filter(r => r.exam.courseId === c.id && r.totalPoints > 0)
      .map(r => ({ score: Math.max(0, Math.min(10, (r.score / r.totalPoints) * 10)), takenAt: r.completedAt }));
    return buildSubjectMetrics({ courseId: c.id, courseName: c.name, attendance: att, homework: { assigned: mine.length, onTime }, scores }, yearMonth, start, end);
  });
  const nameOf = new Map(courses.map(c => [c.id, c.name]));
  const changedSessions: TutorChangedSession[] = changesToTutorChanged(changes.map(c => ({ dateKey: c.dateKey, kind: c.kind, courseName: nameOf.get(c.courseId) ?? "" })));
  return { student: enrollments[0].user, subjects, changedSessions };
}

export interface PartyReport {
  yearMonth: string;
  tutorName: string;
  approvedAt: string;
  subjects: SubjectMonthMetrics[];
  items: { text: string; kind: string }[];
}

/** Báo cáo ĐÃ DUYỆT của một học sinh (phụ huynh chỉ thấy bản đã duyệt, số liệu đóng băng lúc duyệt). Mới nhất trước. */
export async function loadPartyReports(studentId: string, yearMonths: string[]): Promise<PartyReport[]> {
  const rows = await prisma.monthlyReport.findMany({
    where: { studentId, yearMonth: { in: yearMonths }, approvedAt: { not: null } },
    select: { yearMonth: true, approvedAt: true, approvedItems: true, approvedSnapshot: true, tutor: { select: { name: true } } },
    orderBy: [{ yearMonth: "desc" }, { approvedAt: "desc" }],
  });
  return rows.map(r => ({
    yearMonth: r.yearMonth,
    tutorName: r.tutor.name,
    approvedAt: r.approvedAt!.toISOString(),
    subjects: ((r.approvedSnapshot as { subjects?: SubjectMonthMetrics[] } | null)?.subjects ?? []),
    items: (Array.isArray(r.approvedItems) ? r.approvedItems : []) as { text: string; kind: string }[],
  }));
}
