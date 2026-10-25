// Dữ liệu GIẢ cho HP-14 (chốt buổi sinh phí), HP-28 (gợi ý phí trễ hạn), HP-31 (gói buổi trả trước + sổ sử dụng).
// Chạy SAU hp-hoc-phi-2 (cùng lớp "Toán 7 theo buổi (thử HP)"). Chạy lặp lại được (tìm-trước-tạo-sau). Chỉ dữ liệu giả rõ ràng.
import { randomBytes } from "node:crypto";
import { mkUser } from "../h";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import { syncChargesOnClose } from "@/lib/feeChargeServer";
import { createPackage, syncPackageUsesForSession } from "@/lib/sessionPackageServer";
import type { MockCtx } from "../mock-seed";

const TAG = "(thử HP)";

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  const out: string[] = [];
  const today = vnDateKeyOf(new Date());
  const cS = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: `Toán 7 theo buổi ${TAG}` } });
  if (!cS) return ["HP-31: chưa có lớp 'Toán 7 theo buổi (thử HP)' (chạy hp-hoc-phi-2 trước)."];
  const kid = (await prisma.enrollment.findMany({ where: { courseId: cS.id, status: "active" }, orderBy: { userId: "asc" } }))[0];
  if (!kid) return ["HP-31: lớp thử chưa có em nào."];

  // (a) Buổi CHƯA chốt: lưu điểm danh nhưng chưa có học phí (HP-14)
  const dOpen = addDaysKey(today, -1);
  let open = await prisma.attendanceSession.findFirst({ where: { courseId: cS.id, date: new Date(`${dOpen}T00:00:00Z`) } });
  if (!open) {
    open = await prisma.attendanceSession.create({ data: { courseId: cS.id, date: new Date(`${dOpen}T00:00:00Z`), createdBy: tutor.id } });
    await prisma.attendanceRecord.create({ data: { sessionId: open.id, userId: kid.userId, status: "present" } });
  }
  out.push(`HP-14: lớp "Toán 7 theo buổi ${TAG}" · buổi ${dOpen} đã điểm danh nhưng CHƯA chốt → chưa có học phí. Mở /lop-cua-toi/buoi/${cS.id}/${dOpen}, bấm "Đã dạy xong" thì học phí của buổi mới sinh.`);

  // (b) Gói buổi trả trước 5 buổi cho em đầu tiên + 1 buổi đã chốt SAU khi lập gói (trừ 1)
  let pkg = await prisma.sessionPackage.findFirst({ where: { courseId: cS.id, studentId: kid.userId, note: `gói thử ${TAG}` } });
  if (!pkg) {
    const c = await createPackage({ courseId: cS.id, by: tutor.id, input: { studentId: kid.userId, sessions: 5, note: `gói thử ${TAG}` } });
    if (c.ok) pkg = await prisma.sessionPackage.findUnique({ where: { id: c.id } });
    const dClosed = addDaysKey(today, 0);
    let closed = await prisma.attendanceSession.findFirst({ where: { courseId: cS.id, date: new Date(`${dClosed}T00:00:00Z`) } });
    if (!closed) {
      closed = await prisma.attendanceSession.create({ data: { courseId: cS.id, date: new Date(`${dClosed}T00:00:00Z`), createdBy: tutor.id } });
      await prisma.attendanceRecord.create({ data: { sessionId: closed.id, userId: kid.userId, status: "late" } });
    }
    await prisma.attendanceSession.update({ where: { id: closed.id }, data: { state: "closed", closedAt: new Date(), closedBy: tutor.id } });
    await prisma.$transaction(async tx => { await syncChargesOnClose(tx, closed!.id, tutor.id); await syncPackageUsesForSession(tx, closed!.id); });
  }
  out.push(`HP-31: gói 5 buổi của một em ở lớp thử (đã trừ 1 buổi). Gia sư xem ở /lop-cua-toi/${cS.id}?tab=hoc-phi → "Gói buổi trả trước"; giasu@kin.local. Sổ buổi KHÔNG thu tiền.`);

  // (c) Phụ huynh của em đó xem Sổ của con
  let link = await prisma.parentLink.findFirst({ where: { studentId: kid.userId, status: "verified", portalToken: { not: null } } });
  if (!link) {
    const parent = await mkUser({ name: `Phụ huynh ${TAG}` });
    link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: kid.userId, status: "verified", verifiedAt: new Date(), portalToken: randomBytes(16).toString("hex") } });
  }
  out.push(`HP-31: phụ huynh xem số buổi còn lại ở /so-cua-con/${link.portalToken} (mục "Gói buổi trả trước", không giá).`);

  // (d) Phiếu quá hạn để thấy gợi ý phí trễ hạn (HP-28)
  const ym = today.slice(0, 7);
  const lateKid = (await prisma.enrollment.findMany({ where: { courseId: cS.id, status: "active" }, orderBy: { userId: "desc" } }))[0];
  if (lateKid && !(await prisma.tuitionInvoice.findFirst({ where: { tutorId: tutor.id, studentId: lateKid.userId, code: { startsWith: "KINTRE" } } }))
      && !(await prisma.tuitionInvoice.findFirst({ where: { tutorId: tutor.id, studentId: lateKid.userId, yearMonth: ym } }))) {
    await prisma.tuitionInvoice.create({ data: { code: `KINTRE${randomBytes(2).toString("hex").toUpperCase()}`, tutorId: tutor.id, studentId: lateKid.userId, yearMonth: ym, amountDue: 450_000, status: "sent", dueDate: addDaysKey(today, -5) } });
  }
  out.push(`HP-28: /lop-cua-toi/hoc-phi → tab Phiếu: phiếu quá hạn 5 ngày có dòng "Gợi ý: có thể thu thêm phí trễ hạn — KiN không tự cộng tiền." (bật/tắt bằng ô ngay trên danh sách).`);
  return out;
}
