// Thông báo gửi cho gia sư / người mới duyệt phải trỏ ĐÚNG chỗ (15/10/2026, rà vai gia sư).
//   - Duyệt hồ sơ gia sư: trước đây link "/admin" — cửa cũ; người vừa được duyệt còn giữ phiên HỌC VIÊN nên /admin bị đẩy sang tên miền admin (nơi cửa đăng nhập
//     không nhận gia sư) → trỏ thẳng vào khung gia sư /lop-cua-toi.
//   - Phụ huynh phản hồi xác nhận: thông báo cho gia sư chủ lớp trỏ "/admin/hoc-sinh" — trang chỉ dành cho quản trị, gia sư bấm là bị đẩy về Hộp việc, không thấy
//     học viên nào → trỏ tới tab "Học viên đăng ký" của đúng lớp (nơi hiện "Chờ phụ huynh xác nhận").
//   - Các thông báo khác dành cho gia sư (báo nghỉ sát giờ, đã gạch phiếu, cần đối soát) đã đúng — kiểm lại để không ai sửa nhầm.
import { randomBytes } from "node:crypto";
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const sup = await mkSuper("Quản lý");
  const T = await mkTutor("Cô Lan");
  const parent = await mkUser({ name: "Phụ huynh" });
  const stu = await mkUser({ name: "Học viên nhỏ" });
  const applicant = await mkUser({ name: "Ứng viên", emailVerified: true });
  await prisma.user.update({ where: { id: applicant.id }, data: { tutorAppliedAt: new Date(), bio: "Dạy Toán 9 ba năm. ".repeat(20), subjects: ["Toán"] } });
  const C = await mkCourse(T.id, { name: "Toán 6" });

  section("Duyệt hồ sơ gia sư → thông báo cho người được duyệt");
  const ok = await api("POST", `/api/admin/tutor-applications/${applicant.id}/approve`, { as: sup });
  check("duyệt → 200", ok.status === 200, ok);
  const na = await prisma.notification.findFirst({ where: { userId: applicant.id, type: "tutor_approved" } });
  check("có thông báo 'đã được duyệt'", !!na);
  check("liên kết → /lop-cua-toi (khung gia sư), không phải /admin", na?.link === "/lop-cua-toi", na?.link);

  section("Phụ huynh phản hồi → thông báo cho gia sư chủ lớp");
  const enr = await prisma.enrollment.create({ data: { userId: stu.id, courseId: C.id, status: "pending_consent" } });
  const pl = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: stu.id, status: "verified", verifiedAt: new Date() } });
  const token = randomBytes(16).toString("hex");
  await prisma.parentConsent.create({ data: { parentLinkId: pl.id, enrollmentId: enr.id, token, contentVersion: "v1", expiresAt: new Date(Date.now() + 86_400_000) } });
  const ip = `10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const r = await api("POST", `/api/parent-consents/${token}`, { body: { decision: "approved" }, headers: { "x-forwarded-for": ip } });
  check("phụ huynh đồng ý → 200 approved", r.status === 200 && r.json?.status === "approved", r);
  check("học viên được mở khoá lớp (enrollment active)", (await prisma.enrollment.findUnique({ where: { id: enr.id } }))?.status === "active");
  const nt = await prisma.notification.findFirst({ where: { userId: T.id, type: "parent_consent_responded" } });
  check("gia sư chủ lớp có thông báo", !!nt);
  check("liên kết → tab 'Học viên đăng ký' của ĐÚNG lớp (/admin/khoa-hoc/<lớp>?tab=hoc-vien), không phải /admin/hoc-sinh", nt?.link === `/admin/khoa-hoc/${C.id}?tab=hoc-vien`, nt?.link);
  const ns = await prisma.notification.findFirst({ where: { userId: stu.id, type: "parent_consent_responded" } });
  check("học viên: liên kết → /student/hoc-tap", ns?.link === "/student/hoc-tap", ns?.link);

  section("Các thông báo khác của gia sư vốn đã đúng chỗ (giữ nguyên)");
  const tutorLinks = new Map<string, string>([
    ["absence_late", "/lop-cua-toi/lich"],
    ["invoice_paid", "/lop-cua-toi/hoc-phi"],
    ["bank_tx_pending", "/lop-cua-toi/hoc-phi?tab=doi-soat"],
  ]);
  // đọc thẳng mã nguồn để không phải dựng cả luồng báo nghỉ / webhook ngân hàng ở đây (đã có t-absence, t-tt200)
  const fs = await import("node:fs");
  const absence = fs.readFileSync("src/lib/absenceServer.ts", "utf8");
  const sepay = fs.readFileSync("src/app/api/webhooks/sepay/[tutorId]/route.ts", "utf8");
  check("báo nghỉ sát giờ → /lop-cua-toi/lich", /type: "absence_late"[\s\S]{0,400}link: "\/lop-cua-toi\/lich"/.test(absence));
  check("đã gạch phiếu → /lop-cua-toi/hoc-phi", sepay.includes(`type: "invoice_paid"`) && sepay.includes(`link: "${tutorLinks.get("invoice_paid")}"`));
  check("cần đối soát → /lop-cua-toi/hoc-phi?tab=doi-soat", sepay.includes(`type: "bank_tx_pending"`) && sepay.includes(`link: "${tutorLinks.get("bank_tx_pending")}"`));

  await prisma.$disconnect();
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
