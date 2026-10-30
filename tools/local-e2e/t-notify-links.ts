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
  check("liên kết → tab 'Học viên đăng ký' của ĐÚNG lớp ở bí danh gia sư (/lop-cua-toi/quan-lop/<lớp>?tab=hoc-vien, BU-00 bước 3), không phải /admin/hoc-sinh", nt?.link === `/lop-cua-toi/quan-lop/${C.id}?tab=hoc-vien`, nt?.link);
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

  section("NC2-010/011: thông báo mới của gia sư trỏ đúng chỗ");
  const inv = fs.readFileSync("src/lib/invoiceServer.ts", "utf8");
  const udaily = fs.readFileSync("src/lib/unmarkedDailyServer.ts", "utf8");
  check("phụ huynh báo đã chuyển → /lop-cua-toi/hoc-phi (kèm khoá phiếu ở tham số `phieu`, trang bỏ qua tham số này)", /type: "parent_reported"/.test(inv) && inv.includes("`/lop-cua-toi/hoc-phi?phieu=${invoiceId}`"));
  check("cả ba route 'Tôi đã chuyển' đều đi qua markParentReported (nơi báo gia sư)", ["src/app/api/phieu/[token]/reported/route.ts", "src/app/api/parent-portal/[token]/invoices/[code]/reported/route.ts", "src/app/api/users/me/invoices/[code]/reported/route.ts"].every(f => fs.readFileSync(f, "utf8").includes("markParentReported(")) && /await notifyTutorParentReported\(inv\.tutorId, inv\.id\)/.test(inv));
  check("hoc-phi của gia sư chỉ đọc `tab` (searchParams: { tab?: string }) nên tham số `phieu` lạ bị bỏ qua, trang không vỡ", /searchParams: Promise<\{ tab\?: string \}>/.test(fs.readFileSync("src/app/lop-cua-toi/(tutor)/hoc-phi/page.tsx", "utf8")));
  check("tin hôm qua chưa điểm danh → /lop-cua-toi (Hộp việc)", /type: "unmarked_daily"[\s\S]{0,200}link: "\/lop-cua-toi"/.test(udaily));

  await prisma.$disconnect();
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
