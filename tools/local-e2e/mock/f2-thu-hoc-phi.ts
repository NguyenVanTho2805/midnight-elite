// Dữ liệu GIẢ cho F2 (vòng thu học phí: hạn đóng, nhắc bước 2–3, lịch sử nhắc). Chạy lặp lại được (tìm-trước-tạo-sau). Chỉ dữ liệu giả, tên "(thử F2)".
// Cổng gói mặc định TẮT nên giasu@kin.local thấy đủ tính năng; muốn thử bản Free: chạy máy chủ với KIN_PLAN_ENFORCE=1 và dùng giasu-f2-free@kin.local.
import { mkCourse, mkTutor, mkUser } from "../h";
import { generateInvoiceCode } from "@/lib/tuitionInvoice";
import { vnDateKeyOf } from "@/lib/classSessions";
import type { MockCtx } from "../mock-seed";

const TAG = "(thử F2)";
const DAY = 24 * 3600_000;

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  const now = Date.now();
  const key = (n: number) => vnDateKeyOf(new Date(now + n * DAY));
  const ym = key(0).slice(0, 7);

  const ensureTutor = async (email: string, name: string) => {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (u) return u.id;
    const t = await mkTutor(name);
    await prisma.user.update({ where: { id: t.id }, data: { email } });
    return t.id;
  };
  const seedFor = async (tutorId: string) => {
    const cname = `Toán 8 thu học phí ${TAG}`;
    let c = await prisma.course.findFirst({ where: { ownerId: tutorId, name: cname } });
    if (c) return;
    c = await mkCourse(tutorId, { name: cname });
    await prisma.tutorPayoutAccount.upsert({ where: { userId: tutorId }, update: {}, create: { userId: tutorId, bankBin: "970436", accountNo: "0123456789", accountName: "NGUYEN VAN THU" } });
    const kids: Array<[string, { dueDate: string | null; status: string; paid: number; steps: number[] }]> = [
      [`Em Hạnh ${TAG}`, { dueDate: key(-6), status: "sent", paid: 0, steps: [1] }],          // quá hạn 6 ngày, nhắc bước 1 cách 5 ngày → đến lúc bước 2
      [`Em Khôi ${TAG}`, { dueDate: key(-9), status: "partial", paid: 500_000, steps: [1, 2] }], // đã nhắc bước 1 và 2 → đến lúc bước 3
      [`Em Lam ${TAG}`, { dueDate: key(8), status: "sent", paid: 0, steps: [] }],             // chưa tới hạn, chưa nhắc
      [`Em Mai ${TAG}`, { dueDate: null, status: "sent", paid: 0, steps: [] }],               // chưa đặt hạn: tin Zalo vẫn ghi "hạn trước ngày 20"
      [`Em Nam ${TAG}`, { dueDate: key(-3), status: "parent_reported", paid: 0, steps: [1] }], // phụ huynh đã báo chuyển: không nhắc thêm
    ];
    for (const [name, o] of kids) {
      const s = await mkUser({ name });
      await prisma.user.update({ where: { id: s.id }, data: { parentName: "Phụ huynh thử", parentPhone: "0900000000" } });
      await prisma.enrollment.create({ data: { userId: s.id, courseId: c.id, status: "active" } });
      const inv = await prisma.tuitionInvoice.create({ data: {
        code: generateInvoiceCode(), tutorId, studentId: s.id, yearMonth: ym, amountDue: 1_200_000, paidAmount: o.paid, status: o.status,
        sentAt: new Date(now - 14 * DAY), dueDate: o.dueDate, parentReportedAt: o.status === "parent_reported" ? new Date(now - 3600_000) : null,
        zaloOpenedAt: o.steps.length ? new Date(now - (o.steps.includes(2) ? 4 : 5) * DAY) : null,
        viewToken: `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.padEnd(32, "b").slice(0, 32), viewTokenExpiresAt: new Date(now + 20 * DAY),
      } });
      for (const st of o.steps) await prisma.invoiceReminder.create({ data: { invoiceId: inv.id, tutorId, step: st, openedAt: new Date(now - (st === 1 ? 9 : 4) * DAY) } });
    }
  };

  await seedFor(tutor.id);
  const free = await ensureTutor("giasu-f2-free@kin.local", "Cô Thử Free F2");
  await seedFor(free);
  return [
    `F2 · giasu@kin.local: mở /lop-cua-toi/hoc-phi → tab Phiếu. Thấy 5 phiếu "(thử F2)": Em Hạnh quá hạn 6 ngày + nút "Nhắc bước 2 (đến lúc)"; Em Khôi nút "Nhắc bước 3 (đến lúc)"; "Lịch sử nhắc" cho từng em; "Đặt hạn đóng"; ô "Quá hạn" và hộp lọc phiếu quá hạn.`,
    `F2 · cùng tài khoản: mở /lop-cua-toi (Hộp việc) → dòng "2 phiếu đến lúc nhắc bước 2–3 (quá hạn tới 9 ngày)". Em Nam (phụ huynh đã báo chuyển) không bị nhắc thêm.`,
    `F2 · bản Free: chạy máy chủ với KIN_PLAN_ENFORCE=1 rồi vào bằng giasu-f2-free@kin.local (mật khẩu chung): thấy công nợ, quá hạn và bước 1 bình thường; bước 2–3, đặt hạn, lịch sử mờ kèm "Có trong KiN Pro" và nút "Xem gói".`,
    `F2 · phụ huynh: mở link /phieu/<mã> của một phiếu có hạn (lấy từ nút "Gửi phiếu qua Zalo") → thấy "Hạn đóng: dd/mm/yyyy", không có lời mời Pro.`,
  ];
}
