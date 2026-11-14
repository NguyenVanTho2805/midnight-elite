// DG-HOC-ONLINE — một lượt "nhắc trước giờ học" (gọi từ /api/cron/nhac-buoi-hoc). Chạm DB + gửi thư; quy tắc thời gian thuần ở lessonReminder.ts.
// Buổi lấy đúng như Lịch của gia sư (reminderServer.ts): khung giờ tuần + dời / huỷ (applyChanges) + buổi lẻ / bù / phát sinh (AttendanceSession).
// Người nhận = học sinh Enrollment "active" của lớp (như remind-class: em chờ phụ huynh xác nhận hay tạm dừng KHÔNG nhận), bỏ em đã báo nghỉ buổi đó,
// bỏ tài khoản đã khoá / đã ẩn danh. Thư đi tới email tài khoản của chính học sinh (như remind-class), không gửi phụ huynh, không thu thêm dữ liệu.
import { prisma } from "@/lib/prisma";
import { instantOf, parseHm, vnDateKeyOf } from "@/lib/classSessions";
import { applyChanges } from "@/lib/sessionChange";
import { loadChanges } from "@/lib/sessionChangeServer";
import { effectiveMode, isOffScheduleKind, resolveJoinUrl } from "@/lib/sessionBook";
import { isAnonEmail } from "@/lib/accountDelete";
import { sendLessonReminderEmail } from "@/lib/email";
import {
  extraSessionKey, httpsJoinUrl, isReminderDue, leadOf, looksLikeMoney, MAX_EMAILS_PER_RUN, regularSessionKey, searchRangeKeys, buildLessonReminderEmail, type LeadMinutes,
} from "@/lib/lessonReminder";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const dayDate = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`);

export interface DueLesson {
  courseId: string;
  courseName: string;
  sessionKey: string;
  startAt: Date;
  endAt: Date | null;
  joinUrl: string | null;
  lead: LeadMinutes;
  /** Khoá báo nghỉ (chỉ buổi theo lịch tuần). */
  absence: { scheduleId: string; dateKey: string } | null;
}

/** Các buổi tới hạn nhắc ở `now` của MỌI lớp đã bật nhắc (đang mở, không tạm ngừng). */
export async function findDueLessons(now: Date): Promise<DueLesson[]> {
  const courses = await prisma.course.findMany({
    where: { reminderLeadMinutes: { not: null }, classStatus: { not: "paused" } },
    select: {
      id: true, name: true, classJoinUrl: true, reminderLeadMinutes: true,
      classSchedules: { where: { active: true }, select: { id: true, courseId: true, dayOfWeek: true, startTime: true, endTime: true, joinUrl: true, mode: true } },
    },
  });
  const live = courses.filter(c => leadOf(c.reminderLeadMinutes) !== null);
  if (live.length === 0) return [];
  const { fromKey, toKey } = searchRangeKeys(now);
  const rules = live.flatMap(c => c.classSchedules);
  const changes = await loadChanges(prisma, rules.map(r => r.id), fromKey, toKey);
  const occs = applyChanges(rules, changes, fromKey, toKey);
  const courseOf = new Map(live.map(c => [c.id, c]));
  const ruleOf = new Map(rules.map(r => [r.id, r]));
  const sessions = await prisma.attendanceSession.findMany({
    where: { courseId: { in: live.map(c => c.id) }, date: { gte: dayDate(fromKey), lte: dayDate(toKey) } },
    select: { id: true, courseId: true, date: true, joinUrl: true, mode: true, kind: true, startTime: true, endTime: true },
  });
  const sessionOf = new Map(sessions.map(s => [`${s.courseId}|${s.date.toISOString().slice(0, 10)}`, s]));

  const out: DueLesson[] = [];
  for (const o of occs) {
    if (o.status === "cancelled") continue;
    const c = courseOf.get(o.courseId)!;
    const lead = leadOf(c.reminderLeadMinutes)!;
    if (!isReminderDue(o.startAt, lead, now)) continue;
    const rule = ruleOf.get(o.scheduleId)!;
    const sess = sessionOf.get(`${o.courseId}|${o.dateKey}`) ?? null;
    const mode = effectiveMode({ sessionMode: sess?.mode, scheduleMode: rule.mode });
    const join = mode === "offline" ? null : resolveJoinUrl({ sessionUrl: sess?.joinUrl, scheduleUrl: rule.joinUrl, classUrl: c.classJoinUrl });
    out.push({
      courseId: c.id, courseName: c.name, sessionKey: regularSessionKey(o.scheduleId, o.originalDateKey), startAt: o.startAt, endAt: o.endAt,
      joinUrl: httpsJoinUrl(join?.url), lead, absence: { scheduleId: o.scheduleId, dateKey: o.originalDateKey },
    });
  }
  for (const x of sessions) {
    if (!isOffScheduleKind(x.kind) || !x.startTime) continue;
    const c = courseOf.get(x.courseId)!;
    const lead = leadOf(c.reminderLeadMinutes)!;
    const dk = x.date.toISOString().slice(0, 10);
    const s = parseHm(x.startTime), e = parseHm(x.endTime);
    if (s === null) continue;
    const startAt = instantOf(dk, s);
    if (!isReminderDue(startAt, lead, now)) continue;
    const mode = effectiveMode({ sessionMode: x.mode });
    const join = mode === "offline" ? null : resolveJoinUrl({ sessionUrl: x.joinUrl, classUrl: c.classJoinUrl });
    out.push({
      courseId: c.id, courseName: c.name, sessionKey: extraSessionKey(x.id), startAt, endAt: e !== null && e > s ? instantOf(dk, e) : null,
      joinUrl: httpsJoinUrl(join?.url), lead, absence: null,
    });
  }
  out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.sessionKey.localeCompare(b.sessionKey));
  return out;
}

export interface LessonReminderRun {
  dryRun: boolean;
  due: number;          // số buổi tới hạn
  recipients: number;   // số thư lẽ ra gửi (chưa trừ đã gửi trước)
  sent: number;
  alreadySent: number;
  /** Trong số `sent`: thư "Đổi giờ học" gửi lại vì buổi đã nhắc bị dời giờ. */
  rescheduled: number;
  failed: number;
  capped: boolean;      // chạm MAX_EMAILS_PER_RUN, phần còn lại để lượt sau
  lessons: { courseId: string; sessionKey: string; startAt: string; lead: number; students: number }[];
}

export async function runLessonReminders(now: Date, opts: { dryRun: boolean; limit?: number }): Promise<LessonReminderRun> {
  const limit = Math.max(0, Math.min(opts.limit ?? MAX_EMAILS_PER_RUN, MAX_EMAILS_PER_RUN));
  const due = await findDueLessons(now);
  const run: LessonReminderRun = { dryRun: opts.dryRun, due: due.length, recipients: 0, sent: 0, alreadySent: 0, rescheduled: 0, failed: 0, capped: false, lessons: [] };
  for (const l of due) {
    const [enrolls, absent, logged] = await Promise.all([
      prisma.enrollment.findMany({
        where: { courseId: l.courseId, status: "active", user: { banned: false, deletedAt: null } },
        select: { user: { select: { id: true, email: true } } },
      }),
      l.absence
        ? prisma.classAbsence.findMany({ where: { scheduleId: l.absence.scheduleId, dateKey: l.absence.dateKey }, select: { studentId: true } })
        : Promise.resolve([] as { studentId: string }[]),
      prisma.classLessonReminderLog.findMany({ where: { courseId: l.courseId, sessionKey: l.sessionKey }, select: { id: true, userId: true, startAt: true } }),
    ]);
    const skip = new Set(absent.map(a => a.studentId));
    // Đã nhắc ở đúng giờ này ⇒ bỏ. Đã nhắc ở giờ KHÁC (gia sư dời buổi) ⇒ dòng cũ là "cũ", gửi lại thư "Đổi giờ học".
    const done = new Set(logged.filter(x => x.startAt.getTime() === l.startAt.getTime()).map(x => x.userId));
    const stale = new Map(logged.filter(x => x.startAt.getTime() !== l.startAt.getTime()).map(x => [x.userId, x]));
    const students = enrolls.map(e => e.user).filter(u => !skip.has(u.id) && u.email && !isAnonEmail(u.email));
    run.recipients += students.length;
    run.lessons.push({ courseId: l.courseId, sessionKey: l.sessionKey, startAt: l.startAt.toISOString(), lead: l.lead, students: students.length });
    const mailInput = {
      courseName: l.courseName, startAt: l.startAt, endAt: l.endAt, joinUrl: l.joinUrl, leadMinutes: l.lead,
      classUrl: `${APP_URL}/student/hoc-tap?course=${encodeURIComponent(l.courseId)}`,
    };
    const mail = buildLessonReminderEmail(mailInput);
    const movedMail = buildLessonReminderEmail({ ...mailInput, rescheduled: true });
    // Chốt chặn: tên lớp do gia sư đặt có thể chứa con số + "đ" — thư nhắc không được mang số tiền, nên bỏ hẳn buổi đó (ghi log) thay vì gửi.
    if (looksLikeMoney(mail.subject) || looksLikeMoney(mail.text) || looksLikeMoney(movedMail.subject) || looksLikeMoney(movedMail.text)) {
      console.warn(`[nhac-buoi-hoc] bỏ ${l.courseId} ${l.sessionKey}: nội dung thư có dạng số tiền`);
      continue;
    }
    for (const s of students) {
      if (done.has(s.id)) { run.alreadySent++; continue; }
      if (run.sent + run.failed >= limit) { run.capped = true; break; }
      const old = stale.get(s.id);
      if (opts.dryRun) { run.sent++; if (old) run.rescheduled++; continue; }
      // Dời giờ: xoá đúng dòng cũ (khớp cả startAt cũ) rồi tạo lại — hai lượt chồng nhau thì một lượt tạo được, lượt kia gặp P2002.
      if (old) await prisma.classLessonReminderLog.deleteMany({ where: { id: old.id, startAt: old.startAt } });
      // Tạo dòng TRƯỚC khi gửi: hai lượt chạy chồng nhau thì lượt thua gặp P2002 và bỏ qua.
      let logId: string;
      try {
        const row = await prisma.classLessonReminderLog.create({ data: { courseId: l.courseId, sessionKey: l.sessionKey, userId: s.id, startAt: l.startAt, leadMinutes: l.lead }, select: { id: true } });
        logId = row.id;
      } catch (e) {
        if ((e as { code?: string })?.code === "P2002") { run.alreadySent++; continue; }
        throw e;
      }
      try {
        await sendLessonReminderEmail(s.email, old ? movedMail : mail);
        run.sent++;
        if (old) run.rescheduled++;
      } catch (e) {
        console.error("[nhac-buoi-hoc] gửi thư lỗi:", e);
        run.failed++;
        await prisma.classLessonReminderLog.delete({ where: { id: logId } }).catch(() => {}); // lượt sau thử lại nếu còn trong cửa sổ
      }
    }
    if (run.capped) break;
  }
  if (run.capped) console.warn(`[nhac-buoi-hoc] chạm giới hạn ${limit} thư/lượt lúc ${vnDateKeyOf(now)}`);
  return run;
}
