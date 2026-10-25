// HP-18/19/24/32 — giao diện: "Phí khác của lớp" trong tab Học phí của lớp (xác nhận trước khi thêm), nút "Gộp khoản rời" trên phiếu nháp
// (xem trước, Giữ nguyên / Gộp), hộp "Giảm giá %". 390px không tràn ngang.
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Trần Gia Bảo" });
  const c = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: c.id, status: "active" } });
  const ym = vnDateKeyOf(new Date()).slice(0, 7);
  await prisma.monthlyCourseFee.create({ data: { courseId: c.id, yearMonth: ym, sessionCount: 8, updatedBy: T.id } });
  const iss = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: ym } });
  check("nền: phiếu nháp 560.000", iss.json.created[0].amountDue === 560_000);

  await launch();
  const ctx = await ctxFor(T, { width: 390, height: 844 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|font|Failed to load resource|vietqr/i.test(m.text())) errors.push(m.text()); });

  section("Phí khác của lớp");
  await page.goto(`${BASE}/lop-cua-toi/${c.id}?tab=hoc-phi`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Phí khác của lớp" }).waitFor({ timeout: 90000 });
  await page.getByText("Chưa có khoản phí khác nào").waitFor();
  check("trạng thái rỗng có lời giải thích", true);
  await page.getByLabel("Tên khoản phí").fill("Tài liệu học kỳ 1");
  await page.getByLabel(/Số tiền mỗi em/).fill("150000");
  await page.getByRole("button", { name: "Thêm cho cả lớp…" }).click();
  check("hỏi xác nhận trước khi thêm, chưa ghi gì", await page.getByText(/Thêm “Tài liệu học kỳ 1” 150\.000đ cho mỗi em/).isVisible() && (await prisma.feeCharge.count()) === 0);
  await page.getByRole("button", { name: "Giữ nguyên" }).click();
  check("'Giữ nguyên' không ghi gì", (await prisma.feeCharge.count()) === 0);
  await page.getByRole("button", { name: "Thêm cho cả lớp…" }).click();
  await page.getByRole("button", { name: "Xác nhận thêm" }).click();
  await page.getByText(/Đã thêm khoản phí cho 1 em, tổng 150\.000đ/).waitFor({ timeout: 30000 });
  // Sửa 24/10/2026: danh sách nạp lại sau toast nên phải CHỜ dòng hiện (trước đây đọc ngay → đỏ giả khi máy chậm).
  await page.getByText("Chưa vào phiếu").first().waitFor({ timeout: 30000 });
  check("thêm xong: 1 dòng 'Chưa vào phiếu' trong danh sách", await page.getByText("Chưa vào phiếu").first().isVisible() && (await prisma.feeCharge.count({ where: { kind: "extra", invoiceId: null } })) === 1);
  check("390px: không tràn ngang", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await shot(page, "hocphi-phi-khac-390");

  section("Gộp khoản rời vào phiếu nháp");
  await page.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle" });
  // Sửa 24/10/2026: số tiền trên nút nằm trong <KinMoney> (thẻ riêng) nên tên nút có khoảng trắng quanh số: regex cho phép \s*. Trang Học phí chia tab; danh sách phiếu nằm ở tab "Phiếu" (ui-invoice-reminder làm đúng như vậy).
  await page.getByRole("tab", { name: "Phiếu" }).click();
  const row = page.locator("li", { hasText: "Trần Gia Bảo" });
  await row.getByRole("button", { name: /Gộp 1 khoản rời \(\s*150\.000đ\s*\)/ }).waitFor({ timeout: 60000 });
  // Chữ hiển thị (DOM) của nút phải liền chữ "(150.000đ)", không có khoảng trắng thừa trong ngoặc; tên truy cập (a11y) có thể thêm khoảng trắng quanh <span> nên bộ chọn ở trên dùng \s*.
  const gopText = await row.getByRole("button", { name: /Gộp 1 khoản rời/ }).evaluate(e => ({ text: e.textContent ?? "", inner: (e as HTMLElement).innerText }));
  check("nút Gộp: chữ hiển thị liền '(150.000đ)', không có khoảng trắng trong ngoặc", gopText.text === "Gộp 1 khoản rời (150.000đ)" && gopText.inner === "Gộp 1 khoản rời (150.000đ)", gopText);
  await row.getByRole("button", { name: /Gộp 1 khoản rời/ }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByText(/560\.000đ → 710\.000đ/).waitFor({ timeout: 30000 });
  check("xem trước nêu 560.000đ → 710.000đ và dòng 'Tài liệu học kỳ 1'", await dlg.getByText(/Tài liệu học kỳ 1/).isVisible());
  await dlg.getByRole("button", { name: "Giữ nguyên" }).click();
  check("'Giữ nguyên' không đổi phiếu", (await prisma.tuitionInvoice.findFirstOrThrow()).amountDue === 560_000);
  await row.getByRole("button", { name: /Gộp 1 khoản rời/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Gộp vào phiếu" }).click();
  await page.getByText("Đã gộp khoản rời vào phiếu nháp.").waitFor({ timeout: 30000 });
  check("gộp xong: phiếu 710.000, nút gộp biến mất", (await prisma.tuitionInvoice.findFirstOrThrow()).amountDue === 710_000 && (await row.getByRole("button", { name: /Gộp .* khoản rời/ }).count()) === 0);

  section("Giảm giá %");
  await page.getByRole("button", { name: "Giảm giá %" }).click();
  const dd = page.getByRole("dialog");
  await dd.getByLabel(/Giảm giá của Trần Gia Bảo/).fill("20");
  await dd.getByRole("button", { name: "Lưu" }).click();
  await page.getByText(/Đã lưu giảm giá cho Trần Gia Bảo/).waitFor({ timeout: 30000 });
  check("DB: 20%", (await prisma.studentDiscount.findFirstOrThrow()).percent === 20);
  check("390px: không tràn ngang", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check("không lỗi console / pageerror", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
