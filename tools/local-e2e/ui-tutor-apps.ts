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

  section("Trang /admin/ho-so-gia-su (quản lý)");
  const ctx = await ctxFor(sup);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${ADMIN}/admin/ho-so-gia-su`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Duyệt hồ sơ gia sư" }).waitFor({ timeout: 60000 });
  await page.getByText("Ứng viên Hợp lệ").waitFor();
  check("thấy 2 hồ sơ chờ", (await page.locator("li").count()) === 2);
  const approveBtns = page.getByRole("button", { name: "Duyệt", exact: true });
  check("nút Duyệt của người chưa xác thực email bị khoá", (await approveBtns.nth(1).isDisabled()) === true && (await approveBtns.nth(0).isDisabled()) === false);
  check("có nhãn 'Chưa xác thực email'", await page.getByText("Chưa xác thực email").first().isVisible());
  await shot(page, "tutor-apps-desktop");

  await approveBtns.nth(0).click();
  await page.getByText(/Đã duyệt Ứng viên Hợp lệ/).waitFor({ timeout: 15000 });
  await eventually("duyệt xong: hồ sơ biến khỏi tab chờ", async () => (await page.locator("li").count()) === 1);
  const dbU = await prisma.user.findUnique({ where: { id: ok.id } });
  check("DB: đã thành gia sư", dbU?.tutorVerified === true && dbU?.adminRole === "teacher");

  section("Từ chối bằng modal");
  await page.getByRole("button", { name: "Từ chối", exact: true }).click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  const submit = dlg.getByRole("button", { name: "Từ chối hồ sơ" });
  check("chưa nhập lý do: nút gửi bị khoá", await submit.isDisabled());
  await dlg.getByLabel("Lý do từ chối").fill("Cần xác thực email và bổ sung bằng cấp");
  check("nhập lý do: nút gửi mở", !(await submit.isDisabled()));
  await shot(page, "tutor-apps-reject-modal");
  await submit.click();
  await page.getByText(/Đã từ chối hồ sơ của/).waitFor({ timeout: 15000 });
  await page.getByRole("tab", { name: "Đã từ chối" }).click();
  await page.getByText("Lý do: Cần xác thực email và bổ sung bằng cấp").waitFor({ timeout: 15000 });
  check("tab 'Đã từ chối' hiện lý do", true);

  section("Tab trong /admin/quan-tri-vien");
  await page.goto(`${ADMIN}/admin/quan-tri-vien`, { waitUntil: "networkidle" });
  const tab = page.getByRole("tab", { name: /Hồ sơ gia sư chờ duyệt/ });
  await tab.waitFor({ timeout: 60000 });
  check("nhãn tab có số chờ (0)", /\(0\)/.test(await tab.innerText()), await tab.innerText());
  await tab.click();
  await page.getByText("Không có hồ sơ nào đang chờ duyệt.").waitFor({ timeout: 15000 });
  check("tab hiện trạng thái rỗng", true);
  await page.getByRole("tab", { name: "Tài khoản" }).click();
  await page.getByPlaceholder("Tìm theo tên, email hoặc SĐT...").waitFor();
  check("quay lại tab Tài khoản vẫn đủ bảng", true);

  section("Mobile 390px");
  const mctx = await ctxFor(sup, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  await applicant("Ứng viên Di Động", true);
  await mp.goto(`${ADMIN}/admin/ho-so-gia-su`, { waitUntil: "networkidle" });
  await mp.getByText("Ứng viên Di Động").waitFor({ timeout: 60000 });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check("không tràn ngang trên mobile", !overflow);
  await shot(mp, "tutor-apps-mobile");

  section("Gia sư thường bị đẩy khỏi trang");
  const tctx = await ctxFor(teacher);
  const tp = await tctx.newPage();
  await tp.goto(`${ADMIN}/admin/ho-so-gia-su`, { waitUntil: "networkidle" });
  await tp.waitForURL(/\/admin\/?$/, { timeout: 30000 });
  check("redirect về /admin", true);
  check("sidebar gia sư không có 'Duyệt gia sư'", (await tp.getByText("Duyệt gia sư").count()) === 0);

  check("không có lỗi console/pageerror ở trang chính", errors.filter(e => !/favicon|font/i.test(e)).length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
