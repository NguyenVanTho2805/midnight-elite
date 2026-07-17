export type ExamStatus = "available" | "upcoming" | "completed";

// Tính trạng thái đề thi THEO THỜI GIAN THỰC — không tin field Exam.status
// lưu trong DB, vì field đó chỉ được ghi 1 lần lúc tạo/sửa đề rồi đứng yên
// mãi mãi. Nếu 1 nơi nào đó đọc thẳng field DB thay vì gọi hàm này, trạng
// thái sẽ bị "đơ" ở giá trị lúc tạo — đề đã đến giờ thi vẫn hiện "Sắp diễn
// ra" và khoá nút vào thi, dù backend (route start) không hề chặn theo field
// này. Luôn gọi hàm này ở MỌI nơi hiển thị trạng thái cho người dùng.
export function computeExamStatus(date: string, time: string, active: boolean): ExamStatus {
  if (!active) return "completed";
  const [day, month, year] = (date || "01/01/2000").split("/");
  const [hh, mm] = (time || "00:00").split(":");
  const examDt = new Date(+year, +month - 1, +day, +hh, +mm);
  return examDt <= new Date() ? "available" : "upcoming";
}
