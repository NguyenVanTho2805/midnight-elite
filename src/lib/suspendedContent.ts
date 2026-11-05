// Quyết định của chủ (06/11/2026): học sinh có Enrollment.status = "suspended" (đã nghỉ lớp) KHÔNG xem được nội dung lớp nữa
// (bài giảng, video / tài liệu lưu trên KiN, bản ghi buổi học, ghi chú, tiến độ). Trước đây quy tắc R01 cho xem lại; nay thu hồi.
// Bài MIỄN PHÍ công khai không gắn ghi danh thì giữ nguyên cho mọi người. "active" và "pending_consent" giữ như cũ.
// THUẦN: mọi route / trang đọc nội dung lớp dựa trên ghi danh gọi vào đây để một chỗ quyết định.
// Không import "@/lib/enrollment" (chỉ import tệp thuần enrollmentMessages.ts): tệp đó nạp muộn "@/lib/prisma" nên kéo Prisma vào gói trình duyệt (trang bài giảng là Client Component dùng SuspendedNotice).

import { ENROLLMENT_SUSPENDED_CODE } from "@/lib/enrollmentMessages";

export const SUSPENDED_CONTENT_MESSAGE = "Bạn đã nghỉ lớp này nên chưa xem được bài. Liên hệ gia sư nếu cần tham gia lại.";
/** Trường `code` trong JSON 403 để giao diện nhận ra và hiện trang thông báo thay vì lỗi chung. */
export const SUSPENDED_CONTENT_CODE = ENROLLMENT_SUSPENDED_CODE; // một nguồn với phòng thi (phòng thi): tệp thuần enrollmentMessages.ts

export function isSuspended(e: { status: string } | null | undefined): boolean {
  return !!e && e.status === "suspended";
}

/** true = học sinh này đã nghỉ lớp và bài này không miễn phí ⇒ chặn nội dung. Bài miễn phí công khai không bị chặn. */
export function suspendedBlocksLesson(e: { status: string } | null | undefined, lesson: { isFree?: boolean | null }): boolean {
  return isSuspended(e) && lesson.isFree !== true;
}

/** Thân JSON 403 dùng chung (không tên gia sư, không số tiền). `contactHref` = trang liên hệ gia sư của lớp. */
export function suspendedBody(contactHref: string | null) {
  return { error: SUSPENDED_CONTENT_MESSAGE, code: SUSPENDED_CONTENT_CODE, contactHref };
}

/** Đích nút "Liên hệ gia sư": hồ sơ công khai của gia sư chủ lớp; lớp không có chủ thì trang lớp. */
export function contactTutorHref(course: { id: string; ownerId: string | null }): string {
  return course.ownerId ? `/mentor/${encodeURIComponent(course.ownerId)}` : `/khoa-hoc/${encodeURIComponent(course.id)}`;
}

/** Dùng mã mời / mã cá nhân khi đã nghỉ lớp (suspended): KHÔNG tự vào lại, cũng không báo "đã trong lớp". Chỉ gia sư mở lại được. */
export const SUSPENDED_REDEEM_MESSAGE = "Bạn đã nghỉ lớp này nên mã mời không mở lại lớp được. Liên hệ gia sư nếu cần tham gia lại.";

/** Thân JSON 403 cho route GHI (lưu tiến độ, nộp bài, báo làm xong) khi học sinh không còn ghi danh ĐANG HỌC:
 *  đã nghỉ lớp (suspended) → thân có `code: "enrollment_suspended"` + thông điệp nghỉ lớp; còn lại (chưa ghi danh, chờ phụ huynh…) → `fallbackError` như cũ. */
export function enrollmentDeniedBody(e: { status: string } | null | undefined, fallbackError: string): { error: string; code?: string; contactHref?: string | null } {
  return isSuspended(e) ? suspendedBody(null) : { error: fallbackError };
}
