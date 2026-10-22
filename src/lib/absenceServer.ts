// TT-202 — báo nghỉ, buổi bù (phần chạm DB). Quy tắc thuần ở classSessions.ts.
//
// Một lần báo nghỉ = một ClassAbsence, định danh (scheduleId, dateKey, studentId) duy nhất:
//   • báo trước ≥ 2 giờ  → "excused_auto": ghi điểm danh "Có phép", tự giữ 1 buổi bù. Gia sư không phải làm gì.
//   • báo trước < 2 giờ  → "pending": vào Hộp việc, gia sư bấm MỘT nút:
//        "free_makeup" → ghi "Có phép" + giữ 1 buổi bù + soạn tin cho phụ huynh
//        "charge"      → tính phí buổi này, không có buổi bù (điểm danh để nguyên "chưa điểm danh")
// Mọi bước ghi chạy trong một transaction, khoá theo từng buổi × học sinh, nên hai lần bấm
// cùng lúc (hoặc phụ huynh bấm đúp) không sinh hai buổi bù; MakeupCredit.absenceId @unique là
// chốt chặn cuối.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { notify } from "@/lib/notify";
import {
  absenceDeadline, addDaysKey, buildAbsenceChargedMessage, buildAbsenceFreeMessage, classifyAbsenceReport,
  dayOfWeekOfKey, describeLead, hmOf, isValidDateKey, makeupExpiry, parseHm, tutorTitle, vnDateKeyOf, vnMinutesOfDay,
} from "@/lib/classSessions";
import { applyChanges, effectiveSlot } from "@/lib/sessionChange";
import { findChange, loadChanges } from "@/lib/sessionChangeServer";

type Tx = Prisma.TransactionClient;

export const ABSENCE_MAX_DAYS_AHEAD = 35;
export type AbsenceFail = { ok: false; status: number; error: string };

const fail = (status: number, error: string): AbsenceFail => ({ ok: false, status, error });
const sessionDate = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`); // khớp normalizeAttendanceDate

/** Ghi "Có phép" cho buổi (tạo buổi điểm danh nếu chưa có). Không đè bản ghi gia sư đã tự điểm danh. */
async function markExcused(tx: Tx, o: { courseId: string; ownerId: string | null; dateKey: string; studentId: string; by: string | null; note: string }) {
  const createdBy = o.ownerId ?? o.by;
  if (!createdBy) return; // lớp không có chủ (do quản trị tạo) và không có người xử lý: bỏ qua, ClassAbsence vẫn là sự thật
  const sess = await tx.attendanceSession.upsert({
    where: { courseId_date: { courseId: o.courseId, date: sessionDate(o.dateKey) } },
    create: { courseId: o.courseId, date: sessionDate(o.dateKey), createdBy },
    update: {},
  });
  const existing = await tx.attendanceRecord.findUnique({ where: { sessionId_userId: { sessionId: sess.id, userId: o.studentId } } });
  if (existing) return;
  await tx.attendanceRecord.create({ data: { sessionId: sess.id, userId: o.studentId, status: "excused", note: o.note, updatedBy: o.by } });
}

async function lockAbsence(tx: Tx, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`absence:${key}`}))`;
}

/** Buổi bù còn dùng được của 1 học sinh trong 1 lớp. */
export async function activeMakeupCount(db: Pick<Tx, "makeupCredit">, studentId: string, courseId: string, now: Date) {
  return db.makeupCredit.count({ where: { studentId, courseId, status: "active", expiresAt: { gt: now } } });
}

export interface ReportAbsenceInput {
  studentId: string;
  scheduleId: string;
  dateKey: string;
  reportedBy: "parent" | "student";
  reason?: string | null;
  now?: Date;
}
export type ReportAbsenceResult =
  | { ok: true; kind: "auto" | "late"; absenceId: string; status: string; leadMinutes: number; deadlineAt: string; makeupGranted: boolean }
  | AbsenceFail;

export async function reportAbsence(i: ReportAbsenceInput): Promise<ReportAbsenceResult> {
  const now = i.now ?? new Date();
  if (!isValidDateKey(i.dateKey)) return fail(400, "Ngày buổi học không hợp lệ");
  const reason = i.reason?.trim().slice(0, 500) || null;

  const sched = await prisma.classSchedule.findUnique({
    where: { id: i.scheduleId },
    select: { id: true, courseId: true, dayOfWeek: true, startTime: true, endTime: true, active: true, course: { select: { id: true, name: true, ownerId: true } } },
  });
  if (!sched || !sched.active) return fail(404, "Không tìm thấy buổi học này");
  if (dayOfWeekOfKey(i.dateKey) !== sched.dayOfWeek) return fail(400, "Ngày này không có buổi học theo lịch của lớp");
  const startMin = parseHm(sched.startTime);
  if (startMin === null) return fail(400, "Giờ học của lớp chưa đặt đúng, vui lòng báo trực tiếp với gia sư");
  // `dateKey` là ngày GỐC (định danh buổi). Buổi gia sư đã huỷ thì không báo nghỉ; buổi đã dời thì tính theo giờ MỚI.
  const change = await findChange(prisma, sched.id, i.dateKey);
  if (change?.kind === "cancel") return fail(409, "Buổi này gia sư đã huỷ nên không cần báo nghỉ");
  const slot = effectiveSlot(sched, i.dateKey, change);
  if (!slot) return fail(400, "Giờ học của lớp chưa đặt đúng, vui lòng báo trực tiếp với gia sư");
  const startAt = slot.startAt;

  const cls = classifyAbsenceReport(startAt, now);
  if (cls.kind === "started") return fail(400, "Buổi học đã bắt đầu, không báo nghỉ qua sổ học được nữa — vui lòng nhắn trực tiếp cho gia sư");
  if (i.dateKey > addDaysKey(vnDateKeyOf(now), ABSENCE_MAX_DAYS_AHEAD)) return fail(400, `Chỉ báo nghỉ trước tối đa ${ABSENCE_MAX_DAYS_AHEAD} ngày`);

  const enrolled = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: i.studentId, courseId: sched.courseId } }, select: { status: true },
  });
  if (!enrolled || enrolled.status !== "active") return fail(403, "Con không còn học lớp này");

  const student = await prisma.user.findUnique({ where: { id: i.studentId }, select: { name: true } });

  const result = await prisma.$transaction(async (tx): Promise<ReportAbsenceResult> => {
    await lockAbsence(tx, `${i.scheduleId}:${i.dateKey}:${i.studentId}`);
    const dup = await tx.classAbsence.findUnique({
      where: { scheduleId_dateKey_studentId: { scheduleId: i.scheduleId, dateKey: i.dateKey, studentId: i.studentId } },
      select: { status: true },
    });
    if (dup) return fail(409, "Buổi này đã được báo nghỉ rồi");

    const auto = cls.kind === "auto";
    const abs = await tx.classAbsence.create({
      data: {
        courseId: sched.courseId, scheduleId: sched.id, dateKey: i.dateKey, startAt, studentId: i.studentId,
        reportedBy: i.reportedBy, reportedAt: now, leadMinutes: cls.leadMinutes, reason,
        status: auto ? "excused_auto" : "pending", resolvedAt: auto ? now : null,
      },
    });
    if (auto) {
      await tx.makeupCredit.create({
        data: { studentId: i.studentId, courseId: sched.courseId, absenceId: abs.id, grantedAt: now, expiresAt: makeupExpiry(now) },
      });
      await markExcused(tx, { courseId: sched.courseId, ownerId: sched.course.ownerId, dateKey: slot.dateKey, studentId: i.studentId, by: null, note: "Nghỉ có báo (báo trước giờ học)" });
    }
    return { ok: true, kind: auto ? "auto" : "late", absenceId: abs.id, status: abs.status, leadMinutes: cls.leadMinutes, deadlineAt: absenceDeadline(startAt).toISOString(), makeupGranted: auto };
  });

  // Báo sát giờ: kéo gia sư vào xử lý. Thông báo là phụ trợ — lỗi gửi không được làm hỏng việc đã ghi.
  if (result.ok && result.kind === "late" && sched.course.ownerId) {
    void notify(sched.course.ownerId, {
      type: "absence_late",
      title: "Báo nghỉ sát giờ",
      message: `${student?.name ?? "Học viên"} xin nghỉ buổi ${sched.course.name} lúc ${hmOf(vnMinutesOfDay(startAt))} ngày ${slot.dateKey.slice(8, 10)}/${slot.dateKey.slice(5, 7)} (${describeLead(cls.leadMinutes)}). Bấm một nút để xử lý.`,
      link: "/lop-cua-toi/lich",
    }, { leadMinutes: cls.leadMinutes }).catch(() => {});
  }
  return result;
}

export type ResolveAction = "free_makeup" | "charge";
export type ResolveResult =
  | { ok: true; status: string; message: string; makeupCount: number; parentPhone: string | null; parentName: string | null }
  | AbsenceFail;

/** Gia sư xử lý báo nghỉ sát giờ bằng một nút. Chỉ chủ lớp. Chỉ xử lý được khi còn "pending". */
export async function resolveAbsence(o: { absenceId: string; tutorId: string; action: ResolveAction; now?: Date }): Promise<ResolveResult> {
  const now = o.now ?? new Date();
  const abs = await prisma.classAbsence.findUnique({
    where: { id: o.absenceId },
    select: { id: true, courseId: true, scheduleId: true, studentId: true, dateKey: true, course: { select: { ownerId: true } }, student: { select: { parentPhone: true, parentName: true } } },
  });
  if (!abs) return fail(404, "Không tìm thấy báo nghỉ");
  // Điểm danh ghi vào ngày buổi THẬT SỰ diễn ra (buổi đã dời thì khác ngày gốc dùng làm định danh).
  const sched = await prisma.classSchedule.findUnique({ where: { id: abs.scheduleId }, select: { dayOfWeek: true, startTime: true, endTime: true } });
  const eff = sched ? effectiveSlot(sched, abs.dateKey, await findChange(prisma, abs.scheduleId, abs.dateKey)) : null;
  const attendanceDateKey = eff?.dateKey ?? abs.dateKey;
  if (abs.course.ownerId !== o.tutorId) return fail(403, "Bạn không có quyền với lớp này");
  const tutor = await prisma.user.findUnique({ where: { id: o.tutorId }, select: { name: true } });

  return prisma.$transaction(async (tx): Promise<ResolveResult> => {
    await lockAbsence(tx, `id:${abs.id}`);
    const cur = await tx.classAbsence.findUnique({ where: { id: abs.id }, select: { status: true } });
    if (!cur) return fail(404, "Không tìm thấy báo nghỉ");
    if (cur.status !== "pending") return fail(409, "Báo nghỉ này đã được xử lý rồi");

    const free = o.action === "free_makeup";
    await tx.classAbsence.update({ where: { id: abs.id }, data: { status: free ? "excused_free" : "charged", resolvedAt: now, resolvedBy: o.tutorId } });
    if (free) {
      await tx.makeupCredit.create({
        data: { studentId: abs.studentId, courseId: abs.courseId, absenceId: abs.id, grantedAt: now, expiresAt: makeupExpiry(now) },
      });
      await markExcused(tx, { courseId: abs.courseId, ownerId: abs.course.ownerId, dateKey: attendanceDateKey, studentId: abs.studentId, by: o.tutorId, note: "Nghỉ có báo — gia sư không tính phí, giữ 1 buổi bù" });
    }
    const makeupCount = await activeMakeupCount(tx, abs.studentId, abs.courseId, now);
    const message = free
      ? buildAbsenceFreeMessage({ dateKey: abs.dateKey, makeupCount, tutorName: tutorTitle(tutor?.name) })
      : buildAbsenceChargedMessage({ dateKey: abs.dateKey });
    return { ok: true, status: free ? "excused_free" : "charged", message, makeupCount, parentPhone: abs.student.parentPhone, parentName: abs.student.parentName };
  });
}

export const UPCOMING_DAYS = 14;
export interface UpcomingSession {
  scheduleId: string;
  courseId: string;
  courseName: string;
  /** Ngày HIỆU LỰC (nơi buổi thật sự diễn ra). */
  dateKey: string;
  /** Ngày GỐC theo lịch tuần = định danh buổi; Báo nghỉ phải gửi ngày này. */
  originalDateKey: string;
  status: "scheduled" | "cancelled" | "moved";
  movedFrom: { dateKey: string; startAt: string } | null;
  /** Lý do gia sư ghi khi dời/huỷ (nếu có). */
  changeReason: string | null;
  startAt: string;
  endAt: string;
  joinUrl: string | null;
  /** Hạn báo nghỉ để còn được giữ buổi bù (giờ học − 2 giờ). */
  deadlineAt: string;
  /** Còn trong hạn → báo nghỉ ngay được giữ buổi bù tự động. */
  freeWindowOpen: boolean;
  absence: { status: string; leadMinutes: number } | null;
}
export interface MakeupSummary {
  count: number;
  nextExpiresAt: string | null;
  items: { courseId: string; courseName: string; expiresAt: string }[];
}

/** Các buổi sắp tới của 1 học sinh + số buổi bù đang giữ — dùng cho "Sổ của con". */
export async function loadStudentUpcoming(studentId: string, now: Date): Promise<{ upcoming: UpcomingSession[]; makeup: MakeupSummary }> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: studentId, status: "active" },
    select: { course: { select: { id: true, name: true, classSchedules: { where: { active: true }, select: { id: true, courseId: true, dayOfWeek: true, startTime: true, endTime: true, joinUrl: true } } } } },
  });
  const rules = enrollments.flatMap(e => e.course.classSchedules);
  const nameOf = new Map(enrollments.map(e => [e.course.id, e.course.name]));
  const joinOf = new Map(rules.map(r => [r.id, r.joinUrl]));
  const today = vnDateKeyOf(now);
  const toKey = addDaysKey(today, UPCOMING_DAYS - 1);
  const changes = await loadChanges(prisma, rules.map(r => r.id), today, toKey);
  // Buổi đã huỷ vẫn hiện (kèm chữ "đã huỷ") để phụ huynh không đi nhầm; chỉ ẩn buổi đã bắt đầu.
  const occs = applyChanges(rules, changes, today, toKey).filter(o => o.startAt.getTime() > now.getTime());
  const originalKeys = [...new Set(occs.map(o => o.originalDateKey))];

  const [absences, credits] = await Promise.all([
    prisma.classAbsence.findMany({
      where: { studentId, scheduleId: { in: rules.map(r => r.id) }, dateKey: { in: originalKeys } },
      select: { scheduleId: true, dateKey: true, status: true, leadMinutes: true },
    }),
    prisma.makeupCredit.findMany({
      where: { studentId, status: "active", expiresAt: { gt: now } },
      select: { courseId: true, expiresAt: true },
      orderBy: { expiresAt: "asc" },
    }),
  ]);
  const absOf = new Map(absences.map(a => [`${a.scheduleId}|${a.dateKey}`, a]));
  const upcoming: UpcomingSession[] = occs.map(o => {
    const a = absOf.get(`${o.scheduleId}|${o.originalDateKey}`) ?? null;
    const deadline = absenceDeadline(o.startAt);
    return {
      scheduleId: o.scheduleId, courseId: o.courseId, courseName: nameOf.get(o.courseId) ?? "",
      dateKey: o.dateKey, originalDateKey: o.originalDateKey, status: o.status,
      movedFrom: o.movedFrom ? { dateKey: o.movedFrom.dateKey, startAt: o.movedFrom.startAt.toISOString() } : null,
      changeReason: o.change?.reason ?? null,
      startAt: o.startAt.toISOString(), endAt: o.endAt.toISOString(),
      joinUrl: joinOf.get(o.scheduleId) ?? null,
      deadlineAt: deadline.toISOString(), freeWindowOpen: now.getTime() < deadline.getTime(),
      absence: a ? { status: a.status, leadMinutes: a.leadMinutes } : null,
    };
  });
  return {
    upcoming,
    makeup: {
      count: credits.length,
      nextExpiresAt: credits[0]?.expiresAt.toISOString() ?? null,
      items: credits.map(c => ({ courseId: c.courseId, courseName: nameOf.get(c.courseId) ?? "", expiresAt: c.expiresAt.toISOString() })),
    },
  };
}
