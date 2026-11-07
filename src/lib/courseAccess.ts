// TUT-dong-giang — quyền của MỘT người trong MỘT lớp (GVCN / đồng giảng / giáo viên bộ môn). Phần THUẦN: không React, không DB, không cookie.
// Mặc định TỪ CHỐI: cặp (vai, hành động) không có trong bảng ⇒ false. Bảng = ma trận mục 4.3 của docs/kin/phong-ban/dac-ta/TUT-dong-giang.md.
// Đồng giảng KHÔNG có `money.view`, `roster.contact`, `score.write` (tiền / trẻ em: chờ chủ Q2–Q4). Tệp này không nhập gì từ tiền (feeCharge*, invoiceServer*, sessionBook*).

export type CourseRole = "owner" | "co_teacher" | "subject_teacher" | "admin" | "none";

export type CourseAction =
  | "course.view" | "roster.view" | "roster.contact" | "attendance.mark.own" | "attendance.mark.other"
  | "session.note.own" | "session.add.own" | "session.close" | "session.request_close" | "session.reassign"
  | "content.edit.any" | "content.edit.own" | "content.delete_section" | "quiz.assign" | "grade" | "score.write"
  | "course.edit" | "course.delete" | "student.invite" | "student.decide" | "student.remove" | "invite_code.rotate"
  | "teacher.invite" | "teacher.remove" | "teacher.role" | "teacher.leave"
  | "schedule.add.own" | "schedule.edit.own" | "schedule.edit.other" | "money.view" | "attendance.export"
  | "community.post" | "community.moderate";

export const ROLE_LABEL: Record<CourseRole, string> = {
  owner: "Chủ nhiệm",
  co_teacher: "Đồng giảng",
  subject_teacher: "Giáo viên bộ môn",
  admin: "Quản trị trung tâm",
  none: "Không thuộc lớp",
};

/** Vai của người PHỤ trong CourseTeacher.role. */
export const TEACHER_ROLES = ["co_teacher", "subject_teacher"] as const;
export type TeacherRole = (typeof TEACHER_ROLES)[number];
export const isTeacherRole = (v: unknown): v is TeacherRole => v === "co_teacher" || v === "subject_teacher";

export const MAX_TEACHERS_PER_COURSE = 5; // active + invited
export const MAX_SUBJECTS = 5;
export const MAX_SUBJECT_LEN = 40;
export const ROLE_FORBIDDEN_MESSAGE = "Bạn không có quyền với việc này trong lớp";
export const NOT_IN_COURSE_MESSAGE = "Bạn không có quyền với lớp này";

// Chủ lớp và quản trị trung tâm có cùng tập quyền (admin = như owner ở mọi hàng ✔ của bảng).
const OWNER_ONLY: CourseAction[] = [
  "roster.contact", "attendance.mark.other", "session.close", "session.reassign", "content.delete_section", "score.write",
  "course.edit", "course.delete", "student.invite", "student.decide", "student.remove", "invite_code.rotate",
  "teacher.invite", "teacher.remove", "teacher.role", "schedule.edit.other", "money.view", "attendance.export", "community.moderate",
];
const SHARED: CourseAction[] = [
  "course.view", "roster.view", "attendance.mark.own", "session.note.own", "content.edit.any", "content.edit.own",
  "quiz.assign", "grade", "schedule.add.own", "schedule.edit.own", "session.add.own", "community.post",
];

const MATRIX: Record<Exclude<CourseRole, "none">, ReadonlySet<CourseAction>> = {
  owner: new Set<CourseAction>([...OWNER_ONLY, ...SHARED]),
  admin: new Set<CourseAction>([...OWNER_ONLY, ...SHARED]),
  co_teacher: new Set<CourseAction>([
    "course.view", "roster.view", "attendance.mark.own", "session.note.own", "session.add.own", "session.request_close",
    "content.edit.any", "content.edit.own", "quiz.assign", "grade", "teacher.leave", "schedule.add.own", "schedule.edit.own", "community.post",
  ]),
  subject_teacher: new Set<CourseAction>([
    "course.view", "roster.view", "attendance.mark.own", "session.note.own", "session.request_close",
    "content.edit.own", "quiz.assign", "grade", "teacher.leave", "community.post",
  ]),
};

/** Ma trận 4.3. Vai lạ / hành động lạ ⇒ false. */
export function canDo(role: CourseRole, action: CourseAction): boolean {
  if (role === "none") return false;
  const set = MATRIX[role];
  return set ? set.has(action) : false;
}

export const canViewCourse = (r: CourseRole) => canDo(r, "course.view");
export const canTeachCourse = (r: CourseRole) => canDo(r, "attendance.mark.own");
export const canManageCourse = (r: CourseRole) => canDo(r, "course.edit");
export const canSeeMoney = (r: CourseRole) => canDo(r, "money.view");

/** Người dạy hiệu lực của một buổi: `taughtBy` của buổi > `teacherId` của khung > chủ lớp. Cả ba trống ⇒ null. */
export function effectiveSessionTeacher(i: { taughtBy: string | null; scheduleTeacherId: string | null; ownerId: string | null }): string | null {
  return i.taughtBy || i.scheduleTeacherId || i.ownerId || null;
}

export type MarkDenied = { ok: false; code: "ROLE_FORBIDDEN" | "NOT_YOUR_SESSION" | "SESSION_CLOSED_OWNER_ONLY" };

/** Điểm danh / ghi chép một buổi. Owner / admin: luôn ok. Đồng giảng & bộ môn: chỉ buổi MÌNH dạy và CHƯA chốt. */
export function canMarkSession(r: CourseRole, me: string, teacher: string | null, closed: boolean): { ok: true } | MarkDenied {
  if (!canDo(r, "attendance.mark.own")) return { ok: false, code: "ROLE_FORBIDDEN" };
  if (canDo(r, "attendance.mark.other")) return { ok: true };
  if (!teacher || teacher !== me) return { ok: false, code: "NOT_YOUR_SESSION" };
  if (closed) return { ok: false, code: "SESSION_CLOSED_OWNER_ONLY" };
  return { ok: true };
}

/** Soạn một nhóm giáo trình: co_teacher / owner / admin mọi nhóm; subject_teacher chỉ nhóm giao cho MÌNH (teacherId null ⇒ không). */
export function canEditChapter(r: CourseRole, me: string, chapterTeacherId: string | null): boolean {
  if (canDo(r, "content.edit.any")) return true;
  if (!canDo(r, "content.edit.own")) return false;
  return !!chapterTeacherId && chapterTeacherId === me;
}

/** Soạn / sửa / xoá BÀI TẬP của một bài giảng: cùng khoá nhóm như `canEditChapter` (bộ môn chỉ khi nhóm chứa bài giao cho MÌNH; tự soạn bài tập mà nhóm không phải của mình thì KHÔNG đủ). */
export function canEditAssignment(r: CourseRole, me: string, chapterTeacherId: string | null): boolean {
  return canEditChapter(r, me, chapterTeacherId);
}

/** Chấm / xem bài nộp: ai soạn bài tập hoặc có quyền soạn nhóm chứa bài; bộ môn thêm điều kiện `grade` (hàng 15 ma trận). */
export function canGradeAssignment(r: CourseRole, me: string, i: { assignmentOwnerId: string | null; chapterTeacherId: string | null }): boolean {
  if (!canDo(r, "grade")) return false;
  if (canDo(r, "content.edit.any")) return true;
  return (!!i.chapterTeacherId && i.chapterTeacherId === me) || (!!i.assignmentOwnerId && i.assignmentOwnerId === me);
}

/** Tên học sinh trong kết quả / bài nộp: chủ, quản trị, đồng giảng thấy; giáo viên bộ môn CHỈ thấy khi bài nằm trong nhóm được giao cho mình (mặc định an toàn = ẩn). */
export function studentNamesVisible(r: CourseRole, me: string, chapterTeacherId: string | null): boolean {
  if (r === "owner" || r === "admin" || r === "co_teacher") return true;
  if (r === "subject_teacher") return !!chapterTeacherId && chapterTeacherId === me;
  return false;
}

/** Nhãn ẩn danh ổn định theo MÃ học sinh (băm FNV-1a, 5 ký tự hex) — không đổi khi lớp có người vào/ra, không lộ tên / mã gốc, vẫn chấm được từng em. */
export function anonymousStudentLabel(userId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) { h ^= userId.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `Học viên ${(h >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 5)}`;
}

/** Khung lịch: sửa / xoá khung của MÌNH (teacherId = me) hoặc, nếu có quyền `schedule.edit.other`, khung bất kỳ. Khung teacherId null là của chủ lớp. */
export function canEditSchedule(r: CourseRole, me: string, scheduleTeacherId: string | null): boolean {
  if (canDo(r, "schedule.edit.other")) return true;
  return canDo(r, "schedule.edit.own") && !!scheduleTeacherId && scheduleTeacherId === me;
}

export interface CoTeacherUserRow { role: string; adminRole: string | null; tutorVerified: boolean; banned: boolean; deletedAt: Date | null }

/** Dòng CourseTeacher có hiệu lực không: status active VÀ người đó còn là gia sư đã duyệt, không khoá, không xoá. */
export function isCoTeacherUsable(row: { status: string }, user: CoTeacherUserRow): boolean {
  if (row.status !== "active") return false;
  if (user.role !== "admin" || user.adminRole !== "teacher") return false;
  if (!user.tutorVerified) return false;
  if (user.banned) return false;
  if (user.deletedAt) return false;
  return true;
}

/** Người này mời được làm đồng giảng không (cùng điều kiện, không kể status của dòng). */
export function canBeInvitedAsTeacher(user: CoTeacherUserRow): boolean {
  return isCoTeacherUsable({ status: "active" }, user);
}

/** Cột TIỀN của Course: đồng giảng không được thấy. */
export const COURSE_MONEY_FIELDS = ["price", "originalPrice", "feeMode", "tag", "tagColor"] as const;
/** Cột liên hệ phụ huynh của Course (link nhóm Zalo): đồng giảng không được thấy (TRẺ EM). */
export const COURSE_CONTACT_FIELDS = ["zaloGroupUrl", "zaloGroupLink"] as const;

/** Bản sao của lớp đã bỏ cột tiền / liên hệ khi người xem không có quyền tương ứng. Owner / admin: nguyên vẹn. */
export function redactCourseForRole<T extends Record<string, unknown>>(role: CourseRole, course: T): Partial<T> {
  const out: Record<string, unknown> = { ...course };
  if (!canSeeMoney(role)) for (const f of COURSE_MONEY_FIELDS) delete out[f];
  if (!canDo(role, "roster.contact")) for (const f of COURSE_CONTACT_FIELDS) delete out[f];
  return out as Partial<T>;
}

/** Khoá JSON không được xuất hiện trong phản hồi cho đồng giảng (tiền / phụ huynh). Dùng ở test quét và để lọc dòng học viên. */
export const MONEY_KEY_RE = /^(price|originalPrice|amount|fee|fees|feeMode|charge|charges|invoice|invoices|rate|rates|revenue|packages|reopenWarning)$/i;
export const CONTACT_KEYS = ["email", "phone", "school", "parentName", "parentPhone", "zaloOpenedAt", "zaloGroupUrl", "zaloGroupLink"] as const;

/** Bỏ khoá liên hệ khỏi một dòng (học viên / bản ghi điểm danh) khi vai không có `roster.contact`. */
export function redactContactRow<T extends Record<string, unknown>>(role: CourseRole, row: T): Partial<T> {
  if (canDo(role, "roster.contact")) return row;
  const out: Record<string, unknown> = { ...row };
  for (const k of CONTACT_KEYS) delete out[k];
  return out as Partial<T>;
}

// ── Lời mời đồng giảng (hình thức) ──────────────────────────────────────────────────────────────

export const INVITE_REPLY = "Nếu email đúng của một gia sư đã duyệt, lời mời đã được gửi.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInviteEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v.length < 5 || v.length > 254 || !EMAIL_RE.test(v)) return null;
  return v;
}

/** Nhãn môn: tối đa 5 × 40 ký tự, bỏ trùng / rỗng. Sai kiểu ⇒ null. */
export function normalizeSubjects(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") return null;
    const t = x.trim();
    if (!t) continue;
    if (t.length > MAX_SUBJECT_LEN) return null;
    if (!out.includes(t)) out.push(t);
  }
  return out.length > MAX_SUBJECTS ? null : out;
}

export type TeacherStatus = "invited" | "active" | "declined" | "removed";
export type TeacherEvent = "invite" | "accept" | "decline" | "cancel" | "remove" | "leave";

/** Máy trạng thái 8.1. `reinvite` (declined/removed → invited) gộp vào "invite". */
export function nextTeacherStatus(from: TeacherStatus | null, ev: TeacherEvent): TeacherStatus | null {
  switch (ev) {
    case "invite": return from === null || from === "declined" || from === "removed" ? "invited" : null;
    case "accept": return from === "invited" ? "active" : null;
    case "decline": return from === "invited" ? "declined" : null;
    case "cancel": return from === "invited" ? "removed" : null;
    case "remove": return from === "active" ? "removed" : null;
    case "leave": return from === "active" ? "removed" : null;
  }
}

export const TEACHER_NOTIFY_TYPES = {
  invited: "co_teacher_invited",
  accepted: "co_teacher_accepted",
  declined: "co_teacher_declined",
  removed: "co_teacher_removed",
  left: "co_teacher_left",
  roleChanged: "co_teacher_role_changed",
  closeRequest: "session_close_request",
} as const;
