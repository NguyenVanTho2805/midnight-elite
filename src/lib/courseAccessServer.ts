// TUT-dong-giang — phần MÁY CHỦ của quyền trong lớp (quy tắc thuần ở src/lib/courseAccess.ts). Thay cho `authorizeCourse` / `own` ở các route dòng M của bảng 3.1;
// KHÔNG sửa sessionBookServer.ts (tệp khoá, chạm tiền). Route dòng G/T giữ nguyên `ownsResource` ⇒ đồng giảng tự ngã 403 (mặc định từ chối).
// Thứ tự trả lời (mục 6): 401 chưa đăng nhập → 403 khoá → 403 không phải gia sư đã duyệt → 404 lớp không có → 403 người lạ → 403 ROLE_FORBIDDEN.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionChecked, type SessionPayload } from "@/lib/session";
import {
  canDo, canMarkSession, canEditChapter as canEditChapterRole, canEditAssignment, canGradeAssignment, studentNamesVisible, effectiveSessionTeacher, isCoTeacherUsable, redactCourseForRole, ROLE_LABEL, ROLE_FORBIDDEN_MESSAGE, NOT_IN_COURSE_MESSAGE,
  type CourseAction, type CourseRole, type MarkDenied, type TeacherRole,
} from "@/lib/courseAccess";

export type AccessCourse = { id: string; name: string; ownerId: string | null; feeMode: string; classStatus: string };
export type CourseAccess =
  | { ok: true; role: Exclude<CourseRole, "none">; session: SessionPayload; course: AccessCourse; ctId: string | null }
  | { ok: false; res: NextResponse };

const NO_STORE = { "Cache-Control": "no-store" };
/** Id từ URL mà Postgres không nhận được (byte NUL làm driver ném lỗi 22021 ⇒ 500). Coi như "không có" ⇒ 404, không chạm DB. */
export function unusableId(id: unknown): boolean {
  return typeof id !== "string" || id.length === 0 || id.length > 200 || id.includes("\u0000");
}
function isInvalidTextError(e: unknown): boolean {
  const x = e as { code?: string; cause?: { code?: string; originalCode?: string } } | null;
  return x?.code === "22021" || x?.cause?.code === "22021" || x?.cause?.originalCode === "22021";
}
const BANNED_MSG = "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin để được hỗ trợ.";

export function roleForbidden(): NextResponse {
  return NextResponse.json({ error: ROLE_FORBIDDEN_MESSAGE, code: "ROLE_FORBIDDEN" }, { status: 403, headers: NO_STORE });
}
export function markDeniedResponse(d: MarkDenied): NextResponse {
  if (d.code === "SESSION_CLOSED_OWNER_ONLY") {
    return NextResponse.json({ error: "Buổi đã chốt, nhờ chủ lớp mở lại nếu cần sửa", code: d.code }, { status: 409, headers: NO_STORE });
  }
  if (d.code === "NOT_YOUR_SESSION") return NextResponse.json({ error: "Buổi này không phải buổi bạn dạy", code: d.code }, { status: 403, headers: NO_STORE });
  return roleForbidden();
}

/** Phiên đã kiểm khoá. Chưa đăng nhập 401; bị khoá 403; không phải gia sư đã duyệt / quản trị cấp 1-nội dung ⇒ 403. */
async function sessionOrDeny(): Promise<{ session: SessionPayload } | { res: NextResponse }> {
  const { session, denied } = await getSessionChecked();
  if (denied === "banned") return { res: NextResponse.json({ error: BANNED_MSG }, { status: 403, headers: NO_STORE }) };
  if (!session) return { res: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401, headers: NO_STORE }) };
  return { session };
}

/** Vai của `session` trong lớp `courseId`. Đọc LẠI User từ DB cho đồng giảng (không tin JWT): khoá / xoá / hạ vai ⇒ mất quyền ngay. */
export async function loadCourseAccess(session: SessionPayload | null, courseId: string): Promise<CourseAccess> {
  if (!session) return { ok: false, res: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401, headers: NO_STORE }) };
  const isCenter = session.role === "admin" && (session.adminRole === "admin_super" || session.adminRole === "admin_content");
  const isTutor = session.role === "admin" && session.adminRole === "teacher";
  if (!isCenter && !isTutor) return { ok: false, res: NextResponse.json({ error: "Chỉ gia sư mới dùng chức năng này" }, { status: 403, headers: NO_STORE }) };

  if (unusableId(courseId)) return { ok: false, res: NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404, headers: NO_STORE }) };
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, ownerId: true, feeMode: true, classStatus: true } });
  if (!course) return { ok: false, res: NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404, headers: NO_STORE }) };

  if (isCenter) return { ok: true, role: "admin", session, course, ctId: null };
  if (course.ownerId && course.ownerId === session.userId) return { ok: true, role: "owner", session, course, ctId: null };

  const row = await prisma.courseTeacher.findUnique({
    where: { courseId_userId: { courseId, userId: session.userId } },
    select: { id: true, role: true, status: true, user: { select: { role: true, adminRole: true, tutorVerified: true, banned: true, deletedAt: true } } },
  });
  if (row && isCoTeacherUsable(row, row.user) && (row.role === "co_teacher" || row.role === "subject_teacher")) {
    return { ok: true, role: row.role, session, course, ctId: row.id };
  }
  return { ok: false, res: NextResponse.json({ error: NOT_IN_COURSE_MESSAGE }, { status: 403, headers: NO_STORE }) };
}

/** Đọc phiên rồi `loadCourseAccess`; có `action` thì thêm bước `canDo` (thiếu ⇒ 403 ROLE_FORBIDDEN). */
export async function requireCourseAccess(courseId: string, action?: CourseAction): Promise<CourseAccess> {
  const s = await sessionOrDeny();
  if ("res" in s) return { ok: false, res: s.res };
  const acc = await loadCourseAccess(s.session, courseId);
  if (!acc.ok) return acc;
  if (action && !canDo(acc.role, action)) return { ok: false, res: roleForbidden() };
  return acc;
}

/** Đường cho trang (server component): cùng luật nhưng không trả NextResponse; null = không có quyền / không có lớp (trang rẽ notFound()). */
export async function courseRoleForPage(session: SessionPayload | null, courseId: string): Promise<{ role: Exclude<CourseRole, "none">; ctId: string | null } | null> {
  const acc = await loadCourseAccess(session, courseId);
  return acc.ok ? { role: acc.role, ctId: acc.ctId } : null;
}

/** Lớp dành cho tut-dev: bản đã lọc tiền / liên hệ theo vai. */
export async function loadCoTeacherCourseView(courseId: string, access: Extract<CourseAccess, { ok: true }>) {
  const c = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, shortTitle: true, category: true, classStatus: true, status: true, calendarColor: true, classJoinUrl: true, zaloGroupUrl: true, feeMode: true, price: true },
  });
  if (!c) return null;
  const view = redactCourseForRole(access.role, c as unknown as Record<string, unknown>);
  return { ...view, role: access.role, roleLabel: ROLE_LABEL[access.role] };
}

/** Người dạy hiệu lực của MỘT buổi (taughtBy > khung trùng thứ/giờ > chủ). `schedules` = các khung của lớp. */
export async function sessionTeacherOf(
  s: { courseId: string; date: Date; taughtBy: string | null; startTime?: string | null },
  ownerId: string | null,
): Promise<string | null> {
  if (s.taughtBy) return s.taughtBy;
  // dayOfWeek theo NGÀY VN: AttendanceSession.date là 00:00 UTC của ngày VN ⇒ getUTCDay() đúng thứ.
  const dow = s.date.getUTCDay();
  const sch = await prisma.classSchedule.findMany({ where: { courseId: s.courseId, dayOfWeek: dow, active: true }, select: { teacherId: true, startTime: true } });
  const hit = (s.startTime ? sch.find(x => x.startTime === s.startTime) : null) ?? (sch.length === 1 ? sch[0] : null);
  return effectiveSessionTeacher({ taughtBy: null, scheduleTeacherId: hit?.teacherId ?? null, ownerId });
}

/** Kiểm đồng giảng / bộ môn được điểm danh buổi (đã có hay chưa có bản ghi). Owner / admin luôn ok. */
export async function checkMarkSession(
  acc: Extract<CourseAccess, { ok: true }>,
  s: { courseId: string; date: Date; taughtBy: string | null; startTime?: string | null; state?: string | null } | null,
  dateForNew?: Date,
): Promise<NextResponse | null> {
  if (acc.role === "owner" || acc.role === "admin") return null;
  const base = s ?? { courseId: acc.course.id, date: dateForNew as Date, taughtBy: null, startTime: null, state: null };
  const teacher = await sessionTeacherOf(base, acc.course.ownerId);
  const v = canMarkSession(acc.role, acc.session.userId, teacher, base.state === "closed");
  return v.ok ? null : markDeniedResponse(v);
}

/** Gia sư đang đồng giảng (active + còn usable) ở những lớp nào. Dùng cho Hộp việc / danh sách lớp / thông báo. */
export async function activeCoTeachingRows(userId: string): Promise<{ id: string; courseId: string; role: TeacherRole; subjects: string[]; courseName: string; classStatus: string }[]> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, adminRole: true, tutorVerified: true, banned: true, deletedAt: true } });
  if (!me || !isCoTeacherUsable({ status: "active" }, me)) return [];
  const rows = await prisma.courseTeacher.findMany({
    where: { userId, status: "active" }, orderBy: { createdAt: "asc" },
    select: { id: true, courseId: true, role: true, subjects: true, course: { select: { name: true, classStatus: true } } },
  });
  return rows
    .filter(r => r.role === "co_teacher" || r.role === "subject_teacher")
    .map(r => ({ id: r.id, courseId: r.courseId, role: r.role as TeacherRole, subjects: r.subjects, courseName: r.course.name, classStatus: r.course.classStatus }));
}

/** `createdBy` của buổi mới: chủ / quản trị = chính người tạo (như cũ); đồng giảng / bộ môn = CHỦ LỚP (AttendanceSession.creator là onDelete Cascade — xoá tài khoản
 *  đồng giảng không được kéo xoá buổi, mục 4.4). Lớp không có chủ (nội dung cũ) thì dùng chính người tạo. */
export function createdByFor(acc: Extract<CourseAccess, { ok: true }>): string {
  return acc.role === "co_teacher" || acc.role === "subject_teacher" ? (acc.course.ownerId ?? acc.session.userId) : acc.session.userId;
}
/** `taughtBy` khi đồng giảng / bộ môn tạo buổi: chính họ. Chủ / quản trị: không đặt (suy từ khung rồi chủ lớp như cũ). */
export function taughtByFor(acc: Extract<CourseAccess, { ok: true }>): string | undefined {
  return acc.role === "co_teacher" || acc.role === "subject_teacher" ? acc.session.userId : undefined;
}
/** Người có quyền chỉ ĐỌC buổi của mình (co/sub) — owner / admin xem hết. */
export const isHelperRole = (role: CourseRole): boolean => role === "co_teacher" || role === "subject_teacher";

/** Giáo viên bộ môn "có gì được giao" trong lớp: buổi (taughtBy), khung lịch (teacherId) hoặc nhóm giáo trình (teacherId) — mục 4.3 điều kiện a. */
export async function hasAssignmentInCourse(courseId: string, userId: string): Promise<boolean> {
  const [s, c, g] = await Promise.all([
    prisma.attendanceSession.count({ where: { courseId, taughtBy: userId } }),
    prisma.classSchedule.count({ where: { courseId, teacherId: userId } }),
    prisma.chapter.count({ where: { teacherId: userId, section: { is: { courseId } } } }),
  ]);
  return s + c + g > 0;
}

export interface ScheduleRow { id: string; courseId: string; startTime: string; endTime: string; dayOfWeek: number; teacherId: string | null; course: { ownerId: string | null } }
/** Cho route `class-schedules/[id]`: 401/403 (khoá, không phải gia sư) → 404 khung không có → 403 người lạ của lớp chứa khung. Chưa kiểm hành động (route gọi canEditSchedule). */
export async function requireScheduleAccess(scheduleId: string): Promise<{ ok: true; acc: Extract<CourseAccess, { ok: true }>; schedule: ScheduleRow } | { ok: false; res: NextResponse }> {
  const s = await sessionOrDeny();
  if ("res" in s) return { ok: false, res: s.res };
  const isCenter = s.session.role === "admin" && (s.session.adminRole === "admin_super" || s.session.adminRole === "admin_content");
  const isTutor = s.session.role === "admin" && s.session.adminRole === "teacher";
  if (!isCenter && !isTutor) return { ok: false, res: NextResponse.json({ error: "Chỉ gia sư mới dùng chức năng này" }, { status: 403, headers: NO_STORE }) };
  if (unusableId(scheduleId)) return { ok: false, res: NextResponse.json({ error: "Không tìm thấy khung giờ học" }, { status: 404, headers: NO_STORE }) };
  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, courseId: true, startTime: true, endTime: true, dayOfWeek: true, teacherId: true, course: { select: { ownerId: true } } },
  });
  if (!schedule) return { ok: false, res: NextResponse.json({ error: "Không tìm thấy khung giờ học" }, { status: 404, headers: NO_STORE }) };
  const acc = await loadCourseAccess(s.session, schedule.courseId);
  if (!acc.ok) return acc;
  return { ok: true, acc, schedule };
}

/** Cho route `attendance-sessions/[id]`: 401/403 → 404 buổi không có → 403 người lạ của lớp. Trả cả dòng buổi (đủ để tra người dạy / trạng thái chốt). */
export async function requireAttendanceSessionAccess(sessionId: string) {
  const s = await sessionOrDeny();
  if ("res" in s) return { ok: false as const, res: s.res };
  const isCenter = s.session.role === "admin" && (s.session.adminRole === "admin_super" || s.session.adminRole === "admin_content");
  const isTutor = s.session.role === "admin" && s.session.adminRole === "teacher";
  if (!isCenter && !isTutor) return { ok: false as const, res: NextResponse.json({ error: "Chỉ gia sư mới dùng chức năng này" }, { status: 403, headers: NO_STORE }) };
  if (unusableId(sessionId)) return { ok: false as const, res: NextResponse.json({ error: "Không tìm thấy buổi" }, { status: 404, headers: NO_STORE }) };
  const row = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!row) return { ok: false as const, res: NextResponse.json({ error: "Không tìm thấy buổi" }, { status: 404, headers: NO_STORE }) };
  const acc = await loadCourseAccess(s.session, row.courseId);
  if (!acc.ok) return { ok: false as const, res: acc.res };
  return { ok: true as const, acc, row };
}

// ── Giáo trình / nội dung giảng dạy (dòng M "soạn") ──────────────────────────────────────────────

/** Cổng của các route `tutor/lop/[courseId]/giao-trinh/**`: thay requireCourseTutor. Chủ / quản trị / đồng giảng / bộ môn qua cổng (content.edit.own); phạm vi nhóm kiểm tiếp bằng deny*Edit. */
export async function requireCurriculumAccess(courseId: string): Promise<{ session: SessionPayload; acc: Extract<CourseAccess, { ok: true }> } | NextResponse> {
  const acc = await requireCourseAccess(courseId, "content.edit.own");
  if (!acc.ok) return acc.res;
  // Màn giáo trình của gia sư (tutor/lop/…): quản trị trung tâm vẫn 403 như trước (hành vi cũ của requireCourseTutor).
  if (acc.role === "admin") return NextResponse.json({ error: "Chỉ gia sư mới dùng chức năng này" }, { status: 403, headers: NO_STORE });
  return { session: acc.session, acc };
}

/** Giáo viên bộ môn chỉ sửa BÀI trong nhóm giao cho mình. Trả 403 ROLE_FORBIDDEN nếu có bài (thuộc lớp này) nằm ngoài nhóm của họ. Bài lạ / ở lớp khác: bỏ qua (hàm ghi bên dưới tự trả 404). */
export async function denyLessonEdit(acc: Extract<CourseAccess, { ok: true }>, lessonIds: string[]): Promise<NextResponse | null> {
  if (canDo(acc.role, "content.edit.any")) return null;
  const rows = await prisma.lesson.findMany({ where: { id: { in: lessonIds }, chapter: { section: { is: { courseId: acc.course.id } } } }, select: { chapter: { select: { teacherId: true } } } });
  return rows.every(r => r.chapter.teacherId === acc.session.userId) ? null : roleForbidden();
}
/** Như trên cho MỘT nhóm (chương). `chapterId` không thuộc lớp ⇒ bỏ qua (404 ở hàm ghi). */
export async function denyChapterEdit(acc: Extract<CourseAccess, { ok: true }>, chapterId: string): Promise<NextResponse | null> {
  if (canDo(acc.role, "content.edit.any")) return null;
  const ch = await prisma.chapter.findFirst({ where: { id: chapterId, section: { is: { courseId: acc.course.id } } }, select: { teacherId: true } });
  if (!ch) return null;
  return canEditChapterRole(acc.role, acc.session.userId, ch.teacherId) ? null : roleForbidden();
}
/** `teacherId` hợp lệ để GIAO nhóm cho: null / chủ lớp ⇒ null; còn lại phải là giáo viên đang `active` của lớp. undefined ⇒ không hợp lệ. */
export async function resolveAssignableTeacher(courseId: string, ownerId: string | null, raw: unknown): Promise<string | null | undefined> {
  if (raw === null || raw === "" || raw === ownerId) return null;
  if (typeof raw !== "string") return undefined;
  const ok = await prisma.courseTeacher.findFirst({ where: { courseId, userId: raw, status: "active" }, select: { id: true } });
  return ok ? raw : undefined;
}

/** Cổng cho route chỉ có id của một mục CON của lớp (phần, nhóm, bài, bài tập…): 401/403 → 404 (mục không có) → 403 người lạ → 403 ROLE_FORBIDDEN (nếu có `action`).
 *  `resolve` trả id lớp chứa mục (hoặc null nếu mục không tồn tại). */
export async function requireCourseAccessBy(
  resolve: () => Promise<string | null>, notFoundMessage: string, action?: CourseAction,
): Promise<CourseAccess> {
  const s = await sessionOrDeny();
  if ("res" in s) return { ok: false, res: s.res };
  const isCenter = s.session.role === "admin" && (s.session.adminRole === "admin_super" || s.session.adminRole === "admin_content");
  const isTutor = s.session.role === "admin" && s.session.adminRole === "teacher";
  if (!isCenter && !isTutor) return { ok: false, res: NextResponse.json({ error: "Chỉ gia sư mới dùng chức năng này" }, { status: 403, headers: NO_STORE }) };
  let courseId: string | null;
  try { courseId = await resolve(); } catch (e) {
    // Id có byte NUL: Postgres từ chối (22021) ⇒ coi như mục không có. Lỗi DB khác vẫn ném tiếp (không giấu sự cố thành 404).
    if (isInvalidTextError(e)) courseId = null; else throw e;
  }
  if (!courseId) return { ok: false, res: NextResponse.json({ error: notFoundMessage }, { status: 404, headers: NO_STORE }) };
  const acc = await loadCourseAccess(s.session, courseId);
  if (!acc.ok) return acc;
  if (action && !canDo(acc.role, action)) return { ok: false, res: roleForbidden() };
  return acc;
}

/** Người này là đồng giảng / bộ môn ĐANG HIỆU LỰC của lớp (đọc lại User từ DB)? Dùng cho đường ĐỌC dùng chung với học sinh (lessons GET, context) — không dựng NextResponse. */
export async function isActiveHelperOfCourse(session: SessionPayload | null, courseId: string, ownerId: string | null): Promise<boolean> {
  if (!session || session.role !== "admin" || session.adminRole !== "teacher" || (ownerId && ownerId === session.userId)) return false;
  const acc = await loadCourseAccess(session, courseId);
  return acc.ok && isHelperRole(acc.role);
}

/** Cổng cho route theo `assignmentId` (sửa / xoá / chấm / xem bài nộp). Bài thuộc lớp nào do BÀI GIẢNG chứa nó quyết định. Chủ lớp / quản trị / đồng giảng: mọi bài của lớp;
 *  giáo viên bộ môn: SỬA/XOÁ chỉ khi bài nằm trong nhóm giao cho mình (403 nếu ngoài nhóm); CHẤM thêm được bài do chính mình soạn. Lớp khác ⇒ 403, bài không có ⇒ 404.
 *  `namesVisible`: có được thấy tên / mã học sinh trong kết quả hay không (bộ môn: chỉ nhóm mình). */
export async function requireAssignmentAccess(assignmentId: string, action: "content.edit.own" | "grade"): Promise<(Extract<CourseAccess, { ok: true }> & { namesVisible: boolean }) | Extract<CourseAccess, { ok: false }>> {
  const acc = await requireCourseAccessBy(
    async () => (await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { lesson: { select: { chapter: { select: { section: { select: { courseId: true } } } } } } } }))?.lesson.chapter.section.courseId ?? null,
    "Không tìm thấy bài tập", action,
  );
  if (!acc.ok) return acc;
  const a = await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { ownerId: true, lesson: { select: { chapter: { select: { teacherId: true } } } } } });
  if (!a) return { ok: false, res: NextResponse.json({ error: "Không tìm thấy bài tập", code: "NOT_FOUND" }, { status: 404, headers: NO_STORE }) };
  const me = acc.session.userId;
  const chapterTeacherId = a.lesson.chapter.teacherId;
  const allowed = action === "grade"
    ? canGradeAssignment(acc.role, me, { assignmentOwnerId: a.ownerId, chapterTeacherId })
    : canEditAssignment(acc.role, me, chapterTeacherId);
  if (!allowed) return { ok: false, res: roleForbidden() };
  return { ...acc, namesVisible: studentNamesVisible(acc.role, me, chapterTeacherId) };
}

/** Giao đề / quiz CỦA MÌNH vào lớp: chủ lớp, hoặc ĐỒNG GIẢNG đang hiệu lực (quiz.assign). Giáo viên bộ môn chưa (điều kiện nhóm cần thiết kế riêng) ⇒ false. Đề vẫn của tác giả. */
export async function tutorMayAssignToCourse(userId: string, courseId: string): Promise<boolean> {
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  if (!c) return false;
  if (c.ownerId === userId) return true;
  const row = await prisma.courseTeacher.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: { role: true, status: true, user: { select: { role: true, adminRole: true, tutorVerified: true, banned: true, deletedAt: true } } },
  });
  return !!row && row.role === "co_teacher" && isCoTeacherUsable(row, row.user);
}
