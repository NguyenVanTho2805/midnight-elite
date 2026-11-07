// TUT-dong-giang — mời / chấp nhận / từ chối / gỡ / rời / đổi vai đồng giảng + bộ đọc. Quy tắc thuần ở courseAccess.ts. Mọi chuyển trạng thái dùng updateMany CÓ ĐIỀU KIỆN trạng thái
// (hai tab bấm cùng lúc chỉ một thắng). Thông báo: không tên người, không email, không tiền (chỉ tên lớp). KHÔNG chạm feeCharge* / invoiceServer* / sessionBook*.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { logAction } from "@/lib/auditLog";
import { notify } from "@/lib/notify";
import { vnDateKeyOf } from "@/lib/classSessions";
import {
  INVITE_REPLY, MAX_TEACHERS_PER_COURSE, TEACHER_NOTIFY_TYPES, canBeInvitedAsTeacher, isCoTeacherUsable,
  type TeacherRole, type TeacherStatus,
} from "@/lib/courseAccess";
import { loadUnmarkedSessionsAsCoTeacher } from "@/lib/unmarkedServer";

type Tx = Prisma.TransactionClient;
const USER_FLAGS = { role: true, adminRole: true, tutorVerified: true, banned: true, deletedAt: true } as const;

export const TEACHER_HOME_LINK = "/lop-cua-toi/dong-giang";
const courseLink = (id: string) => `/lop-cua-toi/${id}`;
const teacherTabLink = (id: string) => `/lop-cua-toi/${id}?tab=giao-vien`;

// ── Mời ─────────────────────────────────────────────────────────────────────────────────────────

export type InviteOutcome =
  | { ok: true; reply: string }
  | { ok: false; status: 409; code: "TEACHER_LIMIT" | "ALREADY_IN_COURSE"; error: string };

/** Chủ lớp (hoặc quản trị) mời theo email. MỌI trường hợp hợp lệ về hình thức trả cùng một câu (không lộ email có tồn tại hay không); chỉ tạo dòng khi người đó
 *  là gia sư đã duyệt, không khoá / xoá, KHÔNG phải học viên của lớp (Enrollment bất kỳ trạng thái) và chưa ở trong lớp. Người gọi đã kiểm quyền `teacher.invite`. */
export async function inviteCoTeacher(
  course: { id: string; name: string; ownerId: string | null },
  inviter: { userId: string },
  i: { email: string; role: TeacherRole; subjects: string[] },
): Promise<InviteOutcome> {
  type Inner = { outcome: "limit" } | { outcome: "self" } | { outcome: "skip" } | { outcome: "sent"; ctId: string; targetId: string };
  const res = await prisma.$transaction(async (tx): Promise<Inner> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`course_teacher:${course.id}`}))`;
    const taken = await tx.courseTeacher.count({ where: { courseId: course.id, status: { in: ["active", "invited"] } } });
    if (taken >= MAX_TEACHERS_PER_COURSE) return { outcome: "limit" };

    const target = await tx.user.findFirst({ where: { email: { equals: i.email, mode: "insensitive" } }, select: { id: true, ...USER_FLAGS } });
    if (!target) return { outcome: "skip" };
    if (target.id === inviter.userId) return { outcome: "self" }; // chính người gọi: không lộ gì về người khác
    if (target.id === course.ownerId) return { outcome: "skip" }; // quản trị mời CHỦ lớp: cùng câu chung, không phân biệt với email lạ (chống dò)
    if (!canBeInvitedAsTeacher(target)) return { outcome: "skip" }; // chờ duyệt / học sinh / khoá / đã xoá: cùng câu trả lời
    const isStudent = await tx.enrollment.findUnique({ where: { userId_courseId: { userId: target.id, courseId: course.id } }, select: { id: true } });
    if (isStudent) return { outcome: "skip" }; // is_student_of_course: không tạo dòng

    const cur = await tx.courseTeacher.findUnique({ where: { courseId_userId: { courseId: course.id, userId: target.id } }, select: { id: true, status: true } });
    if (cur && (cur.status === "invited" || cur.status === "active")) return { outcome: "skip" };
    const data = { role: i.role, subjects: i.subjects, status: "invited", invitedBy: inviter.userId, respondedAt: null, removedAt: null, removedBy: null };
    const row = cur
      ? await tx.courseTeacher.update({ where: { id: cur.id }, data })
      : await tx.courseTeacher.create({ data: { courseId: course.id, userId: target.id, ...data } });
    return { outcome: "sent", ctId: row.id, targetId: target.id };
  });

  if (res.outcome === "limit") return { ok: false, status: 409, code: "TEACHER_LIMIT", error: `Mỗi lớp tối đa ${MAX_TEACHERS_PER_COURSE} giáo viên cùng dạy` };
  if (res.outcome === "self") return { ok: false, status: 409, code: "ALREADY_IN_COURSE", error: "Bạn đã là chủ nhiệm của lớp này" };
  if (res.outcome === "sent") {
    await logAction(inviter.userId, "course_teacher.invite", "CourseTeacher", res.ctId, { courseId: course.id, role: i.role }); // không ghi email
    await notify(res.targetId, {
      type: TEACHER_NOTIFY_TYPES.invited, title: "Có lời mời đồng giảng", message: `Bạn được mời cùng dạy lớp «${course.name}».`, link: TEACHER_HOME_LINK,
    });
  } else {
    await logAction(inviter.userId, "course_teacher.invite_noop", "Course", course.id, { role: i.role });
  }
  return { ok: true, reply: INVITE_REPLY };
}

// ── Người được mời: chấp nhận / từ chối ─────────────────────────────────────────────────────────

export type RespondOutcome =
  | { ok: true }
  | { ok: false; status: 403 | 404 | 409; code: string; error: string };

const NOT_FOUND: RespondOutcome = { ok: false, status: 404, code: "NOT_FOUND", error: "Không tìm thấy lời mời" };

/** `ctId` phải thuộc CHÍNH người gọi (IDOR: của người khác ⇒ 404, như không có). */
async function loadOwnRow(ctId: string, userId: string) {
  const row = await prisma.courseTeacher.findUnique({
    where: { id: ctId },
    select: { id: true, courseId: true, userId: true, status: true, role: true, course: { select: { id: true, name: true, ownerId: true, classStatus: true } }, user: { select: USER_FLAGS } },
  });
  return row && row.userId === userId ? row : null;
}

export async function acceptInvitation(ctId: string, userId: string): Promise<RespondOutcome> {
  const row = await loadOwnRow(ctId, userId);
  if (!row) return NOT_FOUND;
  if (!canBeInvitedAsTeacher(row.user)) return { ok: false, status: 403, code: "NOT_TUTOR", error: "Chỉ gia sư đã duyệt mới nhận lời đồng giảng" };
  if (row.status !== "invited") return { ok: false, status: 409, code: "ALREADY_RESPONDED", error: "Lời mời đã được xử lý" };
  if (row.course.classStatus === "closed") return { ok: false, status: 409, code: "COURSE_CLOSED", error: "Lớp đã đóng" };

  const res = await prisma.$transaction(async (tx): Promise<RespondOutcome> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`course_teacher:${row.courseId}`}))`;
    const isStudent = await tx.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: row.courseId } }, select: { id: true } });
    if (isStudent) return { ok: false, status: 409, code: "is_student_of_course", error: "Bạn đang là học viên của lớp này" };
    const n = await tx.courseTeacher.updateMany({ where: { id: ctId, userId, status: "invited" }, data: { status: "active", respondedAt: new Date() } });
    if (n.count === 0) return { ok: false, status: 409, code: "ALREADY_RESPONDED", error: "Lời mời đã được xử lý" };
    return { ok: true };
  });
  if (!res.ok) return res;
  await logAction(userId, "course_teacher.accept", "CourseTeacher", ctId, { courseId: row.courseId });
  if (row.course.ownerId) {
    await notify(row.course.ownerId, {
      type: TEACHER_NOTIFY_TYPES.accepted, title: "Đã có giáo viên nhận lời", message: `Một giáo viên đã nhận lời đồng giảng lớp «${row.course.name}».`, link: teacherTabLink(row.courseId),
    });
  }
  return { ok: true };
}

export async function declineInvitation(ctId: string, userId: string): Promise<RespondOutcome> {
  const row = await loadOwnRow(ctId, userId);
  if (!row) return NOT_FOUND;
  if (!canBeInvitedAsTeacher(row.user)) return { ok: false, status: 403, code: "NOT_TUTOR", error: "Chỉ gia sư đã duyệt mới trả lời lời mời đồng giảng" };
  const n = await prisma.courseTeacher.updateMany({ where: { id: ctId, userId, status: "invited" }, data: { status: "declined", respondedAt: new Date() } });
  if (n.count === 0) return { ok: false, status: 409, code: "ALREADY_RESPONDED", error: "Lời mời đã được xử lý" };
  await logAction(userId, "course_teacher.decline", "CourseTeacher", ctId, { courseId: row.courseId });
  if (row.course.ownerId) {
    await notify(row.course.ownerId, {
      type: TEACHER_NOTIFY_TYPES.declined, title: "Một lời mời đồng giảng bị từ chối", message: `Một lời mời đồng giảng lớp «${row.course.name}» đã bị từ chối.`, link: teacherTabLink(row.courseId),
    });
  }
  return { ok: true };
}

// ── Gỡ / rời / đổi vai ──────────────────────────────────────────────────────────────────────────

export interface RemoveResult { ok: true; reassignedSchedules: number; reassignedChapters: number; previewOnly?: boolean }

/** Đặt lại khung lịch / nhóm giáo trình của `userId` trong lớp về chủ (null). KHÔNG đụng buổi, điểm danh, bài đã có (taughtBy giữ nguyên id người đã dạy). */
async function releaseAssignments(tx: Tx, courseId: string, userId: string, preview: boolean): Promise<{ s: number; c: number }> {
  if (preview) {
    const [s, c] = await Promise.all([
      tx.classSchedule.count({ where: { courseId, teacherId: userId } }),
      tx.chapter.count({ where: { section: { is: { courseId } }, teacherId: userId } }),
    ]);
    return { s, c };
  }
  const [s, c] = await Promise.all([
    tx.classSchedule.updateMany({ where: { courseId, teacherId: userId }, data: { teacherId: null } }),
    tx.chapter.updateMany({ where: { section: { is: { courseId } }, teacherId: userId }, data: { teacherId: null } }),
  ]);
  return { s: s.count, c: c.count };
}

/** Chủ gỡ (active) hoặc huỷ lời mời (invited). `ctId` phải thuộc `courseId` ⇒ nếu không, 404. `preview` chỉ đếm, không ghi gì. */
export async function removeCoTeacherByOwner(
  course: { id: string; name: string }, ctId: string, ownerUserId: string, preview = false,
): Promise<RemoveResult | { ok: false; status: 404 | 409; error: string }> {
  const row = await prisma.courseTeacher.findUnique({ where: { id: ctId }, select: { id: true, courseId: true, userId: true, status: true } });
  if (!row || row.courseId !== course.id) return { ok: false, status: 404, error: "Không tìm thấy giáo viên trong lớp này" };
  if (row.status !== "invited" && row.status !== "active") return { ok: false, status: 409, error: "Giáo viên này không còn trong lớp" };
  const wasActive = row.status === "active";
  const out = await prisma.$transaction(async (tx) => {
    if (preview) return { n: await releaseAssignments(tx, course.id, row.userId, true), changed: true };
    const n = await tx.courseTeacher.updateMany({ where: { id: ctId, courseId: course.id, status: row.status }, data: { status: "removed", removedAt: new Date(), removedBy: ownerUserId } });
    if (n.count === 0) return null;
    return { n: wasActive ? await releaseAssignments(tx, course.id, row.userId, false) : { s: 0, c: 0 }, changed: true };
  });
  if (!out) return { ok: false, status: 409, error: "Giáo viên này không còn trong lớp" };
  if (preview) return { ok: true, reassignedSchedules: out.n.s, reassignedChapters: out.n.c, previewOnly: true };
  await logAction(ownerUserId, wasActive ? "course_teacher.remove" : "course_teacher.cancel_invite", "CourseTeacher", ctId, { courseId: course.id });
  if (wasActive) {
    await notify(row.userId, {
      type: TEACHER_NOTIFY_TYPES.removed, title: `Bạn không còn đồng giảng lớp «${course.name}»`, message: `Bạn không còn đồng giảng lớp «${course.name}».`, link: TEACHER_HOME_LINK,
    });
  }
  return { ok: true, reassignedSchedules: out.n.s, reassignedChapters: out.n.c };
}

/** Đồng giảng tự rời lớp (active → removed, removedBy = chính mình). */
export async function leaveCourse(ctId: string, userId: string): Promise<RemoveResult | RespondOutcome> {
  const row = await loadOwnRow(ctId, userId);
  if (!row) return NOT_FOUND;
  const out = await prisma.$transaction(async (tx) => {
    const n = await tx.courseTeacher.updateMany({ where: { id: ctId, userId, status: "active" }, data: { status: "removed", removedAt: new Date(), removedBy: userId } });
    if (n.count === 0) return null;
    return releaseAssignments(tx, row.courseId, userId, false);
  });
  if (!out) return { ok: false, status: 409, code: "NOT_ACTIVE", error: "Bạn không còn đồng giảng lớp này" };
  await logAction(userId, "course_teacher.leave", "CourseTeacher", ctId, { courseId: row.courseId });
  if (row.course.ownerId) {
    await notify(row.course.ownerId, {
      type: TEACHER_NOTIFY_TYPES.left, title: `Một giáo viên đã rời lớp «${row.course.name}»`, message: `Một giáo viên đã rời lớp «${row.course.name}».`, link: teacherTabLink(row.courseId),
    });
  }
  return { ok: true, reassignedSchedules: out.s, reassignedChapters: out.c };
}

/** Chủ đổi vai / nhãn môn (chỉ khi `active`). Hạ co_teacher → subject_teacher KHÔNG xoá nhóm đã gán. */
export async function changeTeacherRole(
  course: { id: string; name: string }, ctId: string, actorId: string, patch: { role?: TeacherRole; subjects?: string[] },
): Promise<{ ok: true } | { ok: false; status: 404 | 409; error: string }> {
  const row = await prisma.courseTeacher.findUnique({ where: { id: ctId }, select: { id: true, courseId: true, userId: true, status: true, role: true } });
  if (!row || row.courseId !== course.id) return { ok: false, status: 404, error: "Không tìm thấy giáo viên trong lớp này" };
  const data: Prisma.CourseTeacherUpdateManyMutationInput = {};
  if (patch.role) data.role = patch.role;
  if (patch.subjects) data.subjects = patch.subjects;
  const n = await prisma.courseTeacher.updateMany({ where: { id: ctId, courseId: course.id, status: "active" }, data });
  if (n.count === 0) return { ok: false, status: 409, error: "Chỉ đổi được vai của giáo viên đang dạy trong lớp" };
  await logAction(actorId, "course_teacher.role", "CourseTeacher", ctId, { courseId: course.id, ...(patch.role ? { role: patch.role } : {}) });
  if (patch.role && patch.role !== row.role) {
    await notify(row.userId, {
      type: TEACHER_NOTIFY_TYPES.roleChanged, title: `Vai của bạn trong lớp «${course.name}» đã đổi`, message: `Vai của bạn trong lớp «${course.name}» đã được cập nhật.`, link: courseLink(course.id),
    });
  }
  return { ok: true };
}

// ── Bộ đọc ──────────────────────────────────────────────────────────────────────────────────────

export interface TeacherListItem { id: string; userId?: string; role: string; subjects: string[]; status: TeacherStatus; since: string; name?: string; email?: string }

/** Danh sách giáo viên của lớp. `name` chỉ khi `active`. `email` chỉ owner/admin. Đồng giảng / bộ môn chỉ thấy người đang `active` (không thấy lời mời chờ, từ chối, đã gỡ). */
export async function listCourseTeachers(courseId: string, viewer: { isManager: boolean }): Promise<TeacherListItem[]> {
  const rows = await prisma.courseTeacher.findMany({
    where: { courseId, status: viewer.isManager ? { in: ["invited", "active", "declined"] } : "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, role: true, subjects: true, status: true, createdAt: true, respondedAt: true, user: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id, role: r.role, subjects: r.subjects, status: r.status as TeacherStatus, since: (r.respondedAt ?? r.createdAt).toISOString(),
    ...(r.status === "active" ? { name: r.user.name } : {}),
    ...(viewer.isManager ? { email: r.user.email, userId: r.userId } : {}),   // userId chỉ chủ/admin (đồng giảng/bộ môn không thấy id người khác)
  }));
}

export interface MyCoTeaching {
  invitations: { id: string; courseName: string; role: string; subjects: string[]; sentOn: string }[];
  courses: { id: string; courseId: string; courseName: string; role: string; subjects: string[]; nextSession?: { dateKey: string; startTime: string }; unmarkedCount: number }[];
}

/** Lời mời gửi cho tôi + lớp tôi đang đồng giảng. Không tên chủ lớp, không tiền, không tên học sinh. Người không còn là gia sư usable ⇒ rỗng. */
export async function loadMyCoTeaching(userId: string, now: Date = new Date()): Promise<MyCoTeaching> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: USER_FLAGS });
  if (!me || !canBeInvitedAsTeacher(me)) return { invitations: [], courses: [] };
  const rows = await prisma.courseTeacher.findMany({
    where: { userId, status: { in: ["invited", "active"] }, course: { classStatus: { not: "closed" } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, courseId: true, role: true, subjects: true, status: true, createdAt: true, course: { select: { name: true } } },
  });
  const invitations = rows.filter(r => r.status === "invited").map(r => ({ id: r.id, courseName: r.course.name, role: r.role, subjects: r.subjects, sentOn: r.createdAt.toISOString() }));
  const active = rows.filter(r => r.status === "active");
  const unmarked = active.length ? await loadUnmarkedSessionsAsCoTeacher(userId, now) : [];
  const today = vnDateKeyOf(now);
  const schedules = active.length
    ? await prisma.classSchedule.findMany({ where: { courseId: { in: active.map(r => r.courseId) }, teacherId: userId, active: true }, select: { courseId: true, dayOfWeek: true, startTime: true } })
    : [];
  const courses = active.map((r) => {
    const mine = schedules.filter(s => s.courseId === r.courseId);
    let next: { dateKey: string; startTime: string } | undefined;
    for (let d = 0; d < 8 && !next; d++) {
      const key = new Date(Date.parse(`${today}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
      const dow = new Date(`${key}T00:00:00Z`).getUTCDay();
      const hit = mine.filter(s => s.dayOfWeek === dow).sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
      if (hit) next = { dateKey: key, startTime: hit.startTime };
    }
    return {
      id: r.id, courseId: r.courseId, courseName: r.course.name, role: r.role, subjects: r.subjects,
      ...(next ? { nextSession: next } : {}), unmarkedCount: unmarked.filter(u => u.courseId === r.courseId).length,
    };
  });
  return { invitations, courses };
}

// ── Đề nghị chốt buổi (chỉ thông báo; KHÔNG ghi AttendanceSession / bảng phí) ────────────────────

/** Gửi `session_close_request` cho chủ lớp. Còn thông báo CHƯA ĐỌC cùng link thì không tạo thêm. Trả true nếu đã tạo mới. */
export async function requestSessionClose(
  course: { id: string; name: string; ownerId: string | null }, dateKey: string, requesterId: string,
): Promise<boolean> {
  if (!course.ownerId) return false;
  const link = `/lop-cua-toi/buoi/${course.id}/${dateKey}`;
  const dd = `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
  const exists = await prisma.notification.findFirst({ where: { userId: course.ownerId, type: TEACHER_NOTIFY_TYPES.closeRequest, link, isRead: false }, select: { id: true } });
  await logAction(requesterId, "attendance_session.request_close", "Course", course.id, { dateKey });
  if (exists) return false;
  await notify(course.ownerId, {
    type: TEACHER_NOTIFY_TYPES.closeRequest, title: `Buổi ngày ${dd} của lớp «${course.name}» chờ bạn chốt`, message: `Buổi ngày ${dd} của lớp «${course.name}» chờ bạn chốt.`, link,
  });
  return true;
}

export { isCoTeacherUsable };
