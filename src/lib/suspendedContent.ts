// Quyết định của chủ (06/11/2026): học sinh có Enrollment.status = "suspended" (đã nghỉ lớp) KHÔNG xem được nội dung lớp nữa
// (bài giảng, video / tài liệu lưu trên KiN, bản ghi buổi học, ghi chú, tiến độ). Trước đây quy tắc R01 cho xem lại; nay thu hồi.
// Bài MIỄN PHÍ công khai không gắn ghi danh thì giữ nguyên cho mọi người. "active" và "pending_consent" giữ như cũ.
// THUẦN: mọi route / trang đọc nội dung lớp dựa trên ghi danh gọi vào đây để một chỗ quyết định.
// Không import "@/lib/enrollment": tệp đó nạp muộn "@/lib/prisma" nên kéo Prisma vào gói trình duyệt (trang bài giảng là Client Component dùng SuspendedNotice).

export const SUSPENDED_CONTENT_MESSAGE = "Bạn đã nghỉ lớp này nên chưa xem được bài. Liên hệ gia sư nếu cần tham gia lại.";
/** Trường `code` trong JSON 403 để giao diện nhận ra và hiện trang thông báo thay vì lỗi chung. */
export const SUSPENDED_CONTENT_CODE = "enrollment_suspended";

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
