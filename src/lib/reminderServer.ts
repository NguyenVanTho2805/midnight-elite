// TT-201 — dựng lịch tuần của gia sư kèm tin nhắc chờ gửi và báo nghỉ. Chạm DB; quy tắc
// thuần ở classSessions.ts. Một nguồn duy nhất cho trang Lịch, Hộp việc (bộ đếm) và test.
//
// Không có cron: tin nhắc "tới hạn" được TÍNH mỗi lần mở (giờ hiện tại so với kế hoạch của
// từng buổi), nên hạ tầng không cần chạy theo giờ và không có tin nào "trôi mất" khi cron lỗi.
// Chỉ có một dữ liệu được lưu — ClassReminderLog "Đã mở Zalo lúc …" — để một tin không hiện
// lại sau khi gia sư đã xử lý, và để mỗi bên chỉ có tối đa 2 tin cho mỗi buổi.
import { prisma } from "@/lib/prisma";
import {
  absenceDeadline, buildReminderMessage, dueReminderKinds, isMakeupExpiringSoon, MAKEUP_WARN_DAYS,
  reminderPlan, tutorTitle, vnDateKeyOf, addDaysKey, type ReminderKind, type ReminderRecipient,
} from "@/lib/classSessions";
import { applyChanges } from "@/lib/sessionChange";
import { loadChanges } from "@/lib/sessionChangeServer";
import { readPreferences, reminderChannels } from "@/lib/userPreferences";

export interface ReminderItem {
  recipient: ReminderRecipient;
  kind: ReminderKind;
  /** Đã tới hạn gửi (và buổi chưa bắt đầu). */
  due: boolean;
  /** Gia sư đã mở Zalo với tin này lúc nào (KiN không biết tin có đi thật hay không). */
  openedAt: string | null;
  message: string;
  /** SĐT để mở đúng cuộc trò chuyện Zalo; null nếu học viên/phụ huynh chưa khai. */
  phone: string | null;
}
export interface ScheduleStudent {
  id: string;
  name: string;
  absence: { id: string; status: string; leadMinutes: number; reason: string | null } | null;
  reminders: ReminderItem[];
}
export interface ScheduleOccurrence {
  /** Định danh buổi: khung giờ + ngày GỐC theo lịch tuần (không đổi khi dời). */
  key: string;
  scheduleId: string;
  courseId: string;
  courseName: string;
  /** Ngày HIỆU LỰC (nơi buổi thật sự diễn ra; khác ngày gốc nếu buổi đã dời). */
  dateKey: string;
  /** Ngày GỐC theo lịch tuần — khoá của báo nghỉ, nhắc lịch, dời/huỷ. */
  originalDateKey: string;
  status: "scheduled" | "cancelled" | "moved";
  movedFrom: { dateKey: string; startAt: string; endAt: string } | null;
  /** Gia sư đã dời/huỷ buổi này; `zaloOpenedAt` = đã mở Zalo để báo lớp (không phải "đã gửi"). */
  change: { id: string; kind: "cancel" | "move"; reason: string | null; zaloOpenedAt: string | null } | null;
  startAt: string;
  endAt: string;
  started: boolean;
  joinUrl: string | null;
  note: string | null;
  /** PH-216: link nhóm Zalo của lớp (nếu gia sư đã gắn ở Cài đặt → Kết nối). */
  zaloGroupUrl: string | null;
  plan: { h24DueAt: string; h24Shifted: boolean; h1DueAt: string | null; h1SkipReason: string | null; absenceDeadlineAt: string };
  students: ScheduleStudent[];
  pendingAbsences: number;
  remindersDue: number;
}

export async function loadTutorSchedule(tutorId: string, fromKey: string, toKey: string, now: Date) {
  const [me, courses] = await Promise.all([
    prisma.user.findUnique({ where: { id: tutorId }, select: { name: true, preferences: true } }),
    prisma.course.findMany({
      where: { ownerId: tutorId },
      select: { id: true, name: true, zaloGroupUrl: true, classSchedules: { where: { active: true }, select: { id: true, courseId: true, dayOfWeek: true, startTime: true, endTime: true, note: true, joinUrl: true } } },
    }),
  ]);
  const channels = reminderChannels(readPreferences(me?.preferences));
  const rules = courses.flatMap(c => c.classSchedules);
  const changes = await loadChanges(prisma, rules.map(r => r.id), fromKey, toKey);
  const occs = applyChanges(rules, changes, fromKey, toKey);
  const courseName = new Map(courses.map(c => [c.id, c.name]));
  const groupUrlOf = new Map(courses.map(c => [c.id, c.zaloGroupUrl]));
  const ruleById = new Map(rules.map(r => [r.id, r]));
  const courseIds = courses.map(c => c.id);

  const ruleIds = occs.length === 0 ? [] : rules.map(r => r.id); // `in: []` → không truy vấn thừa dữ liệu
  const originalKeys = [...new Set(occs.map(o => o.originalDateKey))];
  const [enrollments, absences, logs] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: { in: ruleIds.length ? courseIds : [] }, status: "active" },
      select: { courseId: true, user: { select: { id: true, name: true, phone: true, parentPhone: true } } },
    }),
    // Báo nghỉ / nhắc lịch khoá theo ngày GỐC; buổi dời có thể có ngày gốc ngoài cửa sổ nên tra theo tập ngày gốc của các buổi đang hiện.
    prisma.classAbsence.findMany({
      where: { scheduleId: { in: ruleIds }, dateKey: { in: originalKeys } },
      select: { id: true, scheduleId: true, dateKey: true, studentId: true, status: true, leadMinutes: true, reason: true },
    }),
    prisma.classReminderLog.findMany({
      where: { scheduleId: { in: ruleIds }, dateKey: { in: originalKeys } },
      select: { scheduleId: true, dateKey: true, studentId: true, recipient: true, kind: true, openedAt: true },
    }),
  ]);

  const studentsOf = new Map<string, typeof enrollments>();
  for (const e of enrollments) { const l = studentsOf.get(e.courseId) ?? []; l.push(e); studentsOf.set(e.courseId, l); }
  const absKey = (s: string, d: string, u: string) => `${s}|${d}|${u}`;
  const absOf = new Map(absences.map(a => [absKey(a.scheduleId, a.dateKey, a.studentId), a]));
  const logOf = new Map(logs.map(l => [`${absKey(l.scheduleId, l.dateKey, l.studentId)}|${l.recipient}|${l.kind}`, l.openedAt]));
  const tutorName = tutorTitle(me?.name);

  const occurrences: ScheduleOccurrence[] = occs.map(o => {
    const rule = ruleById.get(o.scheduleId)!;
    const cName = courseName.get(o.courseId) ?? "";
    const plan = reminderPlan(o.startAt);
    const kinds = dueReminderKinds(o.startAt, now);
    const students: ScheduleStudent[] = (studentsOf.get(o.courseId) ?? [])
      .map(e => e.user)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map(u => {
        const a = absOf.get(absKey(o.scheduleId, o.originalDateKey, u.id)) ?? null;
        const reminders: ReminderItem[] = [];
        // Đã báo nghỉ thì KHÔNG nhắc (đặc tả TT-201): không tạo tin cho em này ở buổi này. Buổi đã HUỶ cũng không nhắc.
        if (!a && o.status !== "cancelled") {
          for (const recipient of ["parent", "student"] as const) {
            if (!channels[recipient]) continue;
            for (const kind of ["h24", "h1"] as const) {
              const openedAt = logOf.get(`${absKey(o.scheduleId, o.originalDateKey, u.id)}|${recipient}|${kind}`) ?? null;
              const due = kinds.includes(kind);
              if (!due && !openedAt) continue; // chưa tới hạn và chưa từng mở: chưa có gì để hiện
              reminders.push({
                recipient, kind, due, openedAt: openedAt ? openedAt.toISOString() : null,
                phone: recipient === "parent" ? u.parentPhone : u.phone,
                message: buildReminderMessage({ kind, recipient, studentName: u.name, subject: cName, startAt: o.startAt, tutorName, joinUrl: rule.joinUrl, now }),
              });
            }
          }
        }
        return { id: u.id, name: u.name, absence: a ? { id: a.id, status: a.status, leadMinutes: a.leadMinutes, reason: a.reason } : null, reminders };
      });
    return {
      key: `${o.scheduleId}:${o.originalDateKey}`, scheduleId: o.scheduleId, courseId: o.courseId, courseName: cName, dateKey: o.dateKey,
      originalDateKey: o.originalDateKey, status: o.status,
      movedFrom: o.movedFrom ? { dateKey: o.movedFrom.dateKey, startAt: o.movedFrom.startAt.toISOString(), endAt: o.movedFrom.endAt.toISOString() } : null,
      change: o.change && o.change.id ? { id: o.change.id, kind: o.change.kind, reason: o.change.reason, zaloOpenedAt: o.change.zaloOpenedAt ? o.change.zaloOpenedAt.toISOString() : null } : null,
      startAt: o.startAt.toISOString(), endAt: o.endAt.toISOString(), started: o.startAt.getTime() <= now.getTime(),
      joinUrl: rule.joinUrl, note: rule.note, zaloGroupUrl: groupUrlOf.get(o.courseId) ?? null,
      plan: {
        h24DueAt: plan.h24.dueAt.toISOString(), h24Shifted: plan.h24.shifted,
        h1DueAt: plan.h1 ? plan.h1.dueAt.toISOString() : null, h1SkipReason: plan.h1SkipReason,
        absenceDeadlineAt: absenceDeadline(o.startAt).toISOString(),
      },
      students,
      pendingAbsences: o.status === "cancelled" ? 0 : students.filter(s => s.absence?.status === "pending").length,
      remindersDue: students.reduce((n, s) => n + s.reminders.filter(r => r.due && !r.openedAt).length, 0),
    };
  });
  return { occurrences, channels };
}

/** Ba bộ đếm cho Hộp việc/chấm trên Lịch. Mỗi con số có nguồn là dữ liệu thật, không cache riêng. */
export async function loadScheduleCounters(tutorId: string, now: Date) {
  const today = vnDateKeyOf(now);
  const [pendingAbsences, week, expiring] = await Promise.all([
    prisma.classAbsence.count({ where: { status: "pending", course: { ownerId: tutorId } } }),
    // Tin tới hạn chỉ có ở các buổi bắt đầu trong ~2 ngày tới (24 giờ + phần dời về tối hôm trước).
    loadTutorSchedule(tutorId, today, addDaysKey(today, 2), now),
    prisma.makeupCredit.findMany({
      where: { status: "active", course: { ownerId: tutorId }, expiresAt: { gt: now, lte: new Date(now.getTime() + MAKEUP_WARN_DAYS * 86400_000) } },
      select: { expiresAt: true },
    }),
  ]);
  return {
    pendingAbsences,
    remindersDue: week.occurrences.reduce((n, o) => n + o.remindersDue, 0),
    makeupExpiring: expiring.filter(c => isMakeupExpiringSoon(c, now)).length,
  };
}
