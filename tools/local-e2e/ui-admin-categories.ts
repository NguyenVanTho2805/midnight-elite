// CAT-02 — danh mục khoá học phía quản trị: Thêm lưu thật, Xoá thật (tải lại không trở về), xoá tắt khi còn khoá, đổi thứ tự (Alt+↓ và Lên/Xuống) giữ sau tải lại,
// gia sư chỉ đọc, 390px không tràn ngang.
import { mkTutor, mkCourse, mkSuper, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const T = await mkTutor("Cô Lan");
  const a = await mkCourse(T.id, { name: "Khoá A" }), b = await mkCourse(null, { name: "Khoá B" });
  await prisma.course.update({ where: { id: a.id }, data: { category: "ĐGNL HSA" } });
  await prisma.course.update({ where: { id: b.id }, data: { category: "ĐGNL HCM" } });

  await launch();
  const errors: string[] = [];
  const ctx = await ctxFor(SA, { width: 1280, height: 800 });
  const pg = await ctx.newPage();
  pg.on("pageerror", e => errors.push(String(e)));
  const rowsLoc = () => pg.locator("[data-category-row]");
  const names = async () => (await rowsLoc().evaluateAll(els => els.map(e => (e as HTMLElement).dataset.categoryRow ?? "")));
  const open = async () => { await pg.goto(`${ADMIN}/admin/khoa-hoc/danh-muc`, { waitUntil: "networkidle", timeout: 120000 }); await rowsLoc().first().waitFor({ timeout: 90000 }); };
  await open();

  section("Danh sách");
  check("2 danh mục, mỗi hàng ≤ 2 điều khiển", (await rowsLoc().count()) === 2 && (await rowsLoc().first().locator("a, button").count()) <= 2);
  check("đếm khoá bằng chữ '1 khoá · 1 hiển thị · 0 ẩn'", /1 khoá · 1 hiển thị · 0 ẩn/.test(await rowsLoc().first().innerText()), await rowsLoc().first().innerText());

  section("Thêm danh mục lưu THẬT");
  await pg.getByRole("button", { name: "Thêm danh mục" }).first().click();
  const side = pg.locator("[data-side-panel]");
  await side.getByLabel("Tên danh mục").fill("TSA Bách khoa");
  await side.getByRole("button", { name: "Thêm danh mục" }).click();
  await pg.getByText(/Đã thêm danh mục/).waitFor({ timeout: 15000 });
  await open();
  check("tải lại vẫn còn 'TSA Bách khoa'", (await names()).includes("TSA Bách khoa"), await names());
  check("trùng tên (khác hoa/thường) → báo 'Đã có danh mục tên này'", await (async () => {
    await pg.getByRole("button", { name: "Thêm danh mục" }).first().click();
    await side.getByLabel("Tên danh mục").fill("tsa bách khoa");
    await side.getByRole("button", { name: "Thêm danh mục" }).click();
    await side.locator("[data-panel-error]").waitFor({ timeout: 15000 });
    return /Đã có danh mục tên này/.test(await side.locator("[data-panel-error]").innerText());
  })());
  await pg.keyboard.press("Escape");

  section("Xoá: tắt khi còn khoá, thật khi trống");
  await pg.locator('[data-category-row="ĐGNL HSA"] button').first().click();
  await side.waitFor();
  check("nút Xoá tắt + lý do 'Còn 1 khoá'", await side.getByRole("button", { name: "Xoá danh mục" }).isDisabled() && /Còn 1 khoá/.test(await side.locator("[data-delete-blocked]").innerText()));
  await pg.keyboard.press("Escape");
  await pg.locator('[data-category-row="TSA Bách khoa"] button').first().click();
  await side.waitFor();
  await side.getByRole("button", { name: "Xoá danh mục" }).click();
  await side.locator("[data-del-confirm]").getByRole("button", { name: "Xoá danh mục" }).click();
  await pg.getByText("Đã xoá danh mục").waitFor({ timeout: 15000 });
  await open();
  check("tải lại KHÔNG trở về (đối chứng điểm 21)", !(await names()).includes("TSA Bách khoa"), await names());

  section("Đổi thứ tự: Alt+↓ và Lên/Xuống, giữ sau tải lại");
  const first = (await names())[0];
  await pg.locator(`[data-category-row="${first}"] button`).first().focus();
  await pg.keyboard.press("Alt+ArrowDown");
  await pg.getByText(/Đã đổi vị trí/).waitFor({ timeout: 15000 });
  await open();
  check("sau Alt+↓ và tải lại, danh mục đầu xuống vị trí 2", (await names())[1] === first, await names());
  await pg.locator(`[data-category-row="${first}"] button`).first().click();
  await side.waitFor();
  await side.getByRole("button", { name: "Lên", exact: true }).click();
  await pg.getByText(/Đã đổi vị trí/).waitFor({ timeout: 15000 });
  await open();
  check("nút Lên đưa về vị trí 1, giữ sau tải lại", (await names())[0] === first, await names());
  const pub = await pg.request.get(`${BASE}/api/categories`);
  const order = ((await pub.json()).categories as { name: string }[]).map(c => c.name);
  check("GET /api/categories công khai theo đúng thứ tự đó", order[0] === first, order);
  await shot(pg, "admin-categories-1280");

  section("Gia sư không vào được /admin (BU-00)");
  const tctx = await ctxFor(T, { width: 1280, height: 800 });
  const tp = await tctx.newPage();
  await tp.goto(`${BASE}/admin/khoa-hoc/danh-muc`, { waitUntil: "networkidle", timeout: 120000 });
  check("gia sư bị chuyển khỏi trang danh mục quản trị", !new URL(tp.url()).pathname.startsWith("/admin"), tp.url());
  await tctx.close();

  section("390px");
  const mctx = await ctxFor(SA, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  await mp.goto(`${ADMIN}/admin/khoa-hoc/danh-muc`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.locator("[data-category-row]").first().waitFor({ timeout: 90000 });
  check("không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= 390));
  await mp.locator("[data-category-row] button").first().click();
  await mp.locator("[data-side-panel]").waitFor();
  check("panel toàn màn hình, không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= 390));
  await shot(mp, "admin-categories-390");
  await mctx.close();

  check("không lỗi JS trên trang", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
