// Dữ liệu GIẢ cho NC2-035 — một lớp của gia sư chính để thử: toast "Đã tạo khoá học mới" chỉ hiện một lần (?moi=1),
// và máy chủ từ chối giá âm / vô lý khi gia sư sửa lớp. Chạy lặp lại được (tìm-trước-tạo-sau).
import { mkCourse } from "../h";
import type { MockCtx } from "../mock-seed";

const TITLE = "Lớp thử giá hợp lệ (thử NC2-035)";

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  let c = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: TITLE } });
  if (!c) {
    const made = await mkCourse(tutor.id, { name: TITLE });
    c = await prisma.course.update({ where: { id: made.id }, data: { price: 500_000, lessons: 12, hours: 24 } });
  }
  return [
    `Đăng nhập giasu@kin.local, mở /admin/khoa-hoc/${c.id}?tab=lich-hoc&moi=1 → thấy toast "Đã tạo khoá học mới" MỘT lần; địa chỉ tự mất "moi=1"; bấm F5 không báo lại.`,
    `Lớp "${TITLE}" (giá 500.000 đ, 12 bài): thử gõ giá âm / lẻ / hơn 50.000.000 đ ở tab Cài đặt hoặc khi tạo lớp mới → máy chủ trả lỗi tiếng Việt, không lưu.`,
  ];
}
