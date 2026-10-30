// BU-00 bước 4–5 (31/10/2026) — phần THUẦN của "ai được vào trang gia sư, và vào rồi thì thấy vỏ nào". Không đọc cookie, không đụng DB, không
// import gì của Next — để test từng quy tắc (tools/local-e2e/t-tutor-gate-lib.ts). Phần chạm máy chủ (truy vấn trạng thái đơn + redirect()) ở
// src/lib/tutorGateServer.ts; phần máy khách (AuthGuard) chỉ dùng `studentAreaRedirect`.
//
// Bốn người có thể đứng trước một trang dưới /lop-cua-toi:
//   - gia sư (role admin + adminRole teacher)              → vỏ GIA SƯ, vào mọi trang gia sư;
//   - gia sư CHỜ DUYỆT (role student + đơn đang chờ, không cột mới, không đổi JWT) → vỏ GIA SƯ dạng "chờ duyệt": chỉ Trạng thái hồ sơ ·
//     Liên hệ hỗ trợ · Cài đặt; mở trang gia sư nào khác đều về /lop-cua-toi/cho-duyet;
//   - học sinh thường                                      → vỏ HỌC SINH (danh sách lớp đang học ở /lop-cua-toi, trang lớp…), trang chỉ-gia-sư thì về /lop-cua-toi;
//   - quản trị cấp 1 / cấp nội dung                        → vỏ HỌC SINH kèm băng "xem thử" (cookie không dùng chung hai tên miền nên họ đăng nhập ở tên miền chính
//     để xem như học sinh — src/lib/hostRouting.ts); trang chỉ-gia-sư thì về /lop-cua-toi (hoặc /admin ở nhóm nội dung).
import type { TutorApplicationStatus } from "@/lib/tutorProfile";

export interface GateSession { role: string | null; adminRole?: string | null }

export const TUTOR_PENDING_PATH = "/lop-cua-toi/cho-duyet";
export const TUTOR_HOME = "/lop-cua-toi";

export type TutorShellKind = "tutor" | "tutor-pending" | "student" | "admin-preview";

export const isTeacher = (s: GateSession | null | undefined): boolean => !!s && s.role === "admin" && s.adminRole === "teacher";
export const isCenterAdmin = (s: GateSession | null | undefined): boolean => !!s && s.role === "admin" && (s.adminRole === "admin_super" || s.adminRole === "admin_content");
/** Đơn gia sư ĐANG CHỜ: người này thấy vỏ gia sư dạng chờ duyệt thay vì khu học sinh — cùng nghĩa với cờ `tutorPending` của /api/auth/me. Bị từ chối thì là
 *  học sinh thường (vỏ học sinh; vẫn tự mở được /lop-cua-toi/cho-duyet để đọc lý do). Đã duyệt thì role đã là teacher, không tới đây. */
export const isApplicant = (status: TutorApplicationStatus | null | undefined): boolean => status === "pending";

/** Vỏ cho người đang xem một trang dưới /lop-cua-toi. `status` chỉ có nghĩa khi role là student (người khác truyền gì cũng bỏ qua). */
export function tutorShellKind(s: GateSession | null, status?: TutorApplicationStatus | null): TutorShellKind | null {
  if (!s) return null;
  if (isTeacher(s)) return "tutor";
  if (s.role === "student") return isApplicant(status) ? "tutor-pending" : "student";
  if (s.role === "admin") return "admin-preview";
  return null;
}

export interface GateOptions {
  /** Trang đang mở (để ?redirect= đúng trang khi chưa đăng nhập). */
  path: string;
  /** Học sinh THƯỜNG đi đâu (mặc định /lop-cua-toi — danh sách lớp đang học; vài trang trỏ thẳng /student/hoc-phi, /student). */
  studentTo?: string;
  /** Quản trị cấp 1 / nội dung đi đâu (mặc định /lop-cua-toi; nhóm nội dung dùng /admin). */
  adminTo?: string;
  /** Trang này cho gia sư chờ duyệt vào (Trạng thái hồ sơ, Liên hệ hỗ trợ, Hồ sơ gia sư). */
  allowPending?: boolean;
}

/** Trang chỉ-gia-sư: trả null = cho vào, trả chuỗi = đường phải chuyển hướng tới (307 qua redirect()). */
export function tutorGateTarget(s: GateSession | null, status: TutorApplicationStatus | null | undefined, o: GateOptions): string | null {
  if (!s) return `/dang-nhap?redirect=${encodeURIComponent(o.path)}`;
  if (isTeacher(s)) return null;
  if (s.role === "student") {
    if (isApplicant(status)) return o.allowPending ? null : TUTOR_PENDING_PATH;
    return o.studentTo ?? TUTOR_HOME;
  }
  return o.adminTo ?? TUTOR_HOME;
}

export interface GuardUser { role: string | null; adminRole?: string | null; tutorPending?: boolean }
const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + "/");

/** AuthGuard (máy khách): người đã đăng nhập đứng trước nhóm trang cần vai `requiredRole` — trả null = cho qua, trả chuỗi = router.replace tới đó.
 *  Khu học sinh (/student/*): học sinh thường vào; gia sư chờ duyệt → trang chờ duyệt; gia sư → Hộp việc; quản trị cấp 1 / nội dung xem thử được;
 *  role admin không có adminRole → /admin (không đoán là ai). Trang DÙNG CHUNG trong cùng nhóm nhưng ngoài /student/* (/cai-dat/chu-de) thì gia sư
 *  và gia sư chờ duyệt vẫn vào (họ bấm "Chủ đề màu" từ vỏ của mình). */
export function studentAreaRedirect(u: GuardUser, requiredRole: "student" | "admin" | null | undefined, pathname: string): string | null {
  if (!requiredRole) return null;
  if (requiredRole === "admin") return u.role === "admin" ? null : "/student/viec-cua-toi";
  const inStudentArea = under(pathname, "/student");
  if (u.role === "student") return u.tutorPending && inStudentArea ? TUTOR_PENDING_PATH : null;
  if (u.role === "admin") {
    if (isTeacher(u)) return inStudentArea ? TUTOR_HOME : null;
    return isCenterAdmin(u) ? null : "/admin";
  }
  return "/student/viec-cua-toi";
}
