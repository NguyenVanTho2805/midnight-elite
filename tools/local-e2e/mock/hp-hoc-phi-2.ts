// Dữ liệu GIẢ cho HP-14..HP-21, HP-24, HP-32 (học phí kiểu mới, hoàn tác khoản đã thu, phí khác, gộp khoản rời, giảm giá %).
// Chạy lặp lại được (tìm-trước-tạo-sau). Chỉ dữ liệu giả rõ ràng (tên "(thử HP)"). Không đụng lớp/phiếu của dữ liệu khác.
import { mkCourse, mkUser } from "../h";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import { issueInvoice } from "@/lib/invoiceServer";
import { createInitialFeeRate, syncSessionCharges } from "@/lib/feeChargeServer";
import type { MockCtx } from "../mock-seed";

const TAG = "(thử HP)";

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  const today = vnDateKeyOf(new Date());
  const ym = today.slice(0, 7);
  const out: string[] = [];

  // (a) Lớp THEO BUỔI 150.000đ, 2 em, 3 buổi đã điểm danh → học phí tự sinh
  const nameS = `Toán 7 theo buổi ${TAG}`;
  let cS = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: nameS } });
  if (!cS) {
    cS = await mkCourse(tutor.id, { name: nameS });
    await prisma.$transaction(async tx => {
      await tx.course.update({ where: { id: cS!.id }, data: { feeMode: "per_session" } });
      await createInitialFeeRate(tx, cS!.id, { mode: "per_session", rate: 150_000, sessionMinutes: null }, tutor.id);
    });
    const kids = [await mkUser({ name: `Em Lan ${TAG}` }), await mkUser({ name: `Em Minh ${TAG}` })];
    for (const k of kids) await prisma.enrollment.create({ data: { userId: k.id, courseId: cS.id, status: "active" } });
    for (const [i, status] of [["present", "late"], ["present", "excused"], ["present", "present"]].entries()) {
      const date = new Date(`${addDaysKey(today, -(i + 1) * 2)}T00:00:00Z`);
      // Từ 24/10/2026 dòng phí chỉ sinh khi buổi ĐÃ CHỐT: dữ liệu giả tạo buổi ở trạng thái đã chốt.
      const sess = await prisma.attendanceSession.create({ data: { courseId: cS.id, date, createdBy: tutor.id, state: "closed", closedAt: new Date(), closedBy: tutor.id } });
      for (const [j, k] of kids.entries()) await prisma.attendanceRecord.create({ data: { sessionId: sess.id, userId: k.id, status: status[j] } });
      await prisma.$transaction(tx => syncSessionCharges(tx, { sessionId: sess.id, courseId: cS!.id, sessionDate: date, by: tutor.id, items: kids.map((k, j) => ({ userId: k.id, status: status[j], makeupUsed: false })) }));
    }
  }
  out.push(`Lớp "${nameS}" (đơn giá 150.000đ/buổi) của giasu@kin.local: mở /lop-cua-toi/${cS.id}?tab=hoc-phi để đổi đơn giá có ngày hiệu lực + xem trước, đặt đơn giá riêng từng em, thêm "Phí khác của lớp". Học phí đã tự sinh từ 3 buổi điểm danh (có phép không tính).`);

  // (b) Phiếu có dòng phí mới + một khoản ghi tay để thử HOÀN TÁC
  const stu = (await prisma.enrollment.findMany({ where: { courseId: cS.id }, select: { userId: true } }))[0].userId;
  let inv = await prisma.tuitionInvoice.findFirst({ where: { tutorId: tutor.id, studentId: stu, yearMonth: ym } });
  if (!inv) {
    const r = await issueInvoice({ tutorId: tutor.id, studentId: stu, yearMonth: ym });
    if (r.ok) {
      inv = await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: r.invoice.id } });
      await prisma.tuitionInvoice.update({ where: { id: inv.id }, data: { status: "sent", sentAt: new Date() } });
    }
  }
  if (inv && !(await prisma.bankTransaction.findFirst({ where: { invoiceId: inv.id, provider: "manual" } }))) {
    const paid = Math.min(100_000, Math.max(1, inv.amountDue - 1));
    await prisma.$transaction(async tx => {
      const b = await tx.bankTransaction.create({ data: { tutorId: tutor.id, provider: "manual", providerTxId: `manual-mock-hp-${inv!.id}`, occurredAt: new Date(), amount: paid, appliedAmount: paid, content: "Chuyển khoản / ghi tay", method: "bank_transfer", matchedCode: inv!.code, invoiceId: inv!.id, kind: "short", status: "resolved", resolution: "manual_cash", resolvedBy: tutor.id, resolvedAt: new Date() } });
      await tx.tuitionInvoice.update({ where: { id: inv!.id }, data: { paidAmount: paid, status: "partial" } });
      return b;
    });
  }
  out.push(`/lop-cua-toi/hoc-phi tab Phiếu: phiếu tháng ${ym} của "Em Lan ${TAG}" có dòng phí theo buổi và một khoản đã thu ghi tay (chuyển khoản, ngày hôm nay). Bấm "Khoản đã thu" → "Hoàn tác…" để xem màn rà soát (Giữ nguyên / Xác nhận hoàn tác).`);

  // (c) Phí khác + phiếu nháp để thử "Gộp khoản rời" và "Giảm giá %"
  const second = (await prisma.enrollment.findMany({ where: { courseId: cS.id }, select: { userId: true } }))[1].userId;
  if (!(await prisma.tuitionInvoice.findFirst({ where: { tutorId: tutor.id, studentId: second, yearMonth: ym } }))) {
    await issueInvoice({ tutorId: tutor.id, studentId: second, yearMonth: ym });
  }
  if (!(await prisma.feeCharge.findFirst({ where: { courseId: cS.id, kind: "extra", studentId: second } }))) {
    await prisma.feeCharge.create({ data: { tutorId: tutor.id, courseId: cS.id, studentId: second, kind: "extra", dateKey: today, yearMonth: ym, amount: 80_000, rateSource: "class", mode: "extra", label: `Tài liệu ${TAG}` } });
  }
  out.push(`Tab Phiếu: phiếu NHÁP tháng ${ym} của "Em Minh ${TAG}" có nút "Gộp 1 khoản rời (80.000đ)" (phí khác thêm sau khi lập phiếu); nút "Giảm giá %" ở đầu tab để đặt giảm giá phần trăm cho từng em.`);
  return out;
}
