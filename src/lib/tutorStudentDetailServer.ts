// Hồ sơ nhiều tab của MỘT học sinh có tài khoản (HS-02, HS-06, HS-08, HS-09, DD-07). Chỉ GOM dữ liệu đã có, không thu thêm gì về em.
// Khoá theo gia sư đang đăng nhập (không nhận tutorId từ client): em phải có ghi danh (đang học hoặc đã nghỉ) ở lớp của chính gia sư.
//  • Thông tin riêng (phụ huynh, ngày sinh, SĐT, ghi chú…) CHỈ đi qua viewOf → maskProfile: thiếu đồng ý thì không có trong kết quả.
//  • Điểm từng buổi: chỉ khi phạm vi "scores" còn hiệu lực (scoreConsentFor).
//  • Phiếu: chỉ phiếu của CHÍNH gia sư này, số tiền đúng như đã lưu (remainingOf), không tính lại.
// Log máy chủ chỉ có id.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { INVOICE_STATUS_LABEL, remainingOf, type InvoiceStatus } from "@/lib/tuitionInvoice";
import { accountFacts, consentRowsOf, viewOf, PROFILE_SELECT, type ProfileOut } from "@/lib/studentProfileServer";
import { scoreConsentFor } from "@/lib/sessionScoreServer";
import { activeMakeupCount } from "@/lib/absenceServer";
import { vnDateKeyOf } from "@/lib/classSessions";
import {
  ATTENDANCE_WINDOW_DAYS, WEEKDAY_LABEL, attendanceWindow, learnedSessions, reportLinkOf, reportPath, type AttendanceWindow, type AttRow, type ReportLinkState,
} from "@/lib/tutorStudentView";
import { tutorHasStudent } from "@/lib/tutorStudentsServer";

/** Em phải ở lớp của gia sư: không có em → 404; có em nhưng ở lớp người khác → 403 (không lộ gì thêm). */
export async function ownStudent(auth: SessionPayload, userId: string): Promise<{ user: { id: string; name: string; email: string; phone: string | null; school: string | null } } | { res: NextResponse }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true, school: true, role: true } });
  if (!user || user.role !== "student") return { res: NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 }) };
  if (!(await tutorHasStudent(auth.userId, userId))) return { res: NextResponse.json({ error: "Học sinh này không thuộc lớp của bạn" }, { status: 403 }) };
  return { user };
}

export interface ReportLinkRow { linkId: string; state: "on" | "off"; url: string | null }
export interface AssignmentRow { id: string; title: string; courseName: string; dueDate: string | null; maxPoints: number; state: "not_submitted" | "waiting" | "graded"; score: number | null }

export interface StudentDetail {
  student: { userId: string; name: string; email: string; phone: string | null; school: string | null };
  enrollments: { courseId: string; courseName: string; status: "active" | "suspended"; enrolledAt: string; schedule: string | null }[];
  /** Hồ sơ riêng của gia sư về em (đã che theo đồng ý). null = chưa có hồ sơ riêng. */
  profile: ProfileOut | null;
  attendance: AttendanceWindow;
  learned: AttRow[];
  scores: { allowed: boolean; reason: "no_profile" | "no_consent" | null; items: { dateKey: string; courseName: string; score: number | null; homeworkPct: number | null }[] };
  invoices: { id: string; code: string; yearMonth: string; amountDue: number; paidAmount: number; remaining: number; status: InvoiceStatus; statusLabel: string }[];
  makeupLeft: number;
  assignments: AssignmentRow[];
  report: { state: ReportLinkState; links: ReportLinkRow[] };
  /** Số đếm CHỈ ĐỌC cho màn "Xem ảnh hưởng khi xoá": buổi có ghi điểm danh, phiếu, buổi có điểm (null = chưa có đồng ý ghi điểm nên không đếm). */
  impact: { sessions: number; invoices: number; scores: number | null };
}

export async function loadStudentDetail(tutorId: string, user: { id: string; name: string; email: string; phone: string | null; school: string | null }, now: Date = new Date()): Promise<StudentDetail> {
  const todayKey = vnDateKeyOf(now);
  const enr = await prisma.enrollment.findMany({
    where: { userId: user.id, status: { in: ["active", "suspended"] }, course: { ownerId: tutorId } },
    select: { courseId: true, status: true, createdAt: true, course: { select: { name: true, classSchedules: { where: { active: true }, select: { dayOfWeek: true, startTime: true, endTime: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } } } },
    orderBy: { createdAt: "asc" },
  });
  const courseIds = enr.map(e => e.courseId);
  const courseName = new Map(enr.map(e => [e.courseId, e.course.name]));

  const [profileRow, recs, invoices, links, makeupN, assignments] = await Promise.all([
    prisma.studentProfile.findFirst({ where: { tutorId, userId: user.id }, select: PROFILE_SELECT, orderBy: { createdAt: "asc" } }),
    prisma.attendanceRecord.findMany({
      where: { userId: user.id, session: { courseId: { in: courseIds } } },
      select: { status: true, session: { select: { date: true, courseId: true } } },
      orderBy: { session: { date: "desc" } }, take: 400,
    }),
    prisma.tuitionInvoice.findMany({
      where: { tutorId, studentId: user.id }, orderBy: [{ yearMonth: "desc" }, { createdAt: "desc" }], take: 24,
      select: { id: true, code: true, yearMonth: true, amountDue: true, paidAmount: true, status: true },
    }),
    prisma.parentLink.findMany({ where: { studentId: user.id, status: "verified" }, select: { id: true, status: true, portalToken: true }, orderBy: { createdAt: "asc" } }),
    Promise.all(courseIds.map(c => activeMakeupCount(prisma, user.id, c, now))),
    prisma.assignment.findMany({
      where: { lesson: { chapter: { section: { courseId: { in: courseIds } } } } },
      select: { id: true, title: true, dueDate: true, maxPoints: true, lesson: { select: { chapter: { select: { section: { select: { courseId: true } } } } } }, submissions: { where: { userId: user.id }, select: { gradedAt: true, score: true } } },
      orderBy: { createdAt: "desc" }, take: 60,
    }),
  ]);

  let profile: ProfileOut | null = null;
  if (profileRow) {
    const rows = (await consentRowsOf([profileRow.id])).get(profileRow.id) ?? [];
    const acct = (await accountFacts([user.id])).get(user.id);
    profile = viewOf(profileRow, rows, now, acct);
  }

  const attRows: AttRow[] = recs.map(r => ({ dateKey: r.session.date.toISOString().slice(0, 10), status: r.status, courseName: courseName.get(r.session.courseId) ?? "Lớp" }));

  const gate = (await scoreConsentFor(tutorId, [user.id])).get(user.id);
  let scoreItems: StudentDetail["scores"]["items"] = [];
  if (gate?.ok) {
    const raw = await prisma.sessionStudentScore.findMany({
      where: { userId: user.id, tutorId }, orderBy: { session: { date: "desc" } }, take: 30,
      select: { score: true, homeworkPct: true, session: { select: { date: true, courseId: true } } },
    });
    scoreItems = raw.map(r => ({ dateKey: r.session.date.toISOString().slice(0, 10), courseName: courseName.get(r.session.courseId) ?? "Lớp", score: r.score, homeworkPct: r.homeworkPct }));
  }

  const [impactSessions, impactInvoices, impactScores] = await Promise.all([
    prisma.attendanceRecord.count({ where: { userId: user.id, session: { courseId: { in: courseIds } } } }),
    prisma.tuitionInvoice.count({ where: { tutorId, studentId: user.id } }),
    gate?.ok ? prisma.sessionStudentScore.count({ where: { userId: user.id, tutorId } }) : Promise.resolve(null),
  ]);
  const state = reportLinkOf(links);
  return {
    student: { userId: user.id, name: user.name, email: user.email, phone: user.phone, school: user.school },
    enrollments: enr.map(e => ({
      courseId: e.courseId, courseName: e.course.name, status: e.status === "suspended" ? "suspended" : "active", enrolledAt: e.createdAt.toISOString(),
      schedule: e.course.classSchedules.length ? e.course.classSchedules.map(s => `${WEEKDAY_LABEL[s.dayOfWeek]} ${s.startTime}–${s.endTime}`).join(" · ") : null,
    })),
    profile,
    attendance: attendanceWindow(attRows, todayKey, ATTENDANCE_WINDOW_DAYS),
    learned: learnedSessions(attRows, todayKey).slice(0, 40),
    scores: { allowed: !!gate?.ok, reason: gate?.ok ? null : gate?.reason ?? "no_profile", items: scoreItems },
    invoices: invoices.map(i => ({ ...i, remaining: remainingOf(i), status: i.status as InvoiceStatus, statusLabel: INVOICE_STATUS_LABEL[i.status as InvoiceStatus] ?? i.status })),
    makeupLeft: makeupN.reduce((a, b) => a + b, 0),
    assignments: assignments.map(a => {
      const sub = a.submissions[0];
      return {
        id: a.id, title: a.title, courseName: courseName.get(a.lesson.chapter.section.courseId) ?? "Lớp", dueDate: a.dueDate?.toISOString() ?? null, maxPoints: a.maxPoints,
        state: !sub ? "not_submitted" : sub.gradedAt ? "graded" : "waiting", score: sub?.gradedAt ? sub.score : null,
      } satisfies AssignmentRow;
    }),
    impact: { sessions: impactSessions, invoices: impactInvoices, scores: impactScores },
    report: { state, links: links.map(l => ({ linkId: l.id, state: l.portalToken ? "on" : "off", url: l.portalToken ? reportPath(l.portalToken) : null }) as ReportLinkRow) },
  };
}
