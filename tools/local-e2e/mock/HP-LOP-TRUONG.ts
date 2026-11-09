// Dữ liệu GIẢ cho HP-LOP-TRUONG: lớp tính học phí theo BẢNG THÁNG (Course.feeMode = "monthly_sheet") của giasu@kin.local.
// Bậc 1/2/3/4 môn = 70.000 / 60.000 / 55.000 / 50.000; môn Toán, Sử, Địa, Anh; 5 em tên giả; dòng của kỳ hiện tại đi QUA API THẬT
// (bật chế độ → xem trước → xác nhận), nên số trên màn là số máy chủ tính, không phải số chép tay.
// Chạy lặp lại được: lớp tìm theo tên + chủ; bật chế độ / nhập chỉ khi chưa có; lần hai xem trước ra "unchanged" nên không ghi gì.
// Không đụng lớp / phiếu của dữ liệu khác. Đặc tả: docs/kin/phong-ban/dac-ta/HP-LOP-TRUONG.md (mục 0a thắng).
import { api, mkCourse, mkUser, type TUser } from "../h";
import { issueInvoice } from "@/lib/invoiceServer";
import { vnDateKeyOf } from "@/lib/classSessions";
import type { MockCtx } from "../mock-seed";

const TAG = "(thử HP lớp trưởng)";
const COURSE_NAME = `Ôn thi vào 10 — bảng học phí tháng ${TAG}`;
const SUBJECTS = ["Toán", "Sử", "Địa", "Anh"];
const TIERS = [{ subjects: 1, rate: 70000 }, { subjects: 2, rate: 60000 }, { subjects: 3, rate: 55000 }, { subjects: 4, rate: 50000 }];
const NAMES = ["Mai Anh", "Bảo Châu", "Minh Khôi", "Gia Hân", "Tuấn Kiệt"];
const HEAD = ["Mã em", "Họ tên", "Số môn", ...SUBJECTS, "Buổi miễn phí", "Đơn giá riêng", "Học bổng", "Giảm trừ", "Ghi chú"];
const ROWS: Record<string, string | number>[] = [
  { "Họ tên": "Mai Anh", Toán: 8, Anh: 4, "Buổi miễn phí": 1, "Học bổng": 50000 },          // 2 môn → 60.000 × 11 − 50.000 = 610.000
  { "Họ tên": "Bảo Châu", Toán: 8, Sử: 8, Địa: 8, Anh: 8, "Giảm trừ": 100000 },             // 4 môn → 50.000 × 32 − 100.000 = 1.500.000
  { "Họ tên": "Minh Khôi", Toán: 8, "Đơn giá riêng": 45000 },                               // đơn giá riêng thắng bậc → 360.000
  { "Họ tên": "Gia Hân", Toán: 6, Sử: 6, "Số môn": 3 },                                     // ghi tay 3 môn → 55.000 × 12 = 660.000
  { "Họ tên": "Tuấn Kiệt", Anh: 4, "Học bổng": 300000 },                                    // 280.000 − 300.000 → 0đ (sàn 0, không FeeCharge)
];
const TEXT = [HEAD.join("\t"), ...ROWS.map(r => HEAD.map(h => String(r[h] ?? "")).join("\t"))].join("\n");
const B = (cid: string) => `/api/tutor/lop/${cid}/bang-hoc-phi`;

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  const T: TUser = { id: tutor.id, role: "admin", adminRole: "teacher", email: tutor.email, name: tutor.name };
  const base = process.env.BASE ?? "http://localhost:3000";
  const out: string[] = [];

  // 1) Lớp + 5 em (chỉ khi lớp chưa có)
  let course = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: COURSE_NAME } });
  if (!course) course = await mkCourse(tutor.id, { name: COURSE_NAME });
  const roster = await prisma.enrollment.findMany({ where: { courseId: course.id, status: "active" }, select: { user: { select: { name: true } } } });
  const have = new Set(roster.map(e => e.user.name));
  for (const n of NAMES) {
    if (have.has(n)) continue;
    const s = await mkUser({ name: n });
    await prisma.enrollment.create({ data: { userId: s.id, courseId: course.id, status: "active" } });
  }

  // 2) Bật chế độ + bảng bậc: qua API thật (409 HAS_MONEY_HISTORY nếu lớp đã có tiền theo cách cũ — không xảy ra với lớp mới)
  if (course.feeMode !== "monthly_sheet" || !(await prisma.courseFeeTable.findUnique({ where: { courseId: course.id } }))) {
    const cfg = await api("PUT", `${B(course.id)}/cau-hinh`, { as: T, body: { subjects: SUBJECTS, tiers: TIERS, enable: course.feeMode !== "monthly_sheet" } });
    if (cfg.status !== 200) throw new Error(`HP-LOP-TRUONG: đặt bảng bậc thất bại ${cfg.status} ${cfg.text.slice(0, 160)}`);
  }

  // 3) Dòng kỳ hiện tại (không truyền ym → máy chủ dùng kỳ hiện tại của lớp). Lần hai: unchanged → không ghi.
  const pv = await api("POST", `${B(course.id)}/nhap/xem-truoc`, { as: T, body: { text: TEXT } });
  if (pv.status !== 200 || pv.json?.fatal) throw new Error(`HP-LOP-TRUONG: xem trước thất bại ${pv.status} ${pv.text.slice(0, 160)}`);
  const ym: string = pv.json.yearMonth;
  if (pv.json.writable > 0) {
    const cf = await api("POST", `${B(course.id)}/nhap/xac-nhan`, { as: T, body: { text: TEXT, fileHash: pv.json.fileHash } });
    if (cf.status !== 200) throw new Error(`HP-LOP-TRUONG: xác nhận thất bại ${cf.status} ${cf.text.slice(0, 160)}`);
  }

  // 4) Một phiếu NHÁP cho Bảo Châu → dòng của em hiện "đã vào phiếu" (khoá) để thấy cột Phiếu; các em khác "Chưa lập phiếu"
  const bc = await prisma.enrollment.findFirst({ where: { courseId: course.id, user: { name: "Bảo Châu" } }, select: { userId: true } });
  if (bc && !(await prisma.tuitionInvoice.findFirst({ where: { tutorId: tutor.id, studentId: bc.userId, yearMonth: ym } }))) {
    await issueInvoice({ tutorId: tutor.id, studentId: bc.userId, yearMonth: ym });
  }

  // 5) Gia sư bộ môn (giasu2@kin.local): vào lớp nhưng KHÔNG thấy học phí
  const sub = ctx.sw.T;
  await prisma.courseTeacher.upsert({
    where: { courseId_userId: { courseId: course.id, userId: sub.id } },
    update: { role: "subject_teacher", status: "active", removedAt: null, removedBy: null },
    create: { courseId: course.id, userId: sub.id, role: "subject_teacher", subjects: ["Sử"], status: "active", invitedBy: tutor.id, respondedAt: new Date() },
  });

  const kỳ = ym === vnDateKeyOf(new Date()).slice(0, 7) ? `tháng ${ym.slice(5)}/${ym.slice(0, 4)}` : `kỳ ${ym}`;
  out.push(`${base}/lop-cua-toi/${course.id}?tab=hoc-phi (giasu@kin.local) · Bảng học phí ${kỳ} của «${COURSE_NAME}»: 5 em (Mai Anh, Bảo Châu, Minh Khôi, Gia Hân, Tuấn Kiệt), tổng Phải đóng 3.130.000đ — Mai Anh 610.000đ, Bảo Châu 1.500.000đ (đã có phiếu nháp → dòng bị khoá), Minh Khôi 360.000đ (đơn giá riêng 45.000đ), Gia Hân 660.000đ (ghi tay 3 môn), Tuấn Kiệt 0đ (học bổng lớn hơn học phí).`);
  out.push(`Cùng tab: bảng bậc 70.000 / 60.000 / 55.000 / 50.000 và 4 môn Toán, Sử, Địa, Anh (nút «Sửa bảng bậc»); «Tải mẫu Excel» → điền → «Nhập từ Excel / Google Sheet» (dán chữ tách TAB cũng được) → xem trước đủ trạng thái → «Xác nhận ghi». Bấm một em để sửa tay, thấy dòng công thức sống.`);
  out.push(`Gia sư bộ môn: đăng nhập giasu2@kin.local (đang là gia sư bộ môn môn Sử của lớp này) mở cùng địa chỉ → KHÔNG có tab Học phí; gọi ${base}${B(course.id)} → 403.`);
  return out;
}
