// Thông điệp + mã lỗi về trạng thái ghi danh (nghỉ lớp / không còn trong lớp). TỆP THUẦN: KHÔNG được import gì.
// Lý do: tệp "use client" (vd RoomGate) import hằng từ đây; nếu hằng nằm trong enrollment.ts / attemptAccess.ts (có prisma) thì Turbopack
// kéo Prisma vào bundle trình duyệt và trang trả 500. t-client-bundle-lib.ts chặn tái phát.

/** Đã nghỉ lớp (Enrollment.status = suspended) mà đòi xem bài thi của lớp. */
export const ATTEMPT_SUSPENDED_MESSAGE = "Bạn đã nghỉ lớp này nên chưa xem được bài thi. Liên hệ gia sư nếu cần tham gia lại.";
export const ENROLLMENT_SUSPENDED_CODE = "enrollment_suspended";

/** Không còn bản ghi ghi danh nào (bị xoá khỏi lớp) mà đòi xem bài thi của lớp. Khác thông điệp "nghỉ lớp". */
export const ATTEMPT_LEFT_CLASS_MESSAGE = "Bạn không còn trong lớp này nên chưa xem được bài thi. Liên hệ gia sư nếu cần tham gia lại.";
export const ENROLLMENT_REMOVED_CODE = "enrollment_removed";

/** Chặn GHI (lưu đáp án, nộp, báo rời màn hình) vì hồ sơ đang tạm dừng. */
export const ATTEMPT_BLOCKED_MESSAGE = "Hồ sơ của em ở lớp này đang tạm dừng nên KiN chưa ghi nhận bài làm. Em nhắn gia sư của lớp để được mở lại nhé.";
/** Chặn GHI vì không còn trong lớp (không nói "tạm dừng"). */
export const ATTEMPT_LEFT_CLASS_BLOCKED_MESSAGE = "Em không còn trong lớp này nên KiN chưa ghi nhận bài làm. Em nhắn gia sư của lớp nếu cần tham gia lại nhé.";
