// KiN Pro (nền gói) — dữ liệu giả. Chỉ dựng gia sư thử + học viên giả; cờ (KIN_PLAN_ENFORCE, KINPRO_*) là biến môi trường nên mock không bật được.
//  - giasu-pro-day@kin.local: 9 học viên giả trong một lớp → ở /lop-cua-toi/goi thấy thanh 9/10 "Gần đến hạn mức".
//  - giasu-pro-yeucau@kin.local: một yêu cầu mua đang chờ (mã giả) để admin thử bấm Kích hoạt ở /admin/goi-pro (giá 0 đã ghi như yêu cầu thật).
import type { MockFn } from "../mock-seed";
import { mkCourse, mkTutor, mkUser } from "../h";

const mock: MockFn = async ({ prisma }) => {
  const ensure = async (email: string, name: string) => {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (u) return u.id;
    const t = await mkTutor(name);
    await prisma.user.update({ where: { id: t.id }, data: { email } });
    return t.id;
  };
  const dayId = await ensure("giasu-pro-day@kin.local", "Cô Thử Gần Đầy");
  if (!(await prisma.course.count({ where: { ownerId: dayId } }))) {
    const c = await mkCourse(dayId, { name: "Lớp thử gần đầy" });
    for (let i = 1; i <= 9; i++) { const s = await mkUser({ name: `Em thử ${i}` }); await prisma.enrollment.create({ data: { userId: s.id, courseId: c.id, status: "active" } }); }
  }
  const reqId = await ensure("giasu-pro-yeucau@kin.local", "Cô Thử Chờ Gói");
  if (!(await prisma.proOrder.count({ where: { userId: reqId } }))) {
    await prisma.proOrder.create({ data: { userId: reqId, period: "month", durationDays: 30, priceVnd: 79000, listPriceVnd: 79000, memoCode: "KINPRO-THU00001", status: "pending" } });
  }
  return [
    "Gói Pro · giasu-pro-day@kin.local (mật khẩu chung): mở /lop-cua-toi/goi → thanh 9/10 học viên 'Gần đến hạn mức', bảng so sánh Free/Pro, 'Chưa mở bán' nếu chưa đặt KINPRO_*.",
    "Gói Pro · admin@kin.local (tên miền admin): mở /admin/goi-pro → cấu hình hạn mức/giá, số đo, yêu cầu KINPRO-THU00001 chờ kích hoạt (cần đặt KINPRO_* mới hiện nút mua phía gia sư).",
  ];
};
export default mock;
