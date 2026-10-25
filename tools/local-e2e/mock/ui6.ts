// UI6 — dữ liệu GIẢ: "Ghi chú buổi trước" (trang buổi học) và "Xem ảnh hưởng khi xoá" (hồ sơ học sinh).
// Dùng lớp thử của HV-04 (chạy sau hv-04 trong mock-seed); chỉ gắn ghi chép CHUNG vào buổi đã qua gần nhất, chạy lặp lại được.
import type { MockFn } from "../mock-seed";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";

const mock: MockFn = async ({ prisma, tutor }) => {
  const course = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: "Toán 8 — thử số buổi trong tháng (dữ liệu giả)" } });
  if (!course) return ["(UI6: chưa thấy lớp thử HV-04, bỏ qua)"];
  const today = vnDateKeyOf(new Date());
  const prev = await prisma.attendanceSession.findFirst({ where: { courseId: course.id, date: { lt: new Date(`${today}T00:00:00Z`) } }, orderBy: { date: "desc" } });
  if (!prev) return ["(UI6: lớp thử chưa có buổi đã qua, bỏ qua)"];
  await prisma.attendanceSession.update({ where: { id: prev.id }, data: { taught: "Định lý Vi-ét (dữ liệu giả)", summary: "Cả lớp cần chú ý dấu của hệ số b và kiểm tra nghiệm sau khi giải. (dữ liệu giả)" } });
  const pk = prev.date.toISOString().slice(0, 10);
  return [
    `UI6 · giasu@kin.local → /lop-cua-toi/buoi/${course.id}/${addDaysKey(pk, 1)} : khối "Ghi chú buổi trước" thấy buổi ${pk.slice(8, 10)}/${pk.slice(5, 7)} · Định lý Vi-ét + nhận xét chung (không có nhận xét riêng từng em).`,
    "UI6 · giasu@kin.local → Học sinh → mở hồ sơ một em có tài khoản → tab Tổng quan, cuối trang: 'Lưu trữ khác với xoá' + nút 'Xem ảnh hưởng khi xoá' (chỉ số đếm: buổi, phiếu, buổi có điểm).",
  ];
};
export default mock;
