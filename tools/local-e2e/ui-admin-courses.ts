// CAT-02 — danh sách khoá học phía quản trị: bảng 6 cột (cột đầu là TÊN), bộ lọc đồng bộ URL + chip, panel bên, chọn nhiều + Hoàn tác,
// lỗi tải không bị nuốt thành "không tìm thấy", sức chứa, vai gia sư, điện thoại 390px. Không có ô sửa giá.
import { mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const T1 = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Minh");
  const c1 = await mkCourse(T1.id, { name: "Toán 9 cô Lan", capacity: 5 });
  const c2 = await mkCourse(T1.id, { name: "Lý 9 cô Lan" });
  const c3 = await mkCourse(T2.id, { name: "Văn 9 thầy Minh" });
  const c4 = await mkCourse(null, { name: "Anh HSA trung tâm" });
  await prisma.course.update({ where: { id: c1.id }, data: { category: "ĐGNL HSA", price: 2990000 } });
  await prisma.course.update({ where: { id: c2.id }, data: { category: "ĐGNL HSA", price: 0 } });
  await prisma.course.update({ where: { id: c3.id }, data: { category: "ĐGNL HCM", price: 500000 } });
  await prisma.course.update({ where: { id: c4.id }, data: { category: "ĐGNL HCM", price: 0 } });
  for (let i = 0; i < 3; i++) { const u = await mkUser({ name: `Em ${i}` }); await prisma.enrollment.create({ data: { userId: u.id, courseId: c1.id, status: "active" } }); }
  const prices = async () => JSON.stringify((await prisma.course.findMany({ orderBy: { id: "asc" }, select: { id: true, price: true, originalPrice: true } })));
  const priceBefore = await prices();

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); };

  // ── 1280 ──
  const ctx = await ctxFor(SA, { width: 1280, height: 800 });
  const pg = await ctx.newPage(); watch(pg);
  await pg.goto(`${ADMIN}/admin/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.locator("[data-course-row]").first().waitFor({ timeout: 90000 });

  section("Bảng: cột đầu là tên khoá, không có cột cũ");
  const rows = pg.locator("[data-course-row]");
  check("4 khoá hiện", (await rows.count()) === 4, await rows.count());
  const head = await pg.locator("[data-course-table] [role=row]").first().innerText();
  check("tiêu đề: Khoá học · Trạng thái · Sĩ số · Kỳ thi · Giá; KHÔNG có ID/Slug/Ngày tạo/Hành động", /Khoá học/.test(head) && /Trạng thái/.test(head) && /Sĩ số/.test(head) && /Kỳ thi/.test(head) && /Giá/.test(head) && !/\bID\b|Slug|Ngày tạo|Hành động/.test(head), head);
  const r1 = pg.locator(`[data-course-row="${c1.id}"]`);
  check("hàng đầu bắt đầu bằng TÊN khoá (không phải số)", /^\s*Toán 9 cô Lan/.test(await r1.locator("button").first().innerText()));
  check("chip trạng thái bằng CHỮ (Đang hiển thị, Đang nhận) và sĩ số 3/5", /Đang hiển thị/.test(await r1.innerText()) && /Đang nhận/.test(await r1.innerText()) && /3\/5/.test(await r1.innerText()), await r1.innerText());
  check("giá hiện 2.990.000đ và 'Miễn phí' ở khoá giá 0", /2\.990\.000đ/.test(await r1.innerText()) && /Miễn phí/.test(await pg.locator(`[data-course-row="${c2.id}"]`).innerText()));
  const openLink = r1.getByRole("link", { name: /^Mở / });
  check("liên kết 'Mở' → /admin/khoa-hoc/<slug>", (await openLink.getAttribute("href"))?.endsWith(`/admin/khoa-hoc/${c1.id}`), await openLink.getAttribute("href"));
  let maxCtl = 0;
  for (let i = 0; i < await rows.count(); i++) maxCtl = Math.max(maxCtl, await rows.nth(i).locator("a, button").count());
  check("mỗi hàng ≤ 2 nút/liên kết (ô chọn tính riêng)", maxCtl <= 2, maxCtl);

  section("Tìm + lọc đồng bộ URL");
  await pg.getByRole("searchbox").fill("toan");
  await pg.waitForURL(/[?&]q=toan/, { timeout: 15000 });
  check("gõ 'toan' khớp 'Toán' (bỏ dấu) — còn 1 hàng", (await rows.count()) === 1);
  check("chip 'Tìm: “toan”' hiện", await pg.locator("[data-filter-chips]").getByText(/Tìm/).isVisible());
  await pg.reload({ waitUntil: "networkidle" });
  await rows.first().waitFor({ timeout: 60000 });
  check("tải lại giữ bộ lọc + chip", (await rows.count()) === 1 && (await pg.getByRole("searchbox").inputValue()) === "toan");
  await pg.getByRole("button", { name: "Xoá bộ lọc" }).click();
  await pg.waitForFunction(() => !location.search.includes("q="), null, { timeout: 15000 });
  check("'Xoá bộ lọc' trả đủ 4 hàng", (await rows.count()) === 4);
  await pg.getByRole("combobox", { name: /Kỳ thi/ }).selectOption("ĐGNL HCM");
  await pg.waitForURL(/kythi=/, { timeout: 15000 });
  check("lọc Kỳ thi → 2 hàng, có chip", (await rows.count()) === 2 && await pg.locator("[data-filter-chips]").getByText(/Kỳ thi: ĐGNL HCM/).isVisible());
  await pg.getByRole("button", { name: "Xoá bộ lọc" }).click();
  await pg.getByRole("combobox", { name: /Giá/ }).selectOption("mien-phi");
  check("lọc Miễn phí → 2 hàng", (await rows.count()) === 2);
  await pg.getByRole("button", { name: "Xoá bộ lọc" }).click();
  await pg.getByRole("combobox", { name: /Gia sư/ }).selectOption({ index: 1 }).catch(() => {});

  section("Panel sửa nhanh (không hộp thoại), không ô giá");
  await pg.goto(`${ADMIN}/admin/khoa-hoc`, { waitUntil: "networkidle" });
  await rows.first().waitFor({ timeout: 60000 });
  await pg.locator(`[data-course-row="${c1.id}"] button`).first().click();
  const side = pg.locator("[data-side-panel]");
  await side.waitFor({ timeout: 15000 });
  check("panel mở; KHÔNG role=dialog; bảng vẫn bấm được", (await pg.getByRole("dialog").count()) === 0 && await pg.locator(`[data-course-row="${c2.id}"] button`).first().isEnabled());
  check("không có ô nào tên/id 'price'", (await side.locator('[name*="price" i], [id*="price" i]').count()) === 0);
  check("giá hiện một dòng chỉ đọc kèm liên kết 'đổi ở trang khoá học'", /2\.990\.000đ/.test(await side.locator("[data-course-price]").innerText()) && await side.getByRole("link", { name: /đổi ở trang khoá học/ }).isVisible());
  await side.getByLabel("Tên công khai").fill("Toán 9 cô Lan (mới)");
  await side.getByRole("button", { name: "Lưu", exact: true }).click();
  await side.waitFor({ state: "detached", timeout: 15000 });
  check("hàng đổi tại chỗ, KHÔNG hiện khung xám tải lại", await pg.locator(`[data-course-row="${c1.id}"]`).getByText("Toán 9 cô Lan (mới)").first().isVisible() && (await pg.locator("[aria-busy=true][aria-label^='Đang tải']").count()) === 0);
  check("CSDL đổi tên; giá KHÔNG đổi", (await prisma.course.findUnique({ where: { id: c1.id } }))?.name === "Toán 9 cô Lan (mới)" && (await prices()) === priceBefore);

  section("Sức chứa dưới số học viên → lỗi dưới ô");
  await pg.locator(`[data-course-row="${c1.id}"] button`).first().click();
  await side.waitFor();
  await side.getByLabel(/Sức chứa/).fill("2");
  await side.getByRole("button", { name: "Lưu", exact: true }).click();
  await side.locator("[data-panel-error]").waitFor({ timeout: 15000 });
  check("báo 'hiện có 3 học viên đang theo học'; CSDL giữ capacity 5", /3 học viên/.test(await side.locator("[data-panel-error]").innerText()) && (await prisma.course.findUnique({ where: { id: c1.id } }))?.capacity === 5);
  await pg.keyboard.press("Escape");
  await side.waitFor({ state: "detached", timeout: 10000 });

  section("Xoá trong panel: hai bước, không hộp thoại");
  await pg.locator(`[data-course-row="${c4.id}"] button`).first().click();
  await side.waitFor();
  await side.getByRole("button", { name: "Xoá khoá học" }).click();
  check("hiện xác nhận ngay trong panel (không dialog)", await side.locator("[data-del-confirm]").isVisible() && (await pg.getByRole("dialog").count()) === 0);
  await side.getByRole("button", { name: "Giữ lại" }).click();
  check("'Giữ lại' không xoá", !!(await prisma.course.findUnique({ where: { id: c4.id } })));
  await pg.keyboard.press("Escape");

  section("Chọn nhiều + Ẩn + Hoàn tác");
  const pubCount = async () => prisma.course.count({ where: { status: true } });
  const before = await pubCount();
  for (const id of [c1.id, c2.id, c3.id]) await pg.locator(`[data-course-row="${id}"] input[type=checkbox]`).check();
  const bar = pg.locator("[data-bulk-bar]");
  check("thanh ngữ cảnh 'Đã chọn 3 khoá'", await bar.getByText("Đã chọn 3 khoá").isVisible());
  await bar.getByRole("button", { name: "Ẩn", exact: true }).click();
  await pg.getByText(/Đã ẩn 3 khoá/).waitFor({ timeout: 15000 });
  check("CSDL: 3 khoá status=false", (await pubCount()) === before - 3, await pubCount());
  check("chip 'Đang ẩn' bằng chữ", (await pg.locator(`[data-course-row="${c1.id}"]`).innerText()).includes("Đang ẩn"));
  await pg.getByRole("button", { name: "Hoàn tác" }).click();
  await pg.getByText(/Đã hoàn tác cho 3 khoá/).waitFor({ timeout: 15000 });
  check("Hoàn tác trả đúng trạng thái trước", (await pubCount()) === before);
  check("giá không đổi sau thao tác hàng loạt", (await prices()) === priceBefore);
  await shot(pg, "admin-courses-1280");

  section("Lỗi tải KHÔNG bị nuốt thành 'không tìm thấy'");
  const ep = await ctx.newPage(); watch(ep);
  let fail = true;
  await ep.route("**/api/admin/khoa-hoc", route => (fail ? route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"x"}' }) : route.continue()));
  await ep.goto(`${ADMIN}/admin/khoa-hoc`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await ep.getByText("Không tải được danh sách khoá học").waitFor({ timeout: 60000 });
  check("hiện 'Không tải được…', KHÔNG hiện 'Không tìm thấy khoá học'", (await ep.getByText(/Không tìm thấy khoá học/).count()) === 0);
  fail = false;
  await ep.getByRole("button", { name: "Thử lại" }).click();
  await ep.locator("[data-course-row]").first().waitFor({ timeout: 60000 });
  check("'Thử lại' tải được danh sách", (await ep.locator("[data-course-row]").count()) >= 1);
  await ep.close();

  // ── 390 ──
  section("Điện thoại 390px");
  const mctx = await ctxFor(SA, { width: 390, height: 800 });
  const mp = await mctx.newPage(); watch(mp);
  await mp.goto(`${ADMIN}/admin/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.locator("[data-course-row]").first().waitFor({ timeout: 90000 });
  check("không tràn ngang (scrollWidth ≤ 390)", await mp.evaluate(() => document.documentElement.scrollWidth <= 390));
  check("bộ lọc gập vào nút 'Lọc'", await mp.getByRole("button", { name: /^Lọc/ }).isVisible() && !(await mp.getByRole("combobox", { name: /Kỳ thi/ }).isVisible()));
  const fab = mp.getByRole("button", { name: "Tạo khoá học" });
  const box = await fab.boundingBox();
  check("nút 'Tạo khoá học' thấy được không cần cuộn", !!box && box.y + box.height <= 800 && box.height >= 44, box);
  await mp.locator("[data-course-row] button").first().click();
  const sp = mp.locator("[data-side-panel]");
  await sp.waitFor({ timeout: 15000 });
  const sb = await sp.boundingBox();
  check("panel toàn màn hình 390px", !!sb && Math.round(sb.width) >= 389, sb);
  check("panel không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= 390));
  await shot(mp, "admin-courses-390");
  await mctx.close();

  // ── Gia sư ──
  section("Vai gia sư");
  const tctx = await ctxFor(T1, { width: 1280, height: 800 });
  const tp = await tctx.newPage(); watch(tp);
  await tp.goto(`${BASE}/lop-cua-toi/quan-lop`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await tp.waitForURL(/\/lop-cua-toi\/lop$/, { timeout: 90000 });
  check("A4b: gia sư mở /lop-cua-toi/quan-lop (danh sách) → chuyển về /lop-cua-toi/lop, không còn bảng danh mục khoá của quản trị", new URL(tp.url()).pathname === "/lop-cua-toi/lop" && (await tp.locator("[data-course-row]").count()) === 0, tp.url());
  await tctx.close();

  check("không lỗi JS trên trang", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
