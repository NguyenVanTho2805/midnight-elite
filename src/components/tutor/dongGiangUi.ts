// TUT-dong-giang (giao diện) — kiểu và chữ dùng chung cho đồng giảng. Thuần: không React, không DB.
// Vai thật do máy chủ quyết (courseAccessServer.loadCourseAccess của tut-code); tệp này chỉ là nhãn hiển thị và hình dạng JSON của API.
// Khi src/lib/courseAccess.ts có ROLE_LABEL thì có thể đổi sang import từ đó (hiện giữ bản cục bộ để không phụ thuộc tệp chưa có).

import { canDo, ROLE_LABEL as LIB_ROLE_LABEL, type CourseRole } from "@/lib/courseAccess";

export type TeachRole = "co_teacher" | "subject_teacher";
/** Vai của người đang xem một lớp (chỉ vai có quyền xem lớp). Quyền thật do máy chủ quyết; giao diện chỉ dùng canDo (ma trận thuần) để ẩn/hiện nút. */
export type ViewRole = Exclude<CourseRole, "none">;
export const ROLE_LABEL: Record<ViewRole, string> = LIB_ROLE_LABEL;
export const TEACH_ROLE_HINT: Record<TeachRole, string> = {
  co_teacher: "Soạn mọi bài, dạy buổi được giao",
  subject_teacher: "Chỉ nhóm bài được giao",
};
export const isTeachRole = (r: string | null | undefined): r is TeachRole => r === "co_teacher" || r === "subject_teacher";
/** Vai quản lý lớp (mời/đổi vai/gỡ giáo viên, tiền, liên hệ phụ huynh): owner và quản trị trung tâm. Vắng vai = chủ. */
export const canManageRole = (r: ViewRole | undefined) => r === undefined || canDo(r, "teacher.invite");
export const canSeeMoneyRole = (r: ViewRole | undefined) => r === undefined || canDo(r, "money.view");
export const canContactRole = (r: ViewRole | undefined) => r === undefined || canDo(r, "roster.contact");
/** Chuỗi ngày gửi lời mời → "dd/mm" theo giờ Việt Nam (API trả ISO; nếu đã là dd/mm thì giữ). */
export function shortDate(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) { const d = new Date(v); if (!Number.isNaN(d.getTime())) { const k = new Date(d.getTime() + 7 * 3_600_000).toISOString(); return `${k.slice(8, 10)}/${k.slice(5, 7)}`; } }
  return v;
}

export type CtStatus = "invited" | "active" | "declined" | "removed";
export const CT_STATUS_LABEL: Record<CtStatus, string> = { invited: "Chờ nhận lời", active: "Đang dạy", declined: "Đã từ chối", removed: "Đã gỡ" };

/** GET /api/tutor/lop/[courseId]/giao-vien */
export interface TeacherRow { id: string; role: TeachRole; subjects: string[]; status: CtStatus; since: string | null; name?: string; email?: string }
export interface TeachersResponse { self: { role: ViewRole; ctId?: string }; teachers: TeacherRow[]; limit: number }

/** GET /api/tutor/dong-giang */
export interface Invitation { id: string; courseName: string; role: TeachRole; subjects: string[]; sentOn: string }
export interface CoCourse { id?: string; ctId?: string; courseId: string; courseName: string; role: TeachRole; subjects: string[]; nextSession?: { dateKey: string; startTime?: string } | null; unmarkedCount: number }
export interface DongGiangResponse { invitations: Invitation[]; courses: CoCourse[] }

export const INVITE_SENT_TEXT = "Nếu email đúng của một gia sư đã duyệt, lời mời đã được gửi.";
export const SUBJECT_MAX = 5, SUBJECT_LEN = 40;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Toán, Lý" → ["Toán","Lý"]; bỏ ô trống và trùng, cắt theo giới hạn của API. */
export function parseSubjects(raw: string): string[] {
  const out: string[] = [];
  for (const s of raw.split(/[,;\n]/).map(x => x.trim()).filter(Boolean)) { const v = s.slice(0, SUBJECT_LEN); if (!out.includes(v)) out.push(v); }
  return out.slice(0, SUBJECT_MAX);
}
/** Câu chữ cho lỗi API (không lộ mã). */
export function errorText(status: number, code?: string, fallback = "Chưa làm được, thử lại sau."): string {
  if (status === 429) return "Bạn gửi hơi nhiều lần, chờ ít phút rồi thử lại.";
  if (code === "TEACHER_LIMIT") return "Lớp đã đủ giáo viên (tối đa 5 người, kể cả lời mời đang chờ).";
  if (code === "ALREADY_RESPONDED") return "Lời mời đã được xử lý.";
  if (status === 403) return "Bạn không có quyền với việc này trong lớp.";
  if (status === 404) return "Không tìm thấy, có thể đã thay đổi. Tải lại trang rồi thử.";
  if (status === 409) return "Việc này không làm được ở trạng thái hiện tại.";
  return fallback;
}
