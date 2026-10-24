// BU-01..BU-07, LI-10, LI-11, LI-16, LI-17 — phần chạm DB của trang buổi học. Quy tắc thuần ở sessionBook.ts.
//
// TIỀN (quy tắc kho mục 5: "tiền chốt vào sự kiện; chỉ buổi đã chốt mới tính tiền"): tệp này KHÔNG import feeChargeServer, KHÔNG ghi FeeCharge /
// TuitionInvoice (chỉ ĐẾM để cảnh báo khi mở lại buổi). Việc sinh/gỡ dòng phí khi chốt/mở lại nằm ở route close (feeChargeServer).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/session";
import { applyChanges } from "@/lib/sessionChange";
import { loadChanges } from "@/lib/sessionChangeServer";
import { hmOf, isValidDateKey, parseHm, vnMinutesOfDay } from "@/lib/classSessions";
import {
  effectiveLocation, effectiveMode, findSlotConflicts, isClosed, isOffScheduleKind, reopenWarning, resolveJoinUrl, tallyAttendance,
  type SlotWithStudents, type SlotConflict, type SessionMode, type JoinSource,
} from "@/lib/sessionBook";

type Db = Prisma.TransactionClient | typeof prisma;

/** AttendanceSession.date là 00:00 UTC của NGÀY VN (cùng quy ước normalizeAttendanceDate). */
export const dayDate = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`);

export type CourseLite = { id: string; name: string; ownerId: string | null; classJoinUrl: string | null; zaloGroupUrl: string | null; calendarColor: string | null };

/** Mẫu quyền của route chị em: MANAGE_COURSES + ownsResource. Lớp không có → 404, lớp người khác → 403. */
export async function authorizeCourse(courseId: string): Promise<{ res: NextResponse } | { auth: SessionPayload; course: CourseLite }> {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return { res: auth };
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, ownerId: true, classJoinUrl: true, zaloGroupUrl: true, calendarColor: true } });
  if (!course) return { res: NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 }) };
  if (!ownsResource(auth, course.ownerId)) return { res: NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 }) };
  return { auth, course };
}

/** Tìm buổi của (lớp, ngày); chưa có thì tạo. Hai lần gọi cùng lúc: lần thua đua đọc lại bản ghi của lần thắng. */
export async function ensureSession(db: Db, courseId: string, dateKey: string, by: string, create: Partial<Prisma.AttendanceSessionUncheckedCreateInput> = {}) {
  const date = dayDate(dateKey);
  const found = await db.attendanceSession.findUnique({ where: { courseId_date: { courseId, date } } });
  if (found) return found;
  try {
    return await db.attendanceSession.create({ data: { courseId, date, createdBy: by, ...create } });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      const again = await db.attendanceSession.findUnique({ where: { courseId_date: { courseId, date } } });
      if (again) return again;
    }
    throw e;
  }
}

/** Số dòng phí của buổi đã nằm trong phiếu + số phiếu (chưa huỷ) của các em trong lớp ở tháng của buổi. CHỈ ĐẾM, không ghi. */
export async function reopenImpact(db: Db, session: { id: string; courseId: string; date: Date }, ownerId: string | null) {
  const yearMonth = session.date.toISOString().slice(0, 7);
  const recs = await db.attendanceRecord.findMany({ where: { sessionId: session.id }, select: { id: true, userId: true } });
  const invoicedCharges = recs.length
    ? await db.feeCharge.count({ where: { recordId: { in: recs.map(r => r.id) }, invoiceId: { not: null } } })
    : 0;
  const enrolled = await db.enrollment.findMany({ where: { courseId: session.courseId, status: "active" }, select: { userId: true } });
  const studentIds = [...new Set([...enrolled.map(e => e.userId), ...recs.map(r => r.userId)])];
  const invoices = ownerId && studentIds.length
    ? await db.tuitionInvoice.count({ where: { tutorId: ownerId, yearMonth, studentId: { in: studentIds }, status: { not: "cancelled" } } })
    : 0;
  return { invoicedCharges, invoices, yearMonth, warning: reopenWarning({ invoicedCharges, invoices, yearMonth }) };
}

export interface SessionDetail {
  course: { id: string; name: string; calendarColor: string | null; zaloGroupUrl: string | null; classJoinUrl: string | null };
  dateKey: string;
  /** Có khung giờ tuần (hoặc buổi dời tới) rơi vào ngày này? false = ngày không có trong lịch tuần (buổi nhập bù/phát sinh). */
  scheduled: boolean;
  cancelled: boolean;
  time: { start: string; end: string } | null;
  kind: string;
  session: null | {
    id: string; state: string | null; closedAt: string | null; reopenedAt: string | null;
    taught: string | null; homework: string | null; summary: string | null;
    mode: string | null; location: string | null; joinUrl: string | null;
  };
  mode: SessionMode | null;
  location: string | null;
  join: { url: string; source: JoinSource } | null;
  tally: ReturnType<typeof tallyAttendance>;
  rosterCount: number;
  /** Chỉ khi buổi đã chốt: cảnh báo trước khi mở lại. */
  reopenWarning: string | null;
  /** Buổi gần nhất TRƯỚC ngày này của cùng lớp có ghi chép CHUNG (đã dạy / nhận xét chung). Không có ghi chép riêng từng em. */
  previous: null | { dateKey: string; taught: string | null; summary: string | null };
}

export async function loadSessionDetail(course: CourseLite, dateKey: string): Promise<SessionDetail> {
  const date = dayDate(dateKey);
  const [session, rules, rosterCount] = await Promise.all([
    prisma.attendanceSession.findUnique({ where: { courseId_date: { courseId: course.id, date } } }),
    prisma.classSchedule.findMany({ where: { courseId: course.id, active: true }, select: { id: true, courseId: true, dayOfWeek: true, startTime: true, endTime: true, active: true, mode: true, location: true, joinUrl: true } }),
    prisma.enrollment.count({ where: { courseId: course.id, status: "active" } }),
  ]);
  const changes = await loadChanges(prisma, rules.map(r => r.id), dateKey, dateKey);
  const occs = applyChanges(rules, changes, dateKey, dateKey);
  const live = occs.filter(o => o.status !== "cancelled");
  const primary = live[0] ?? null;
  const rule = primary ? rules.find(r => r.id === primary.scheduleId) ?? null : null;
  const records = session ? await prisma.attendanceRecord.findMany({ where: { sessionId: session.id }, select: { status: true } }) : [];

  const mode = effectiveMode({ sessionMode: session?.mode, scheduleMode: rule?.mode });
  const location = effectiveLocation({ mode, sessionLocation: session?.location, scheduleLocation: rule?.location });
  const join = resolveJoinUrl({ sessionUrl: session?.joinUrl, scheduleUrl: rule?.joinUrl, classUrl: course.classJoinUrl });
  let time: SessionDetail["time"] = null;
  if (primary) time = { start: hmOf(vnMinutesOfDay(primary.startAt)), end: hmOf(vnMinutesOfDay(primary.endAt)) };
  else if (session?.startTime && session.endTime) time = { start: session.startTime, end: session.endTime };

  const prev = await prisma.attendanceSession.findFirst({
    where: { courseId: course.id, date: { lt: date }, OR: [{ taught: { not: null } }, { summary: { not: null } }] },
    orderBy: { date: "desc" }, select: { date: true, taught: true, summary: true },
  });
  const previous = prev && ((prev.taught ?? "").trim() || (prev.summary ?? "").trim())
    ? { dateKey: prev.date.toISOString().slice(0, 10), taught: prev.taught?.trim() || null, summary: prev.summary?.trim() || null } : null;
  const impact = session && isClosed(session.state) ? await reopenImpact(prisma, session, course.ownerId) : null;
  return {
    course: { id: course.id, name: course.name, calendarColor: course.calendarColor, zaloGroupUrl: course.zaloGroupUrl, classJoinUrl: course.classJoinUrl },
    dateKey,
    scheduled: occs.length > 0,
    cancelled: occs.length > 0 && live.length === 0,
    time,
    kind: session?.kind && isOffScheduleKind(session.kind) ? session.kind : "regular",
    session: session ? {
      id: session.id, state: session.state, closedAt: session.closedAt?.toISOString() ?? null, reopenedAt: session.reopenedAt?.toISOString() ?? null,
      taught: session.taught, homework: session.homework, summary: session.summary, mode: session.mode, location: session.location, joinUrl: session.joinUrl,
    } : null,
    mode, location, join,
    tally: tallyAttendance(records),
    rosterCount,
    reopenWarning: impact?.warning ?? null,
    previous,
  };
}

// ── LI-10: kho buổi của gia sư để kiểm xung đột ──────────────────────────────────
async function tutorCourses(tutorId: string) {
  return prisma.course.findMany({
    where: { ownerId: tutorId },
    select: {
      id: true, name: true,
      classSchedules: { where: { active: true }, select: { id: true, courseId: true, dayOfWeek: true, startTime: true, endTime: true, active: true } },
      enrollments: { where: { status: "active" }, select: { userId: true } },
    },
  });
}

/** Mọi buổi (không huỷ) của gia sư trong ngày `dateKey`: buổi theo lịch tuần (đã áp dời/huỷ) + buổi lẻ/bù/phát sinh. */
export async function slotPoolForDate(tutorId: string, dateKey: string): Promise<SlotWithStudents[]> {
  const courses = await tutorCourses(tutorId);
  const rules = courses.flatMap(c => c.classSchedules);
  const nameOf = new Map(courses.map(c => [c.id, c.name]));
  const studentsOf = new Map(courses.map(c => [c.id, c.enrollments.map(e => e.userId)]));
  const changes = await loadChanges(prisma, rules.map(r => r.id), dateKey, dateKey);
  const out: SlotWithStudents[] = applyChanges(rules, changes, dateKey, dateKey)
    .filter(o => o.status !== "cancelled" && o.dateKey === dateKey)
    .map(o => ({
      key: `${o.scheduleId}:${o.originalDateKey}`, courseId: o.courseId, courseName: nameOf.get(o.courseId) ?? "", dateKey,
      startMin: vnMinutesOfDay(o.startAt), endMin: vnMinutesOfDay(o.endAt), studentIds: studentsOf.get(o.courseId) ?? [],
    }));
  const extras = await prisma.attendanceSession.findMany({
    where: { date: dayDate(dateKey), course: { ownerId: tutorId }, kind: { in: ["extra", "makeup", "adhoc"] }, startTime: { not: null } },
    select: { id: true, courseId: true, startTime: true, endTime: true },
  });
  for (const x of extras) {
    const s = parseHm(x.startTime), e = parseHm(x.endTime);
    if (s === null) continue;
    out.push({ key: `extra:${x.id}`, courseId: x.courseId, courseName: nameOf.get(x.courseId) ?? "", dateKey, startMin: s, endMin: e ?? s, studentIds: studentsOf.get(x.courseId) ?? [] });
  }
  return out;
}

/** Xung đột của một buổi cụ thể (ngày + giờ). `ignoreKey` = khoá buổi đang sửa/dời. */
export async function conflictsForSlot(tutorId: string, cand: { courseId: string; dateKey: string; startTime: string; endTime: string; ignoreKey?: string }): Promise<SlotConflict[]> {
  const s = parseHm(cand.startTime), e = parseHm(cand.endTime);
  if (s === null || e === null || !isValidDateKey(cand.dateKey)) return [];
  const pool = await slotPoolForDate(tutorId, cand.dateKey);
  const students = (await prisma.enrollment.findMany({ where: { courseId: cand.courseId, status: "active" }, select: { userId: true } })).map(x => x.userId);
  const name = (await prisma.course.findUnique({ where: { id: cand.courseId }, select: { name: true } }))?.name ?? "";
  return findSlotConflicts({ key: cand.ignoreKey ?? "__new__", courseId: cand.courseId, courseName: name, dateKey: cand.dateKey, startMin: s, endMin: e, studentIds: students }, pool);
}

/** Xung đột của một KHUNG GIỜ HẰNG TUẦN (so với các khung giờ khác cùng thứ của gia sư). `ignoreScheduleId` = khung đang sửa. */
export async function conflictsForRule(tutorId: string, cand: { courseId: string; dayOfWeek: number; startTime: string; endTime: string; ignoreScheduleId?: string }): Promise<SlotConflict[]> {
  const s = parseHm(cand.startTime), e = parseHm(cand.endTime);
  if (s === null || e === null) return [];
  const courses = await tutorCourses(tutorId);
  const pool: SlotWithStudents[] = [];
  for (const c of courses) {
    for (const r of c.classSchedules) {
      if (r.dayOfWeek !== cand.dayOfWeek || r.id === cand.ignoreScheduleId) continue;
      const rs = parseHm(r.startTime), re = parseHm(r.endTime);
      if (rs === null) continue;
      pool.push({ key: r.id, courseId: c.id, courseName: c.name, dateKey: "rule", startMin: rs, endMin: re ?? rs, studentIds: c.enrollments.map(x => x.userId) });
    }
  }
  const me = courses.find(c => c.id === cand.courseId);
  return findSlotConflicts({ key: "__new__", courseId: cand.courseId, courseName: me?.name ?? "", dateKey: "rule", startMin: s, endMin: e, studentIds: me?.enrollments.map(x => x.userId) ?? [] }, pool);
}
