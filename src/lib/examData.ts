export type ExamStatus = "available" | "upcoming" | "completed";

// Tính trạng thái đề thi THEO THỜI GIAN THỰC — không tin field Exam.status
// lưu trong DB, vì field đó chỉ được ghi 1 lần lúc tạo/sửa đề rồi đứng yên
// mãi mãi. Nếu 1 nơi nào đó đọc thẳng field DB thay vì gọi hàm này, trạng
// thái sẽ bị "đơ" ở giá trị lúc tạo — đề đã đến giờ thi vẫn hiện "Sắp diễn
// ra" và khoá nút vào thi, dù backend (route start) không hề chặn theo field
// này. Luôn gọi hàm này ở MỌI nơi hiển thị trạng thái cho người dùng.
export function computeExamStatus(date: string, time: string, active: boolean, now: Date = new Date()): ExamStatus {
  if (!active) return "completed";
  return examStartInstant(date, time) <= now ? "available" : "upcoming";
}

/** Giờ Việt Nam là +07:00 cố định, không đổi theo mùa; máy chủ production chạy UTC nên KHÔNG dùng múi giờ máy. */
export const VN_OFFSET_MS = 7 * 3_600_000;

/**
 * "dd/mm/yyyy" + "HH:mm" (giờ Việt Nam) → thời điểm tuyệt đối. Kết quả KHÔNG phụ thuộc TZ của tiến trình.
 * Giữ đúng quy ước lỏng của bản cũ: date rỗng → 01/01/2000, time rỗng → 00:00, chuỗi rác → Invalid Date.
 */
export function examStartInstant(date: string, time: string): Date {
  const [day, month, year] = (date || "01/01/2000").split("/");
  const [hh, mm] = (time || "00:00").split(":");
  return new Date(Date.UTC(+year, +month - 1, +day, +hh, +mm) - VN_OFFSET_MS);
}
