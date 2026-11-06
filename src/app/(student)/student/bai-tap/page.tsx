// Điều hướng B1 (08/11/2026): "Bài tập" không còn là module riêng — cần làm / chờ chấm / kết quả / đề thi được giao / thi thử sắp tới đều nằm ở "Việc của tôi".
// Giữ route này làm CHUYỂN HƯỚNG vì thông báo cũ (đã lưu trong cơ sở dữ liệu) và liên kết cũ còn trỏ vào. 307 (không phải 308): đích có thể đổi sau này.
import { redirect } from "next/navigation";

export default function BaiTapPage() {
  redirect("/student/viec-cua-toi");
}
