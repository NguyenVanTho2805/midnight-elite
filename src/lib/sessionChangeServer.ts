// Gia sư dời / huỷ một buổi (phần chạm DB). Quy tắc thuần ở sessionChange.ts.
//
// Mọi bước ghi chạy trong MỘT transaction, khoá theo khung giờ (hai lần bấm cùng lúc hay hai buổi cùng dời tới một ngày không
// đua nhau). Quy tắc đã chốt cho các báo nghỉ của buổi bị đổi:
//   • HUỶ buổi: báo nghỉ còn "pending" → "voided" (buổi không diễn ra nên không tính phí, không buổi bù). Báo nghỉ ĐÃ xử lý
//     (có buổi bù / tính phí) giữ nguyên — KiN không tự thu hồi buổi bù hay tiền; chỉ đếm để báo gia sư xem lại.
//   • HUỶ rồi khôi phục / đổi thành DỜI: "voided" trả về "pending" để gia sư quyết định lại.
//   • DỜI buổi: xoá mốc "Đã mở Zalo" của các tin nhắc buổi đó để tin mới theo giờ mới hiện ra; báo nghỉ giữ nguyên.
// Không đụng tiền: không sửa phiếu học phí, không sửa buổi bù.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { notifyMany } from "@/lib/notify";
import { logAction } from "@/lib/auditLog";
import { instantOf, parseHm } from "@/lib/classSessions";
import { conflictText } from "@/lib/sessionBook";
import { describeChange, effectiveSlot, parseChangeInput, sessionChangeMessage, sessionRestoredMessage, whenText, type ChangeKind, type SessionChange } from "@/lib/sessionChange";

type Tx = Prisma.TransactionClient;
type Db = Pick<typeof prisma, "classSessionChange">;
export type ChangeFail = { ok: false; status: number; error: string; needsConfirm?: boolean; conflicts?: { kind: string; text: string; sharedStudents: number }[] };
const fail = (status: number, error: string): ChangeFail => ({ ok: false, status, error });

const toChange = (r: {
  id: string; scheduleId: string; courseId: string; dateKey: string; kind: string; newDateKey: string | null; newStartTime: string | null;
  newEndTime: string | null; reason: string | null; zaloOpenedAt: Date | null;
}): SessionChange => ({
  id: r.id, scheduleId: r.scheduleId, courseId: r.courseId, dateKey: r.dateKey, kind: r.kind === "cancel" ? "cancel" : "move",
  newDateKey: r.newDateKey, newStartTime: r.newStartTime, newEndTime: r.newEndTime, reason: r.reason, zaloOpenedAt: r.zaloOpenedAt,
});

/** Các thay đổi có ngày GỐC hoặc ngày MỚI nằm trong [fromKey, toKey] của các khung giờ đã cho. */
export async function loadChanges(db: Db, scheduleIds: string[], fromKey: string, toKey: string): Promise<SessionChange[]> {
  if (scheduleIds.length === 0) return [];
  const rows = await db.classSessionChange.findMany({
    where: { scheduleId: { in: scheduleIds }, OR: [{ dateKey: { gte: fromKey, lte: toKey } }, { newDateKey: { gte: fromKey, lte: toKey } }] },
  });
  return rows.map(toChange);
}

export async function findChange(db: Db, scheduleId: string, dateKey: string): Promise<SessionChange | null> {
  const r = await db.classSessionChange.findUnique({ where: { scheduleId_dateKey: { scheduleId, dateKey } } });
  return r ? toChange(r) : null;
}

async function lockSchedule(tx: Tx, scheduleId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`session-change:${scheduleId}`}))`;
}

const SCHEDULE_SELECT = {
  id: true, courseId: true, dayOfWeek: true, startTime: true, endTime: true, active: true,
  course: { select: { id: true, name: true, ownerId: true, zaloGroupUrl: true } },
} as const;

export interface ChangeOutcome {
  ok: true;
  change: { id: string; kind: ChangeKind; dateKey: string; newDateKey: string | null; newStartTime: string | null; newEndTime: string | null; reason: string | null };
  /** Tin soạn sẵn cho cả lớp — gia sư sửa được, KiN không gửi giúp. */
  message: string;
  zaloGroupUrl: string | null;
  /** Số báo nghỉ đang chờ đã chuyển thành "voided" (chỉ khi huỷ). */
  absencesVoided: number;
  /** Số báo nghỉ ĐÃ xử lý (đã giữ buổi bù hoặc tính phí) — KiN không tự thu hồi, gia sư cần xem lại. */
  absencesKept: number;
  notified: number;
}

export async function changeSession(i: { tutorId: string; scheduleId: string; dateKey: string; body: unknown; now?: Date }): Promise<ChangeOutcome | ChangeFail> {
  const now = i.now ?? new Date();
  const sched = await prisma.classSchedule.findUnique({ where: { id: i.scheduleId }, select: SCHEDULE_SELECT });
  if (!sched || !sched.active || sched.course.ownerId !== i.tutorId) return fail(404, "Không tìm thấy buổi học của bạn");
  const parsed = parseChangeInput(i.body, { rule: sched, dateKey: i.dateKey, now });
  if (!parsed.ok) return fail(400, parsed.error);
  const v = parsed.value;

  // LI-10: kiểm xung đột khi DỜI — chỉ khi gọi xin kiểm (checkConflicts) và chưa chọn "vẫn dời" (force). Gọi cũ không đổi hành vi.
  const asObj = (i.body ?? {}) as Record<string, unknown>;
  if (v.kind === "move" && asObj.checkConflicts === true && asObj.force !== true && v.newDateKey && v.newStartTime && v.newEndTime) {
    const { conflictsForSlot } = await import("@/lib/sessionBookServer"); // nạp muộn: sessionBookServer cũng đọc loadChanges của tệp này
    const found = await conflictsForSlot(i.tutorId, { courseId: sched.courseId, dateKey: v.newDateKey, startTime: v.newStartTime, endTime: v.newEndTime, ignoreKey: `${i.scheduleId}:${i.dateKey}` });
    if (found.length) {
      return { ...fail(409, "Giờ mới trùng lịch. Kiểm tra lại hoặc chọn vẫn dời."), needsConfirm: true, conflicts: found.map(c => ({ kind: c.kind, text: conflictText(c), sharedStudents: c.sharedStudents })) };
    }
  }

  const res = await prisma.$transaction(async (tx): Promise<{ ok: true; id: string; voided: number; kept: number; wasCancel: boolean } | ChangeFail> => {
    await lockSchedule(tx, i.scheduleId);
    const prev = await tx.classSessionChange.findUnique({ where: { scheduleId_dateKey: { scheduleId: i.scheduleId, dateKey: i.dateKey } }, select: { kind: true } });
    if (v.kind === "move") {
      const clash = await tx.classSessionChange.findFirst({
        where: { scheduleId: i.scheduleId, kind: "move", newDateKey: v.newDateKey, NOT: { dateKey: i.dateKey } }, select: { dateKey: true },
      });
      if (clash) return fail(409, "Đã có một buổi khác của khung giờ này được dời tới ngày đó");
    }
    const data = {
      courseId: sched.courseId, kind: v.kind, newDateKey: v.newDateKey, newStartTime: v.newStartTime, newEndTime: v.newEndTime,
      reason: v.reason, changedBy: i.tutorId, zaloOpenedAt: null,
    };
    const row = await tx.classSessionChange.upsert({
      where: { scheduleId_dateKey: { scheduleId: i.scheduleId, dateKey: i.dateKey } },
      create: { scheduleId: i.scheduleId, dateKey: i.dateKey, ...data },
      update: data,
    });

    let voided = 0;
    if (v.kind === "cancel") {
      voided = (await tx.classAbsence.updateMany({
        where: { scheduleId: i.scheduleId, dateKey: i.dateKey, status: "pending" },
        data: { status: "voided", resolvedAt: now, resolvedBy: i.tutorId },
      })).count;
    } else {
      if (prev?.kind === "cancel") await reopenVoided(tx, i.scheduleId, i.dateKey);
      await tx.classReminderLog.deleteMany({ where: { scheduleId: i.scheduleId, dateKey: i.dateKey } });
    }
    const kept = await tx.classAbsence.count({
      where: { scheduleId: i.scheduleId, dateKey: i.dateKey, status: v.kind === "cancel" ? { in: ["excused_auto", "excused_free", "charged"] } : { not: "voided" } },
    });
    return { ok: true, id: row.id, voided, kept, wasCancel: prev?.kind === "cancel" };
  });
  if (!res.ok) return res;

  const slot = effectiveSlot(sched, i.dateKey, { scheduleId: i.scheduleId, dateKey: i.dateKey, kind: v.kind, newDateKey: v.newDateKey, newStartTime: v.newStartTime, newEndTime: v.newEndTime, reason: v.reason })!;
  const originalStartAt = slot.movedFrom?.startAt ?? slot.startAt;
  const newStartAt = v.kind === "move" ? slot.startAt : null;
  const tutor = await prisma.user.findUnique({ where: { id: i.tutorId }, select: { name: true } });
  const message = sessionChangeMessage({ kind: v.kind, subject: sched.course.name, originalStartAt, newStartAt, reason: v.reason, tutorName: tutor?.name });

  // Thông báo trong ứng dụng cho học viên đang học lớp: phụ trợ — lỗi không làm hỏng việc đã ghi.
  const students = await prisma.enrollment.findMany({ where: { courseId: sched.courseId, status: "active" }, select: { userId: true } });
  await notifyMany(students.map(s => s.userId), {
    type: "class_changed", title: "Buổi học đổi lịch",
    message: `Lớp "${sched.course.name}": ${describeChange({ kind: v.kind, originalStartAt, newStartAt })}.${v.reason ? ` Lý do: ${v.reason}.` : ""}`,
    link: "/student/lich-hoc",
  });
  await logAction(i.tutorId, v.kind === "cancel" ? "class_session.cancel" : "class_session.move", "ClassSessionChange", res.id,
    { courseId: sched.courseId, scheduleId: i.scheduleId, dateKey: i.dateKey, newDateKey: v.newDateKey, newStartTime: v.newStartTime }).catch(() => {});

  return {
    ok: true,
    change: { id: res.id, kind: v.kind, dateKey: i.dateKey, newDateKey: v.newDateKey, newStartTime: v.newStartTime, newEndTime: v.newEndTime, reason: v.reason },
    message, zaloGroupUrl: sched.course.zaloGroupUrl, absencesVoided: res.voided, absencesKept: res.kept, notified: students.length,
  };
}

async function reopenVoided(tx: Tx, scheduleId: string, dateKey: string) {
  await tx.classAbsence.updateMany({
    where: { scheduleId, dateKey, status: "voided" },
    data: { status: "pending", resolvedAt: null, resolvedBy: null },
  });
}

export interface RestoreOutcome { ok: true; message: string; zaloGroupUrl: string | null; reopened: number; notified: number }

/** Bỏ thay đổi, buổi trở về lịch tuần. Chỉ khi GIỜ GỐC còn ở tương lai (nếu không thì không còn gì để khôi phục). */
export async function restoreSession(i: { tutorId: string; scheduleId: string; dateKey: string; now?: Date }): Promise<RestoreOutcome | ChangeFail> {
  const now = i.now ?? new Date();
  const sched = await prisma.classSchedule.findUnique({ where: { id: i.scheduleId }, select: SCHEDULE_SELECT });
  if (!sched || sched.course.ownerId !== i.tutorId) return fail(404, "Không tìm thấy buổi học của bạn");
  const s = parseHm(sched.startTime);
  if (s === null) return fail(400, "Giờ học của khung này chưa đặt đúng");
  const originalStartAt = instantOf(i.dateKey, s);
  if (originalStartAt.getTime() <= now.getTime()) return fail(409, "Giờ gốc của buổi này đã qua, không khôi phục được");

  const res = await prisma.$transaction(async (tx): Promise<{ ok: true; id: string; kind: string; reopened: number } | ChangeFail> => {
    await lockSchedule(tx, i.scheduleId);
    const cur = await tx.classSessionChange.findUnique({ where: { scheduleId_dateKey: { scheduleId: i.scheduleId, dateKey: i.dateKey } }, select: { id: true, kind: true } });
    if (!cur) return fail(404, "Buổi này chưa bị dời hay huỷ");
    await tx.classSessionChange.delete({ where: { id: cur.id } });
    let reopened = 0;
    if (cur.kind === "cancel") reopened = (await tx.classAbsence.updateMany({ where: { scheduleId: i.scheduleId, dateKey: i.dateKey, status: "voided" }, data: { status: "pending", resolvedAt: null, resolvedBy: null } })).count;
    else await tx.classReminderLog.deleteMany({ where: { scheduleId: i.scheduleId, dateKey: i.dateKey } });
    return { ok: true, id: cur.id, kind: cur.kind, reopened };
  });
  if (!res.ok) return res;

  const tutor = await prisma.user.findUnique({ where: { id: i.tutorId }, select: { name: true } });
  const message = sessionRestoredMessage({ subject: sched.course.name, originalStartAt, tutorName: tutor?.name });
  const students = await prisma.enrollment.findMany({ where: { courseId: sched.courseId, status: "active" }, select: { userId: true } });
  await notifyMany(students.map(s2 => s2.userId), {
    type: "class_changed", title: "Buổi học giữ nguyên lịch",
    message: `Lớp "${sched.course.name}": buổi ${whenText(originalStartAt)} giữ nguyên lịch như cũ.`,
    link: "/student/lich-hoc",
  });
  await logAction(i.tutorId, "class_session.restore", "ClassSessionChange", res.id, { courseId: sched.courseId, scheduleId: i.scheduleId, dateKey: i.dateKey, was: res.kind }).catch(() => {});
  return { ok: true, message, zaloGroupUrl: sched.course.zaloGroupUrl, reopened: res.reopened, notified: students.length };
}

/** Ghi nhận gia sư ĐÃ MỞ Zalo để báo lớp. Idempotent: giữ lần đầu. KiN không biết tin có đi thật hay không. */
export async function markChangeZaloOpened(i: { tutorId: string; changeId: string }): Promise<{ ok: true; openedAt: string } | ChangeFail> {
  const ch = await prisma.classSessionChange.findUnique({ where: { id: i.changeId }, select: { id: true, zaloOpenedAt: true, course: { select: { ownerId: true } } } });
  if (!ch || ch.course.ownerId !== i.tutorId) return fail(404, "Không tìm thấy thay đổi này");
  if (ch.zaloOpenedAt) return { ok: true, openedAt: ch.zaloOpenedAt.toISOString() };
  const r = await prisma.classSessionChange.update({ where: { id: ch.id }, data: { zaloOpenedAt: new Date() }, select: { zaloOpenedAt: true } });
  return { ok: true, openedAt: r.zaloOpenedAt!.toISOString() };
}
