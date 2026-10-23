// KiN Pro F3 "Giấy tờ có thương hiệu" (báo cáo tháng) — dữ liệu giả. Tháng báo cáo = tháng TRƯỚC (giờ VN).
//  - giasu-pro-giayto@kin.local : Pro còn hạn, đã cài thương hiệu "Lớp Toán cô Thử"; Minh Anh đã duyệt + đã tạo bản có thương hiệu; Bảo Bình đã duyệt, CHƯA tạo.
//  - giasu-free-giayto@kin.local : Free (chưa có đơn Pro); Chi Chi đã duyệt. Cổng gói mặc định TẮT nên nút Pro vẫn mở; chạy máy chủ với KIN_PLAN_ENFORCE=1 để thấy khoá.
//  - giasu-hethan-giayto@kin.local : Pro đã HẾT hạn, có một bản đã tạo (xem lại được) và một báo cáo đã duyệt chưa tạo (mới bị chặn khi cổng bật).
import type { MockFn } from "../mock-seed";
import { mkCourse, mkTutor, mkUser } from "../h";
import { loadStudentMonth } from "@/lib/monthlyReportServer";
import { prevYearMonth } from "@/lib/monthlyReport";
import { vnMonthKey } from "@/lib/revenue";

const DAY = 86_400_000;

const mock: MockFn = async ({ prisma }) => {
  const ym = prevYearMonth(vnMonthKey(new Date()));
  const ensureTutor = async (email: string, name: string) => {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (u) return u.id;
    const t = await mkTutor(name);
    await prisma.user.update({ where: { id: t.id }, data: { email } });
    return t.id;
  };
  const day = (d: number) => new Date(`${ym}-${String(d).padStart(2, "0")}T12:00:00+07:00`);
  const approve = async (tutorId: string, studentId: string, branded?: { displayName: string; accent: string; signature: string }) => {
    const data = await loadStudentMonth(tutorId, studentId, ym);
    if (!data) return;
    const items = [{ text: "Cô sẽ dành thêm 10 phút mỗi buổi để giải lại phần em chưa vững.", kind: "tu-viet" }];
    const snapshot = { subjects: data.subjects, studentName: data.student.name };
    const common = { approvedItems: items, approvedSnapshot: snapshot, approvedAt: new Date(), draftItems: items, ...(branded ? { brandedAt: new Date(), brandSnapshot: branded } : {}) };
    await prisma.monthlyReport.upsert({
      where: { tutorId_studentId_yearMonth: { tutorId, studentId, yearMonth: ym } },
      create: { tutorId, studentId, yearMonth: ym, ...common }, update: common,
    });
  };
  const setup = async (email: string, name: string, className: string, students: string[]) => {
    const tutorId = await ensureTutor(email, name);
    if (await prisma.monthlyReport.count({ where: { tutorId, yearMonth: ym } })) return { tutorId, ids: [] as string[] };
    const c = await mkCourse(tutorId, { name: className });
    const ids: string[] = [];
    for (const n of students) {
      const s = await mkUser({ name: n });
      ids.push(s.id);
      await prisma.enrollment.create({ data: { userId: s.id, courseId: c.id, status: "active" } });
      for (const [d, sc] of [[5, 8], [15, 7.5], [25, 9]] as const) {
        const eid = `mockf3-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        await prisma.exam.create({ data: { id: eid, code: eid, title: "Kiểm tra thử", category: "Toán", date: "01/01/2020", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2020", courseId: c.id } });
        await prisma.examResult.create({ data: { userId: s.id, examId: eid, score: sc * 15, totalPoints: 150, completedAt: day(d) } });
      }
    }
    for (const [d, st] of [[3, "present"], [10, "present"], [17, "late"], [24, "present"]] as const) {
      const a = await prisma.attendanceSession.create({ data: { courseId: c.id, date: new Date(`${ym}-${String(d).padStart(2, "0")}T00:00:00Z`), createdBy: tutorId } });
      for (const uid of ids) await prisma.attendanceRecord.create({ data: { sessionId: a.id, userId: uid, status: st } });
    }
    return { tutorId, ids };
  };

  const pro = await setup("giasu-pro-giayto@kin.local", "Cô Thử Pro Giấy Tờ", "Toán 9 (thử Pro)", ["Minh Anh (thử)", "Bảo Bình (thử)"]);
  const free = await setup("giasu-free-giayto@kin.local", "Cô Thử Free Giấy Tờ", "Toán 9 (thử Free)", ["Chi Chi (thử)"]);
  const old = await setup("giasu-hethan-giayto@kin.local", "Cô Thử Hết Hạn Giấy Tờ", "Toán 9 (thử hết hạn)", ["Duy Dũng (thử)", "Hà My (thử)"]);

  if (pro.ids.length) {
    await prisma.proOrder.create({ data: { userId: pro.tutorId, period: "month", durationDays: 30, priceVnd: 0, listPriceVnd: 79000, source: "admin_grant", memoCode: `KINPRO-MOCKF3P${Date.now().toString(36)}`.toUpperCase().slice(0, 20), status: "active", startDate: new Date(Date.now() - 5 * DAY), endDate: new Date(Date.now() + 25 * DAY) } });
    const brand = { displayName: "Lớp Toán cô Thử", accent: "luc", signature: "Chúc em tiến bộ mỗi ngày" };
    await prisma.tutorDocBrand.upsert({ where: { userId: pro.tutorId }, create: { userId: pro.tutorId, ...brand }, update: brand });
    await approve(pro.tutorId, pro.ids[0], brand);
    await approve(pro.tutorId, pro.ids[1]);
  }
  if (free.ids.length) await approve(free.tutorId, free.ids[0]);
  if (old.ids.length) {
    await prisma.proOrder.create({ data: { userId: old.tutorId, period: "month", durationDays: 30, priceVnd: 0, listPriceVnd: 79000, source: "admin_grant", memoCode: `KINPRO-MOCKF3X${Date.now().toString(36)}`.toUpperCase().slice(0, 20), status: "active", startDate: new Date(Date.now() - 60 * DAY), endDate: new Date(Date.now() - 30 * DAY) } });
    const brand = { displayName: "Lớp Cô Thử (cũ)", accent: "xanh-link", signature: "" };
    await prisma.tutorDocBrand.upsert({ where: { userId: old.tutorId }, create: { userId: old.tutorId, ...brand }, update: brand });
    await approve(old.tutorId, old.ids[0], brand);
    await approve(old.tutorId, old.ids[1]);
  }
  return [
    `Giấy tờ Pro · giasu-pro-giayto@kin.local (mật khẩu chung): /lop-cua-toi/bao-cao-thang → bấm lùi về tháng ${ym.slice(5)}/${ym.slice(0, 4)}, mở “Thương hiệu giấy tờ” (đã cài), mở Minh Anh → “In bản có thương hiệu” (tên + màu xanh lá + chữ ký); mở Bảo Bình → “Tạo bản in có thương hiệu”.`,
    "Giấy tờ Free · giasu-free-giayto@kin.local: cùng trang, mở Chi Chi → “In / PDF (mẫu KiN)” luôn dùng được. Nút Pro chỉ KHOÁ khi chạy máy chủ với KIN_PLAN_ENFORCE=1 (xem .local-dev/HUONG-DAN.md); mặc định cổng TẮT nên không chặn ai.",
    "Giấy tờ hết hạn · giasu-hethan-giayto@kin.local: Duy Dũng có bản đã tạo (vẫn in được thương hiệu cũ); Hà My chưa tạo (bị chặn khi KIN_PLAN_ENFORCE=1).",
  ];
};
export default mock;
