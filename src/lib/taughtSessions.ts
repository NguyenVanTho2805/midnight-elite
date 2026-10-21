// ĐX-00 (NC1-001) — MỘT định nghĩa duy nhất của "buổi đã dạy" cho mọi số liệu hiển thị ra ngoài
// (hồ sơ công khai, thẻ xem trước link, xem trước khi vào lớp, bài đăng tìm học sinh).
//
// Trước đây các chỗ đó đếm mọi dòng `attendance_sessions`, nên tính cả:
//  - phiên rỗng (gia sư tạo phiên ở ngày bất kỳ, không cần điểm danh em nào);
//  - phiên ở ngày TƯƠNG LAI (API tạo phiên không chặn ngày);
//  - phiên chỉ có bản ghi "excused" do báo nghỉ trước tự sinh ra (absenceServer.markExcused) — buổi đó
//    có thể chưa hề diễn ra.
//
// Buổi đã dạy = phiên có ngày ≤ hôm nay (giờ VN) VÀ có ít nhất 1 em "có mặt" hoặc "muộn".
//
// Giới hạn còn lại (nói thẳng): gia sư vẫn tạo được phiên ở quá khứ với bản ghi "có mặt" giả. Đây là dữ liệu
// gia sư tự ghi, không phải bằng chứng đã xác minh — chữ hiển thị công khai chỉ được nói "ghi trên KiN".
import type { Prisma } from "@/generated/prisma/client";
import { vnDateKeyOf } from "@/lib/classSessions";

/** Trạng thái điểm danh chứng tỏ em có mặt ở buổi đó. "excused" và "absent" thì không. */
export const TAUGHT_RECORD_STATUSES = ["present", "late"] as const;

/**
 * Điều kiện Prisma cho `attendanceSession` — trộn thêm lọc lớp/gia sư bằng spread:
 * `prisma.attendanceSession.count({ where: { courseId, ...taughtSessionWhere(now) } })`.
 *
 * `date` lưu là 00:00 UTC của NGÀY VN (xem `normalizeAttendanceDate`), nên "hôm nay" cũng phải là
 * 00:00 UTC của ngày VN hiện tại — không dùng `new Date()` thô vì lệch 7 tiếng.
 */
export function taughtSessionWhere(now: Date = new Date()): Prisma.AttendanceSessionWhereInput {
  return {
    date: { lte: new Date(`${vnDateKeyOf(now)}T00:00:00Z`) },
    records: { some: { status: { in: [...TAUGHT_RECORD_STATUSES] } } },
  };
}

/** Bản thuần của cùng định nghĩa, để test và để các chỗ đã có sẵn dữ liệu trong bộ nhớ. */
export function isTaughtSession(s: { date: Date; records: ReadonlyArray<{ status: string }> }, now: Date = new Date()): boolean {
  if (s.date.getTime() > new Date(`${vnDateKeyOf(now)}T00:00:00Z`).getTime()) return false;
  return s.records.some(r => (TAUGHT_RECORD_STATUSES as readonly string[]).includes(r.status));
}
