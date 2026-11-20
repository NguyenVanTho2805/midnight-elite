// LOI-04 — Nhắc học của học sinh (kiểu Reminders): việc tự ghi, hẹn ngày giờ, #thẻ, gắn lớp/bài + buổi học có hẹn ngày kèm phiếu bài. Đặc tả: docs/kin/phong-ban/dac-ta/LOI-04.md.
// Trang máy chủ mỏng (metadata cố định — KHÔNG đưa tiêu đề / ghi chú của em vào title); dữ liệu và bố cục ở components/student/nhac-hoc/NhacHoc (client, gọi API JSON).
// Khách: AuthGuard của (student) chuyển /dang-nhap?redirect=/student/nhac-hoc.
import type { Metadata } from "next";
import NhacHoc from "@/components/student/nhac-hoc/NhacHoc";

export const metadata: Metadata = { title: "Nhắc học — KiN" };

export default function NhacHocPage() {
  return <NhacHoc />;
}
