// Truy vấn cho Hộp việc của gia sư: bộ đếm lấy từ loadTutorTodoCounts (MỘT nguồn với số đỏ trên thanh module) + vài việc đầu
// của từng loại để khung đọc có chữ cụ thể. Mọi truy vấn khoá theo gia sư (ownerId / tutorId) — không bao giờ thấy việc của người khác.
import { prisma } from "@/lib/prisma";
import { loadTutorTodoCounts } from "@/lib/tutorDashboard";
import { loadTutorSchedule } from "@/lib/reminderServer";
import { loadReminderDue, type ReminderDueRow } from "@/lib/invoiceReminderServer";
import { loadUnmarkedSessions } from "@/lib/unmarkedServer";
import { unmarkedHref } from "@/lib/unmarkedSessions";
import { addDaysKey, isMakeupExpiringSoon, MAKEUP_WARN_DAYS, vnDateKeyOf } from "@/lib/classSessions";
import { INBOX_DETAIL_LIMIT, inboxDateTime, inboxVnd, type InboxRaw, type InboxRow, type InboxSource } from "@/lib/tutorInbox";

const take = INBOX_DETAIL_LIMIT;
const mk = (count: number, rows: InboxRow[], at: Date | null | undefined): InboxSource => ({ count, rows, at: at ? at.toISOString() : null });
const monthText = (ym: string) => `tháng ${Number(ym.slice(5))}/${ym.slice(0, 4)}`;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** F2: dòng "N phiếu đến lúc nhắc bước 2–3". Số đếm lấy từ c.invoiceReminders (cùng nguồn với số đỏ); hàng chi tiết từ cùng danh sách. */
function invoiceRemindSource(count: number, due: ReminderDueRow[]): InboxSource {
  const steps = [...new Set(due.map(d => d.step))].sort();
  const maxOver = due.reduce((m, d) => Math.max(m, d.overdueDays), 0);
  const stepText = steps.length === 1 ? `bước ${steps[0]}` : "bước 2–3";
  const src = mk(count, due.slice(0, take).map(d => ({
    title: d.studentName,
    sub: `Phiếu ${monthText(d.yearMonth)} · còn ${inboxVnd(d.remaining)} · nhắc bước ${d.step}${d.overdueDays > 0 ? ` · quá hạn ${d.overdueDays} ngày` : ""}`,
    href: "/lop-cua-toi/hoc-phi",
  })), null);
  src.tag = maxOver > 0 ? `${stepText} (quá hạn tới ${maxOver} ngày)` : stepText;
  return src;
}

export async function loadTutorInboxRaw(tutorId: string, now: Date = new Date()): Promise<InboxRaw> {
  const own = { ownerId: tutorId };
  const today = vnDateKeyOf(now);
  // Tải danh sách buổi chưa điểm danh MỘT lần, dùng cho cả bộ đếm lẫn chi tiết từng dòng.
  const unmarkedP = loadUnmarkedSessions(tutorId, now);
  const remindP = loadReminderDue(tutorId, now);
  const [c, unmarked, absences, banks, checks, drafts, consents, reports, subs, essays, makeups, week, remindDue] = await Promise.all([
    loadTutorTodoCounts(tutorId, now, { unmarked: unmarkedP, invoiceRemind: remindP }),
    unmarkedP,
    prisma.classAbsence.findMany({
      where: { status: "pending", course: own }, orderBy: { startAt: "asc" }, take,
      select: { startAt: true, leadMinutes: true, reason: true, student: { select: { name: true } }, course: { select: { name: true } } },
    }),
    prisma.bankTransaction.findMany({ where: { tutorId, status: "pending" }, orderBy: { occurredAt: "asc" }, take, select: { amount: true, content: true, occurredAt: true } }),
    prisma.tuitionInvoice.findMany({
      where: { tutorId, status: "parent_reported", parentReportedAt: { lt: new Date(now.getTime() - 24 * 3600_000) } },
      orderBy: { parentReportedAt: "asc" }, take,
      select: { code: true, yearMonth: true, amountDue: true, paidAmount: true, parentReportedAt: true, student: { select: { name: true } } },
    }),
    prisma.tuitionInvoice.findMany({
      where: { tutorId, status: "draft" }, orderBy: { createdAt: "asc" }, take,
      select: { yearMonth: true, amountDue: true, createdAt: true, student: { select: { name: true } } },
    }),
    prisma.enrollment.findMany({
      where: { status: "pending_consent", course: own }, orderBy: { createdAt: "asc" }, take,
      select: { courseId: true, createdAt: true, user: { select: { name: true } }, course: { select: { name: true } } },
    }),
    prisma.threadReport.findMany({
      where: { status: "pending", thread: { deletedAt: null, course: own } }, orderBy: { createdAt: "asc" }, take,
      select: { reason: true, createdAt: true, thread: { select: { content: true, course: { select: { name: true } } } } },
    }),
    prisma.assignmentSubmission.findMany({
      where: { score: null, assignment: { mode: { not: "azota" }, lesson: { chapter: { section: { course: own } } } } }, orderBy: { submittedAt: "asc" }, take,
      select: {
        submittedAt: true, user: { select: { name: true } },
        assignment: { select: { title: true, lesson: { select: { chapter: { select: { section: { select: { courseId: true } } } } } } } },
      },
    }),
    prisma.assignmentAnswer.findMany({
      where: { pointsAwarded: null, textAnswer: { not: null }, question: { type: "ESSAY", assignment: { lesson: { chapter: { section: { course: own } } } } } },
      orderBy: { updatedAt: "asc" }, take,
      select: {
        updatedAt: true, user: { select: { name: true } },
        question: { select: { assignment: { select: { title: true, lesson: { select: { chapter: { select: { section: { select: { courseId: true } } } } } } } } } },
      },
    }),
    prisma.makeupCredit.findMany({
      where: { status: "active", course: own, expiresAt: { gt: now, lte: new Date(now.getTime() + MAKEUP_WARN_DAYS * 86400_000) } },
      orderBy: { expiresAt: "asc" }, select: { expiresAt: true, student: { select: { name: true } }, course: { select: { name: true } } },
    }),
    loadTutorSchedule(tutorId, today, addDaysKey(today, 2), now),
    remindP,
  ]);

  const expiring = makeups.filter(m => isMakeupExpiringSoon(m, now));
  const reminderRows: InboxRow[] = [];
  let reminderAt: Date | null = null;
  for (const o of week.occurrences) {
    if (o.status === "cancelled") continue;
    for (const s of o.students) for (const r of s.reminders) {
      if (!r.due || r.openedAt) continue;
      const due = new Date(r.kind === "h24" ? o.plan.h24DueAt : (o.plan.h1DueAt ?? o.plan.h24DueAt));
      if (!reminderAt || due < reminderAt) reminderAt = due;
      reminderRows.push({
        title: `${s.name} — nhắc ${r.recipient === "parent" ? "phụ huynh" : "học sinh"}`,
        sub: `${o.courseName} · buổi ${inboxDateTime(new Date(o.startAt))} · ${r.kind === "h24" ? "báo trước 24 giờ" : "báo trước 1 giờ"}`,
        href: "/lop-cua-toi/lich",
      });
    }
  }

  const courseOf = (a: { lesson: { chapter: { section: { courseId: string } } } }) => a.lesson.chapter.section.courseId;
  const ungradedRows: InboxRow[] = [
    ...subs.map(s => ({ title: s.user.name, sub: `${s.assignment.title} · nộp ${inboxDateTime(s.submittedAt)}`, href: `/lop-cua-toi/quan-lop/${courseOf(s.assignment)}`, at: s.submittedAt })),
    ...essays.map(e => ({ title: e.user.name, sub: `${e.question.assignment.title} · câu tự luận`, href: `/lop-cua-toi/quan-lop/${courseOf(e.question.assignment)}`, at: e.updatedAt })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, take).map(({ title, sub, href }) => ({ title, sub, href }));
  const ungradedAt = [subs[0]?.submittedAt, essays[0]?.updatedAt].filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return {
    absence: mk(c.lateAbsences, absences.map(a => ({
      title: a.student.name,
      sub: `${a.course.name} · buổi ${inboxDateTime(a.startAt)} · báo trước ${a.leadMinutes} phút${a.reason ? ` · "${cut(a.reason, 60)}"` : ""}`,
      href: "/lop-cua-toi/lich",
    })), absences[0]?.startAt),
    check: mk(c.needBankCheck, checks.map(i => ({
      title: i.student.name,
      sub: `Phiếu ${i.code} · ${monthText(i.yearMonth)} · còn ${inboxVnd(i.amountDue - i.paidAmount)} · báo đã chuyển ${i.parentReportedAt ? inboxDateTime(i.parentReportedAt) : ""}`.trim(),
      href: "/lop-cua-toi/hoc-phi",
    })), checks[0]?.parentReportedAt),
    bank: mk(c.bankPending, banks.map(b => ({
      title: inboxVnd(b.amount),
      sub: `${inboxDateTime(b.occurredAt)} · ${cut(b.content.replace(/\s+/g, " ").trim(), 80)}`,
      href: "/lop-cua-toi/hoc-phi?tab=doi-soat",
    })), banks[0]?.occurredAt),
    consent: mk(c.pendingConsent, consents.map(e => ({
      title: e.user.name, sub: `${e.course.name} · chờ phụ huynh xác nhận`, href: `/lop-cua-toi/quan-lop/${e.courseId}/hoc-vien`,
    })), consents[0]?.createdAt),
    reminders: mk(c.remindersDue, reminderRows.slice(0, take), reminderAt),
    makeup: mk(c.makeupExpiring, expiring.slice(0, take).map(m => ({
      title: m.student.name, sub: `${m.course.name} · buổi bù hết hạn ${inboxDateTime(m.expiresAt).slice(0, 5)}`, href: "/lop-cua-toi/lich",
    })), expiring[0]?.expiresAt),
    reports: mk(c.classReports, reports.map(r => ({
      title: cut(r.thread.content.replace(/\s+/g, " ").trim(), 80),
      sub: `Lý do: ${cut(r.reason, 60)}${r.thread.course ? ` · ${r.thread.course.name}` : ""}`, href: "/lop-cua-toi/kiem-duyet",
    })), reports[0]?.createdAt),
    ungraded: mk(c.ungraded, ungradedRows, ungradedAt),
    unmarked: mk(c.unmarkedSessions, unmarked.slice(0, take).map(u => ({
      title: u.courseName,
      sub: `buổi ${inboxDateTime(u.startAt)} · thiếu ${u.missing}/${u.total} em${u.missingNames.length ? `: ${u.missingNames.join(", ")}${u.missing > u.missingNames.length ? "…" : ""}` : ""}`,
      href: unmarkedHref(u.courseId, u.dateKey),
    })), unmarked[0]?.startAt),
    invoiceRemind: invoiceRemindSource(c.invoiceReminders, remindDue),
    draft: mk(c.draftInvoices, drafts.map(i => ({
      title: i.student.name, sub: `Phiếu nháp ${monthText(i.yearMonth)} · ${inboxVnd(i.amountDue)}`, href: "/lop-cua-toi/hoc-phi",
    })), drafts[0]?.createdAt),
  };
}
