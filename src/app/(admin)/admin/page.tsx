// /admin = "Hôm nay cần làm gì" (BU-08): việc chờ theo nhóm + vài chỉ số gọn. Không còn bảng thống kê, danh sách học sinh hay số điện thoại.
// Nhắc cả lớp đã chuyển sang trang Học viên của từng lớp (/admin/khoa-hoc/[id]/hoc-vien).
import type { Metadata } from "next";
import HomNay from "@/components/admin/HomNay";

export const metadata: Metadata = { title: "Hôm nay cần làm gì — KiN" };

export default function AdminHomNayPage() {
  return <HomNay />;
}
