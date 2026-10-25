// Dữ liệu GIẢ cho HS-01/02/06/08/09, DD-07, LO-03/09/13, BC-02 (hồ sơ học sinh nhiều tab, wizard tạo lớp, link báo cáo riêng, Sổ của con có chi tiết buổi). Chạy lặp lại được.
// Lớp "Toán 9 (thử hồ sơ)" của gia sư chính: 3 em có tài khoản — Gia Bảo (đủ 12 buổi → có % chuyên cần 90 ngày, 1 phiếu chưa đóng đủ, phụ huynh liên kết, link báo cáo CHƯA bật,
// hồ sơ riêng chỉ phạm vi cơ bản nên Ghi chú / điểm buổi bị che), Hà (vắng 3 buổi liên tiếp, chưa có phụ huynh liên kết), Nam (đã nghỉ, dữ liệu vẫn còn).
// Link thử Sổ của con (đã bật sẵn) cho một em phụ: in ra cuối.
import { mkCourse, mkUser } from "../h";
import { generatePortalToken } from "@/lib/parentPortal";
import type { MockCtx } from "../mock-seed";

const TITLE = "Toán 9 (thử hồ sơ)";
const day = (ago: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - ago * 86_400_000); };

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  let c = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: TITLE } });
  if (c) return ["Hồ sơ học sinh (HS): đã có dữ liệu thử, xem /lop-cua-toi/hoc-sinh (đăng nhập giasu@kin.local)"];
  c = await mkCourse(tutor.id, { name: TITLE });
  await prisma.classSchedule.create({ data: { courseId: c.id, dayOfWeek: 5, startTime: "19:00", endTime: "20:30" } });
  const mk = async (name: string, status: string) => {
    const u = await mkUser({ name });
    await prisma.enrollment.create({ data: { userId: u.id, courseId: c!.id, status, createdAt: day(200) } });
    return u;
  };
  const bao = await mk("Trần Gia Bảo (thử)", "active"), ha = await mk("Đỗ Hà (thử)", "active"), nam = await mk("Lê Nam (thử, đã nghỉ)", "suspended");
  const par = await mkUser({ name: "Phụ huynh Gia Bảo (thử)" });
  await prisma.parentLink.create({ data: { parentId: par.id, studentId: bao.id, status: "verified", verifiedAt: new Date() } });
  for (let i = 0; i < 12; i++) {
    const s = await prisma.attendanceSession.create({ data: { courseId: c.id, date: day(i * 5 + 1), createdBy: tutor.id } });
    await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: bao.id, status: i === 3 ? "late" : i === 7 ? "absent" : "present" } });
    await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: nam.id, status: "present" } });
    if (i < 3) await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: ha.id, status: "absent" } });
  }
  await prisma.tuitionInvoice.create({ data: { code: `KINHS${Math.floor(Math.random() * 8 + 2)}${Math.floor(Math.random() * 8 + 2)}`, tutorId: tutor.id, studentId: bao.id, yearMonth: new Date().toISOString().slice(0, 7), amountDue: 480_000, paidAmount: 120_000, status: "partial" } });
  await prisma.studentProfile.create({ data: { tutorId: tutor.id, userId: bao.id, courseId: c.id, name: "Trần Gia Bảo (thử)", ageGroup: "7to15", guardianName: "Cô Hằng (thử)", guardianPhone: "0900000001", source: "manual" } });
  const prof = await prisma.studentProfile.findFirstOrThrow({ where: { userId: bao.id, tutorId: tutor.id } });
  for (const party of ["guardian", "child"]) await prisma.consentRecord.create({ data: { subjectType: "student_profile", subjectId: prof.id, party, scopes: ["basic"], method: "tutor_attestation", textVersion: "2026-10-tre-v1", givenById: tutor.id, givenByRole: "tutor" } });
  // Em phụ có link Sổ của con đã bật sẵn để xem thử trang có "Chi tiết từng buổi".
  const sub = await mkUser({ name: "Em thử Sổ của con" });
  await prisma.enrollment.create({ data: { userId: sub.id, courseId: c.id, status: "active", createdAt: day(60) } });
  const tok = generatePortalToken();
  const par2 = await mkUser({ name: "Phụ huynh em thử" });
  await prisma.parentLink.create({ data: { parentId: par2.id, studentId: sub.id, status: "verified", verifiedAt: new Date(), portalToken: tok } });
  for (const [ago, st] of [[1, "present"], [8, "late"], [15, "absent"]] as const) {
    const s = await prisma.attendanceSession.findFirst({ where: { courseId: c.id, date: day(ago) } });
    if (s) await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: sub.id, status: st } }).catch(() => {});
  }
  return [
    "HS-01: /lop-cua-toi/hoc-sinh (giasu@kin.local) — lọc Cảnh báo: Gia Bảo còn phiếu chưa đóng đủ, Hà vắng liên tiếp 3 buổi; cột Báo cáo ghi trạng thái link",
    `HS-02/08/DD-07/HS-06: bấm "Hồ sơ" ở dòng Gia Bảo — 6 tab, chuyên cần 90 ngày có %, Ghi chú bị che (thiếu đồng ý mở rộng), nút Đánh dấu đã nghỉ (Lê Nam đã nghỉ, dữ liệu còn)`,
    "HS-09/LO-13: tab Báo cáo riêng của Gia Bảo (Bật link / Copy link / Xem thử / Thu hồi ngay); tab Học sinh trong lớp có bảng link cả lớp",
    "LO-03/LO-09: /lop-cua-toi/lop/tao (wizard 3 bước, chọn em từ lớp cũ); trong lớp, nút Thêm học sinh",
    `BC-02: /so-cua-con/${tok} (không cần đăng nhập) — mục "Chi tiết từng buổi"`,
  ];
}
