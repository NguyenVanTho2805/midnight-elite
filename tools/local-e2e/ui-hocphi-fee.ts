// HP-15/HP-16/HP-17 — giao diện: Tạo lớp có mục "Cách tính học phí" (mặc định cách cũ), tab Học phí của lớp kiểu mới
// (đơn giá hiện hành, đổi đơn giá có ngày hiệu lực + xem trước + Giữ nguyên / Áp dụng, đơn giá riêng từng em), lớp cũ giữ lối vào cũ.
import { mkUser, mkTutor, mkCourse, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const legacy = await mkCourse(T.id, { name: "Toán lớp cũ" });
  await launch();
  const ctx = await ctxFor(T, { width: 390, height: 844 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|font|Failed to load resource/i.test(m.text())) errors.push(m.text()); });

  section("Tạo lớp: Cách tính học phí");
  await page.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Cách tính học phí" }).waitFor({ timeout: 90000 });
  check("mặc định = cách hiện tại (theo số buổi trong tháng), không có ô đơn giá", await page.getByRole("radio", { name: /Theo số buổi trong tháng/ }).isChecked() && (await page.getByLabel(/Đơn giá/).count()) === 0);
  await page.getByLabel("Tên lớp *").fill("Lý lớp mới");
  await page.getByRole("radio", { name: /^Theo giờ/ }).check();
  await page.getByLabel(/Đơn giá \(đ \/ giờ\)/).fill("200000");
  await page.getByLabel(/Một buổi dài/).fill("90");
  check("theo giờ nhắc lại số buổi 90 phút = 300.000đ (hàm lib, làm tròn từng buổi)", await page.getByText(/Mỗi buổi 90 phút tính 300\.000đ/).isVisible());
  // Sửa 24/10/2026: màn Tạo lớp giờ là 3 bước (Thông tin → Học sinh → Lịch), nút tạo lớp chỉ ở bước 3; bỏ qua học sinh và lịch để làm sau. Cách tính học phí vẫn ở bước 1.
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: "Tạo lớp", exact: true }).click();
  await page.waitForURL(/\/lop-cua-toi\/ly-lop-moi/, { timeout: 60000 });
  const created = await prisma.course.findFirstOrThrow({ where: { name: "Lý lớp mới" } });
  check("DB: lớp theo giờ + 1 dòng đơn giá 200.000/giờ × 90 phút", created.feeMode === "per_hour" && (await prisma.courseFeeRate.findFirstOrThrow({ where: { courseId: created.id } })).sessionMinutes === 90);

  section("Tab Học phí của lớp kiểu mới");
  await page.goto(`${BASE}/lop-cua-toi/${created.id}?tab=hoc-phi`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Cách tính hiện tại" }).waitFor({ timeout: 90000 });
  check("hiện đơn giá hiện hành 200.000đ / giờ, mỗi buổi 90 phút", await page.getByText(/200\.000đ \/ giờ|200\.000đ giờ/).first().isVisible().catch(() => false) || await page.getByText(/200\.000đ/).first().isVisible());
  check("lịch sử ghi 'Từ khi tạo lớp'", await page.getByText(/Từ khi tạo lớp/).first().isVisible());
  const stu = await mkUser({ name: "Em Hà" });
  await prisma.enrollment.create({ data: { userId: stu.id, courseId: created.id, status: "active" } });
  const today = vnDateKeyOf(new Date());
  const sess = await prisma.attendanceSession.create({ data: { courseId: created.id, date: new Date(`${today}T00:00:00Z`), createdBy: T.id } });
  const rec = await prisma.attendanceRecord.create({ data: { sessionId: sess.id, userId: stu.id, status: "present" } });
  await prisma.feeCharge.create({ data: { tutorId: T.id, courseId: created.id, studentId: stu.id, kind: "session", recordId: rec.id, dateKey: today, yearMonth: today.slice(0, 7), amount: 300_000, units: 90, rate: 200_000, mode: "per_hour" } });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Đổi đơn giá cả lớp" }).waitFor({ timeout: 60000 });
  await page.getByLabel(/Đơn giá mới/).fill("240000");
  await page.getByRole("button", { name: "Xem trước tác động" }).first().click();
  await page.getByText("Xem trước tác động (chưa lưu gì)").waitFor({ timeout: 30000 });
  check("xem trước: 1 dòng chưa vào phiếu đổi 300.000đ → 360.000đ (+60.000đ); đóng băng 0 dòng", await page.getByText(/1 dòng học phí chưa vào phiếu sẽ đổi: tổng 300\.000đ → 360\.000đ \(\+60\.000đ\)/).isVisible() && await page.getByText(/0 dòng đã vào phiếu/).isVisible());
  check("xem trước chưa ghi gì", (await prisma.courseFeeRate.count({ where: { courseId: created.id } })) === 1 && (await prisma.feeCharge.findFirstOrThrow({ where: { courseId: created.id } })).amount === 300_000);
  await page.getByRole("button", { name: "Giữ nguyên" }).click();
  check("'Giữ nguyên' tắt khung xem trước", (await page.getByText("Xem trước tác động (chưa lưu gì)").count()) === 0);
  await page.getByRole("button", { name: "Xem trước tác động" }).first().click();
  await page.getByRole("button", { name: "Áp dụng đơn giá mới" }).click();
  await page.getByText("Đã đổi đơn giá.").waitFor({ timeout: 30000 });
  check("áp dụng: dòng phí 360.000, có 2 mốc đơn giá", (await prisma.feeCharge.findFirstOrThrow({ where: { courseId: created.id } })).amount === 360_000 && (await prisma.courseFeeRate.count({ where: { courseId: created.id } })) === 2);
  await page.getByRole("heading", { name: "Lịch sử đơn giá" }).waitFor();
  await page.getByLabel("Học sinh").selectOption(stu.id);
  await page.getByLabel(/Đơn giá \(đ \/ giờ\)/).fill("150000");
  await page.getByRole("button", { name: "Xem trước tác động" }).last().click();
  await page.getByText(/360\.000đ → 225\.000đ/).waitFor({ timeout: 30000 });
  check("đơn giá riêng: xem trước 360.000đ → 225.000đ (150.000/giờ × 90 phút)", true);
  check("390px: không tràn ngang", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await shot(page, "hocphi-lop-moi-390");

  section("Lớp cũ giữ nguyên");
  await page.goto(`${BASE}/lop-cua-toi/${legacy.id}?tab=hoc-phi`, { waitUntil: "networkidle" });
  await page.getByText(/tính học phí theo số buổi trong tháng, như cách cô đang dùng/).waitFor({ timeout: 60000 });
  check("lớp cũ: không có khung đổi đơn giá, vẫn có lối vào Học phí", (await page.getByRole("heading", { name: "Đổi đơn giá cả lớp" }).count()) === 0 && await page.getByRole("link", { name: "Mở Học phí" }).isVisible());
  check("không lỗi console / pageerror", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
