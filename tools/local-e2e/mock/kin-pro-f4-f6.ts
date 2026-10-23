// KiN Pro F4 (thống kê chuyên cần nâng cao) + F5 (ô lượt AI) + F6 (hỗ trợ ưu tiên) — dữ liệu giả. Chạy lặp lại được (tìm-trước-tạo-sau).
//  - giasu-pro-thongke@kin.local: gia sư PRO (tặng 20 ngày), 1 lớp 6 em, 6 buổi điểm danh trong 6 tuần; em "Em Thử Vắng" vắng/có phép 3 buổi mới nhất.
//  - giasu-free-thongke@kin.local: gia sư FREE, cùng kiểu dữ liệu → khối nâng cao hiện đủ khi cổng TẮT, bị mờ "Có trong KiN Pro" khi chạy máy chủ với KIN_PLAN_ENFORCE=1.
//  - Hỗ trợ: một yêu cầu Pro (Ưu tiên), một yêu cầu Free, một "lỗi nghiêm trọng" của Free (làn Khẩn) để admin thấy thứ tự hàng đợi.
import type { MockFn } from "../mock-seed";
import { mkCourse, mkTutor, mkUser } from "../h";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";

const DAY = 86_400_000;
const mock: MockFn = async ({ prisma }) => {
  const today = vnDateKeyOf(new Date());
  const ensure = async (email: string, name: string) => {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (u) return u.id;
    const t = await mkTutor(name);
    await prisma.user.update({ where: { id: t.id }, data: { email } });
    return t.id;
  };
  const seedClass = async (ownerId: string) => {
    if (await prisma.course.count({ where: { ownerId, name: "Toán 9 thử thống kê" } })) return;
    const c = await mkCourse(ownerId, { name: "Toán 9 thử thống kê" });
    const studs = [];
    for (let i = 0; i < 6; i++) {
      const s = await mkUser({ name: i === 0 ? "Em Thử Vắng" : `Em Thử ${i}` }); studs.push(s);
      await prisma.enrollment.create({ data: { userId: s.id, courseId: c.id, status: "active", createdAt: new Date(Date.now() - 90 * DAY) } });
    }
    const offs = [1, 3, 8, 15, 22, 36];
    for (let j = 0; j < offs.length; j++) {
      const sess = await prisma.attendanceSession.create({ data: { courseId: c.id, date: new Date(`${addDaysKey(today, -offs[j])}T00:00:00.000Z`), createdBy: ownerId } });
      await prisma.attendanceRecord.createMany({ data: studs.map((s, i) => ({ sessionId: sess.id, userId: s.id, status: i === 0 && j <= 2 ? (j === 1 ? "excused" : "absent") : (i + j) % 7 === 0 ? "late" : (i * 3 + j) % 11 === 0 ? "absent" : "present" })) });
    }
  };
  const proId = await ensure("giasu-pro-thongke@kin.local", "Cô Thử Pro Thống Kê");
  const freeId = await ensure("giasu-free-thongke@kin.local", "Cô Thử Free Thống Kê");
  await seedClass(proId); await seedClass(freeId);
  if (!(await prisma.proOrder.count({ where: { userId: proId } }))) {
    await prisma.proOrder.create({ data: { userId: proId, period: "grant", durationDays: 20, priceVnd: 0, listPriceVnd: 0, source: "admin_grant", memoCode: "KINPRO-THUSTAT1", status: "active", startDate: new Date(Date.now() - DAY), endDate: new Date(Date.now() + 20 * DAY) } });
  }
  if (!(await prisma.supportRequest.count({ where: { subject: { startsWith: "[Thử]" } } }))) {
    const t0 = Date.now();
    const mk = (userId: string, kind: string, subject: string, plan: string, ago: number) => prisma.supportRequest.create({ data: { userId, kind, subject, message: "Nội dung thử, không có dữ liệu học sinh. Mô tả việc đang kẹt để thử hàng đợi hỗ trợ.", planAtSend: plan, createdAt: new Date(t0 - ago * 60_000) } });
    await mk(freeId, "other", "[Thử] Hỏi chung từ gia sư Free", "free", 120);
    await mk(proId, "setup", "[Thử] Kẹt lúc nối SePay (Pro)", "pro", 30);
    await mk(freeId, "serious", "[Thử] Lỗi nghiêm trọng của gia sư Free", "free", 10);
  }
  return [
    "Thống kê chuyên cần · giasu-pro-thongke@kin.local (mật khẩu chung): mở /lop-cua-toi/doanh-thu, cuộn xuống 'Chuyên cần của các lớp' → xu hướng 8 tuần / 6 tháng, 'Em Thử Vắng' vắng 3 buổi liên tiếp, so sánh lớp.",
    "Thống kê chuyên cần · giasu-free-thongke@kin.local: cùng trang; máy chủ mặc định (cổng TẮT) hiện đủ, chạy máy chủ với KIN_PLAN_ENFORCE=1 thì khối mờ 'Có trong KiN Pro' + nút tới /lop-cua-toi/goi, số cơ bản phía trên vẫn đủ.",
    "Lượt AI · đăng nhập gia sư, /admin/thi-thu → '+ Tạo đề thi mới': dòng 'Còn 3 lượt AI trích đề tháng này' (Pro: 20) kèm nút xem gói.",
    "Hỗ trợ · gia sư mở /lop-cua-toi/ho-tro (Khác → Liên hệ hỗ trợ): gửi yêu cầu, Pro có nhãn 'Ưu tiên'. Admin (tên miền admin) mở /admin/ho-tro: hàng đợi Khẩn → Ưu tiên → Thường, trả lời được và gia sư thấy lại.",
  ];
};
export default mock;
