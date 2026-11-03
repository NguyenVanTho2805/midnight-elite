import { mkUser, mkTutor, mkSuper, wipe, check, eventually, section, done, BASE } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

async function applicant(name: string, emailVerified: boolean) {
  const u = await mkUser({ name, emailVerified });
  await prisma.user.update({ where: { id: u.id }, data: { tutorAppliedAt: new Date(), bio: "Dạy Toán 9 ba năm, đã đỗ chuyên Toán. ".repeat(10), subjects: ["Toán", "Lý"], city: "Hà Nội" } });
  return u;
}

(async () => {
  await wipe();
  const sup = await mkSuper("Quản lý Một");
  const teacher = await mkTutor("Gia sư Thường");
  const ok = await applicant("Ứng viên Hợp lệ", true);
  const unv = await applicant("Ứng viên Chưa Xác Thực", false);
  await launch();

  // BU-08: trang /admin/ho-so-gia-su và hộp thoại từ chối đã được thay bằng HÀNG CHỜ một cửa (/admin/kiem-duyet?loai=gia-su, panel bên). Đường cũ vẫn mở được qua 308.
  section("Hàng chờ gia sư (BU-08): đường cũ /admin/ho-so-gia-su → 308 sang hàng chờ");
  const ctx = await ctxFor(sup);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${ADMIN}/admin/ho-so-gia-su`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForURL(/\/admin\/kiem-duyet\?.*loai=gia-su/, { timeout: 90000 });
  check("đường cũ /admin/ho-so-gia-su → 308 sang /admin/kiem-duyet?loai=gia-su", /loai=gia-su/.test(page.url()), page.url());
  const rows = page.locator("[data-queue-table] tbody tr");
  const panel = page.locator("aside[data-side-panel]");
  await page.locator("[data-queue-table]").waitFor({ timeout: 120000 });
  await rows.filter({ hasText: "Ứng viên Hợp lệ" }).first().waitFor({ timeout: 60000 });
  check("thấy 2 hồ sơ chờ", (await rows.count()) === 2);
  check("có nhãn 'Chưa xác thực email' ở hồ sơ chưa xác thực", await rows.filter({ hasText: "Ứng viên Chưa Xác Thực" }).getByText("Chưa xác thực email").first().isVisible());
  await shot(page, "tutor-apps-desktop");
  await rows.filter({ hasText: "Ứng viên Chưa Xác Thực" }).locator("[data-row-open]").click();
  await panel.waitFor({ timeout: 30000 });
  check("nút 'Duyệt gia sư' của người chưa xác thực email bị khoá", await panel.getByRole("button", { name: "Duyệt gia sư" }).isDisabled());
  await page.keyboard.press("Escape");
  await rows.filter({ hasText: "Ứng viên Hợp lệ" }).locator("[data-row-open]").click();
  await panel.waitFor({ timeout: 30000 });
  check("nút 'Duyệt gia sư' của người đã xác thực mở", await panel.getByRole("button", { name: "Duyệt gia sư" }).isEnabled());
  await panel.getByRole("button", { name: "Duyệt gia sư" }).click(); // không cần xác nhận thêm: việc có thể hoàn tác bằng cách đổi vai ở Con người
  await eventually("duyệt xong: hồ sơ biến khỏi hàng chờ", async () => (await rows.count()) === 1, 30000);
  const dbU = await prisma.user.findUnique({ where: { id: ok.id } });
  check("DB: đã thành gia sư", dbU?.tutorVerified === true && dbU?.adminRole === "teacher");

  section("Từ chối: panel bên, bắt buộc lý do");
  await rows.first().locator("[data-row-open]").click();
  await panel.waitFor({ timeout: 30000 });
  await panel.getByRole("button", { name: "Từ chối" }).click();
  const submit = panel.getByRole("button", { name: /^Xác nhận: Từ chối/ });
  check("chưa nhập lý do: nút xác nhận bị khoá", await submit.isDisabled());
  await panel.getByLabel(/Lý do từ chối/).fill("Cần xác thực email và bổ sung bằng cấp");
  check("nhập lý do: nút xác nhận mở", !(await submit.isDisabled()));
  check("không dùng hộp thoại (role=dialog = 0)", (await page.locator("[role=dialog]").count()) === 0);
  await shot(page, "tutor-apps-reject-panel");
  await submit.click();
  await eventually("từ chối xong: hàng chờ trống", async () => (await rows.count()) === 0, 30000);
  const rej = await prisma.user.findUnique({ where: { id: unv.id } });
  check("DB: đã từ chối kèm lý do, chưa thành gia sư", !!rej?.tutorRejectedAt && rej.tutorRejectReason === "Cần xác thực email và bổ sung bằng cấp" && rej.tutorVerified === false);

  // 24/10/2026 (QT-02): tab "Hồ sơ gia sư chờ duyệt" trong /admin/quan-tri-vien đã bỏ (duyệt gia sư chỉ còn MỘT cửa: hàng chờ kiểm duyệt). Test cũ khẳng định tab đó nên đổi sang khẳng định hành vi mới.
  section("/admin/quan-tri-vien: không còn tab duyệt gia sư, có liên kết sang hàng chờ");
  await page.goto(`${ADMIN}/admin/quan-tri-vien`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByPlaceholder("Tìm theo tên, email hoặc SĐT...").waitFor({ timeout: 60000 });
  check("không còn tab 'Hồ sơ gia sư chờ duyệt'", (await page.getByRole("tab", { name: /Hồ sơ gia sư chờ duyệt/ }).count()) === 0);
  check("có liên kết sang hàng chờ kiểm duyệt", (await page.getByRole("link", { name: "hàng chờ kiểm duyệt" }).getAttribute("href")) === "/admin/kiem-duyet");
  check("bảng tài khoản vẫn đủ", await page.getByPlaceholder("Tìm theo tên, email hoặc SĐT...").isVisible());

  section("Mobile 390px");
  const mctx = await ctxFor(sup, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  await applicant("Ứng viên Di Động", true);
  await mp.goto(`${ADMIN}/admin/kiem-duyet?loai=gia-su`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await mp.getByText("Ứng viên Di Động").first().waitFor({ timeout: 90000 });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check("không tràn ngang trên mobile", !overflow);
  await shot(mp, "tutor-apps-mobile");

  section("Gia sư thường bị đẩy khỏi trang");
  const tctx = await ctxFor(teacher);
  const tp = await tctx.newPage();
  await tp.goto(`${BASE}/admin/ho-so-gia-su`, { waitUntil: "domcontentloaded" });
  await tp.waitForURL(u => !u.pathname.includes("ho-so-gia-su"), { timeout: 30000 });
  await tp.waitForURL(/\/lop-cua-toi(\/|$)/, { timeout: 30000 }); // /admin của gia sư → Hộp việc /lop-cua-toi (chế độ gọn thì tiếp tục sang Lịch) — hostRouting.ts
  check("bị đưa khỏi trang → /admin → khu của gia sư /lop-cua-toi (tên miền chính)", true);
  check("sidebar gia sư không có 'Duyệt gia sư'", (await tp.getByText("Duyệt gia sư").count()) === 0);

  check("không có lỗi console/pageerror ở trang chính", errors.filter(e => !/favicon|font/i.test(e)).length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
