// CAT-01 — /khoa-hoc trong trình duyệt (COO chạy, KHÔNG chạy trên cổng 3100 chung khi chưa được phép): 1280 và 390, URL giữ bộ lọc, thẻ, trạng thái rỗng, vai khách / học sinh.
import { mkTutor, mkUser, mkCourse, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, shot, closeAll, kinSelect } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const a = await mkCourse(T.id, { name: "Toán HSA mở", capacity: 20 });
  const b = await mkCourse(T.id, { name: "Lý HSA đầy", capacity: 1 });
  const c = await mkCourse(T.id, { name: "Hoá HCM đóng", classStatus: "closed" });
  const d = await mkCourse(T.id, { name: "Anh HCM miễn phí" });
  await prisma.course.update({ where: { id: a.id }, data: { category: "ĐGNL HSA", price: 2990000, originalPrice: 3990000 } });
  await prisma.course.update({ where: { id: b.id }, data: { category: "ĐGNL HSA", price: 500000 } });
  await prisma.course.update({ where: { id: c.id }, data: { category: "ĐGNL HCM", price: 700000 } });
  await prisma.course.update({ where: { id: d.id }, data: { category: "ĐGNL HCM", price: 0 } });
  const kid = await mkUser({ name: "Em A" });
  await prisma.enrollment.create({ data: { userId: kid.id, courseId: b.id, status: "active" } });
  // 2A (04/11/2026): em đã vào lớp `a` nhưng đang CHỜ PHỤ HUYNH ĐỒNG Ý → thẻ hiện nhãn, KHÔNG có nút theo dõi (bấm theo dõi bị từ chối 409 mà không báo gì).
  const waiting = await mkUser({ name: "Em Chờ" });
  await prisma.enrollment.create({ data: { userId: waiting.id, courseId: a.id, status: "pending_consent" } });
  // NO-0511: em đã NGHỈ lớp `d` (suspended) → thẻ hiện nhãn trung tính, không nút theo dõi (bấm theo dõi bị từ chối 409).
  const left = await mkUser({ name: "Em Nghỉ" });
  await prisma.enrollment.create({ data: { userId: left.id, courseId: d.id, status: "suspended" } });
  await prisma.courseCategory.upsert({ where: { name: "ĐGNL HCM" }, update: { sortOrder: 1 }, create: { name: "ĐGNL HCM", slug: "dgnl-hcm", sortOrder: 1 } });
  await prisma.courseCategory.upsert({ where: { name: "ĐGNL HSA" }, update: { sortOrder: 2 }, create: { name: "ĐGNL HSA", slug: "dgnl-hsa", sortOrder: 2 } });

  await launch();
  const errors: string[] = [];
  // Cảnh báo React "Cannot update a component (Router) while rendering…" (replaceState trong hàm cập nhật state) — console.error, không phải pageerror.
  const reactWarns: string[] = [];
  const watchConsole = (p: { on: (ev: "console", cb: (m: { type(): string; text(): string }) => void) => unknown }) =>
    p.on("console", m => { if (m.type() === "error" && /Cannot update a component|while rendering a different component/i.test(m.text())) reactWarns.push(m.text().slice(0, 200)); });

  section("1280 — khách");
  const ctx = await ctxFor(null, { width: 1280, height: 800 });
  const pg = await ctx.newPage(); pg.on("pageerror", (e: unknown) => errors.push(String(e))); watchConsole(pg);
  await pg.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.locator("[data-course-card]").first().waitFor({ timeout: 60000 });
  check("4 thẻ", (await pg.locator("[data-course-card]").count()) === 4);
  const cols = await pg.locator("[data-course-grid]").evaluate((el: Element) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  check("lưới 4 cột ở 1280", cols === 4, cols);
  const chips = await pg.locator("[data-chip]").evaluateAll((els: Element[]) => els.map(e => e.getAttribute("data-chip")));
  check("chip: Tất cả, rồi ĐGNL HCM trước ĐGNL HSA (sortOrder)", chips.join("|") === "all|ĐGNL HCM|ĐGNL HSA", chips);
  check("thẻ là liên kết thật tới /khoa-hoc/<slug>", (await pg.locator(`[data-course-card="${a.id}"] a`).first().getAttribute("href")) === `/khoa-hoc/${a.id}`);
  const txt = (id: string) => pg.locator(`[data-course-card="${id}"]`).innerText();
  check("chỗ: còn chỗ / đã đầy / đã đóng", /Còn chỗ|Chỉ còn/.test(await txt(a.id)) && /Đã đầy/.test(await txt(b.id)) && /Đã đóng nhận học viên/.test(await txt(c.id)));
  check("giá: 2.990.000đ, giảm 25%, Miễn phí", /2\.990\.000đ/.test(await txt(a.id)) && /-25%/.test(await txt(a.id)) && /Miễn phí/.test(await txt(d.id)));
  check("khách không thấy tên học sinh", !/Em A/.test(await pg.content()));

  section("Chọn chip → URL, tải lại giữ lọc");
  await pg.locator('[data-chip="ĐGNL HCM"]').click();
  await pg.waitForURL(/[?&]category=/, { timeout: 15000 });
  check("URL có category= (tên, không phải id số)", new URL(pg.url()).searchParams.get("category") === "ĐGNL HCM", pg.url());
  check("còn 2 thẻ HCM", (await pg.locator("[data-course-card]").count()) === 2);
  await pg.reload({ waitUntil: "networkidle" });
  check("tải lại vẫn 2 thẻ và chip bật", (await pg.locator("[data-course-card]").count()) === 2 && (await pg.locator('[data-chip="ĐGNL HCM"]').getAttribute("aria-pressed")) === "true");

  section("Lọc giá / còn chỗ / rỗng / xoá lọc");
  await kinSelect(pg.getByRole("combobox", { name: "Giá" }), "free");
  check("miễn phí → 1 thẻ", (await pg.locator("[data-course-card]").count()) === 1);
  await pg.getByRole("searchbox").fill("khong-co-gi-ca");
  check("rỗng do lọc có nút Xoá bộ lọc", (await pg.locator("[data-clear-filters]").count()) >= 1 && /Không có khoá học phù hợp/.test(await pg.locator("[data-catalog]").innerText()));
  await pg.locator("[data-clear-filters]").first().click();
  check("xoá lọc → 4 thẻ, URL sạch", (await pg.locator("[data-course-card]").count()) === 4 && !/[?&](category|q|gia)=/.test(pg.url()), pg.url());
  await pg.goto(`${BASE}/khoa-hoc?kythi=${encodeURIComponent("ĐGNL HSA")}`, { waitUntil: "networkidle" });
  check("?kythi= vẫn lọc", (await pg.locator("[data-course-card]").count()) === 2);

  section("Khách bấm theo dõi → sang đăng nhập");
  await pg.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle" });
  await pg.locator(`[data-course-card="${a.id}"]`).getByRole("button", { name: /Theo dõi lớp/ }).click();
  await pg.waitForURL(/dang-nhap/, { timeout: 15000 });
  check("sang /dang-nhap?redirect=/khoa-hoc", /redirect=%2Fkhoa-hoc/.test(pg.url()), pg.url());
  await shot(pg, "cat01-dang-nhap").catch(() => {});

  section("390 — điện thoại");
  const mctx = await ctxFor(null, { width: 390, height: 800 });
  const mp = await mctx.newPage(); mp.on("pageerror", (e: unknown) => errors.push(String(e)));
  await mp.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.locator("[data-course-card]").first().waitFor({ timeout: 60000 });
  check("không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check("1 cột", (await mp.locator("[data-course-grid]").evaluate((el: Element) => getComputedStyle(el).gridTemplateColumns.split(" ").length)) === 1);
  const small = await mp.evaluate(() => [...document.querySelectorAll("[data-catalog] button, [data-catalog] select, [data-catalog] input[type=search], [data-catalog] label")]
    .filter(e => (e as HTMLElement).offsetParent !== null).map(e => ({ n: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 20), h: Math.round(e.getBoundingClientRect().height) })).filter(x => x.h < 44));
  check("mọi nút / chip / ô chọn / ô tìm cao ≥ 44px", small.length === 0, small);
  await shot(mp, "cat01-390").catch(() => {});

  section("Học sinh đã học lớp đầy");
  const sctx = await ctxFor({ id: kid.id, role: "student", email: kid.email, name: kid.name }, { width: 1280, height: 800 });
  const sp = await sctx.newPage();
  await sp.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await sp.locator(`[data-course-card="${b.id}"]`).getByRole("link", { name: /Vào học/ }).waitFor({ timeout: 30000 });
  check("thẻ lớp đang học có 'Vào học' → /student/hoc-tap?course=", (await sp.locator(`[data-course-card="${b.id}"]`).getByRole("link", { name: /Vào học/ }).getAttribute("href"))?.includes(`/student/hoc-tap?course=${b.id}`) === true);

  check("em đã vào lớp (active) không thấy nhãn 'Chờ phụ huynh đồng ý' ở thẻ nào", (await sp.locator("[data-pending-consent]").count()) === 0);
  await pg.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });   // `pg` đang ở trang đăng nhập sau ca bấm theo dõi
  await pg.locator("[data-course-card]").first().waitFor({ timeout: 60000 });
  check("khách không thấy nhãn 'Chờ phụ huynh đồng ý' ở thẻ nào", (await pg.locator("[data-course-card]").count()) === 4 && (await pg.locator("[data-pending-consent]").count()) === 0);

  section("Em đang chờ phụ huynh đồng ý (2A): nhãn thay cho nút theo dõi");
  const wctx = await ctxFor({ id: waiting.id, role: "student", email: waiting.email, name: waiting.name }, { width: 1280, height: 800 });
  const wp = await wctx.newPage(); wp.on("pageerror", (e: unknown) => errors.push(String(e))); watchConsole(wp);
  const followCalls: string[] = [];
  wp.on("response", r => { if (/\/api\/followed-courses\//.test(r.url())) followCalls.push(`${r.request().method()} ${r.status()}`); });
  await wp.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  const cardA = wp.locator(`[data-course-card="${a.id}"]`);
  await cardA.locator("[data-pending-consent]").waitFor({ timeout: 30000 });
  check("thẻ lớp đang chờ có nhãn 'Chờ phụ huynh đồng ý'", /Chờ phụ huynh đồng ý/.test(await cardA.innerText()));
  check("thẻ đó KHÔNG có nút 'Theo dõi lớp' / 'Bỏ theo dõi lớp'", (await cardA.getByRole("button", { name: /theo dõi lớp/i }).count()) === 0);
  check("thẻ đó cũng không có lối 'Vào học' (chưa có quyền học)", (await cardA.getByRole("link", { name: /Vào học/ }).count()) === 0);
  check("chỉ MỘT thẻ có nhãn", (await wp.locator("[data-pending-consent]").count()) === 1);
  check("3 thẻ còn lại (4 thẻ - 1) vẫn có nút 'Theo dõi lớp'", (await wp.getByRole("button", { name: /Theo dõi lớp/ }).count()) === 3);
  await wp.getByRole("button", { name: /Theo dõi lớp/ }).first().click();
  await wp.waitForTimeout(1200);
  check("bấm theo dõi một lớp KHÁC → POST 200, không có 409 nào", followCalls.length >= 1 && followCalls.every(x => x === "POST 200"), followCalls);
  await shot(wp, "cat01-cho-phu-huynh").catch(() => {});
  const wm = await (await ctxFor({ id: waiting.id, role: "student", email: waiting.email, name: waiting.name }, { width: 390, height: 800 })).newPage();
  await wm.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await wm.locator(`[data-course-card="${a.id}"] [data-pending-consent]`).waitFor({ timeout: 30000 });
  check("390: nhãn hiện đủ, thẻ không tràn ngang", await wm.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth) && /Chờ phụ huynh đồng ý/.test(await wm.locator(`[data-course-card="${a.id}"]`).innerText()));

  section("Em đã nghỉ lớp (NO-0511): nhãn trung tính thay cho nút theo dõi");
  const lp = await (await ctxFor({ id: left.id, role: "student", email: left.email, name: left.name }, { width: 1280, height: 800 })).newPage(); lp.on("pageerror", (e: unknown) => errors.push(String(e)));
  await lp.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  const cardD = lp.locator(`[data-course-card="${d.id}"]`);
  await cardD.locator("[data-suspended-enrollment]").waitFor({ timeout: 30000 });
  check("thẻ lớp đã nghỉ có nhãn 'Đã nghỉ lớp này'", /Đã nghỉ lớp này/.test(await cardD.innerText()));
  check("thẻ đó KHÔNG có nút theo dõi và KHÔNG có 'Vào học'", (await cardD.getByRole("button", { name: /theo dõi lớp/i }).count()) === 0 && (await cardD.getByRole("link", { name: /Vào học/ }).count()) === 0);
  check("chỉ MỘT thẻ có nhãn đã nghỉ; không có nhãn 'Chờ phụ huynh'", (await lp.locator("[data-suspended-enrollment]").count()) === 1 && (await lp.locator("[data-pending-consent]").count()) === 0);
  check("3 thẻ còn lại vẫn có nút 'Theo dõi lớp'", (await lp.getByRole("button", { name: /Theo dõi lớp/ }).count()) === 3);
  check("khách và em chờ phụ huynh không thấy nhãn 'đã nghỉ'", (await pg.locator("[data-suspended-enrollment]").count()) === 0 && (await wp.locator("[data-suspended-enrollment]").count()) === 0);

  section("HS-9 (B6, 08/11/2026): MỘT lối vào 'Đang theo dõi' ở /khoa-hoc cho người đã đăng nhập");
  check("khách không thấy chip 'Đang theo dõi'", (await pg.locator("[data-followed-chip]").count()) === 0);
  const fchip = lp.locator("[data-followed-chip]");
  await fchip.waitFor({ timeout: 30000 });
  check("học sinh thấy ĐÚNG MỘT chip, trỏ /khoa-hoc-da-luu, cao ≥ 44px", (await lp.locator("[data-followed-chip]").count()) === 1 && (await fchip.getAttribute("href")) === "/khoa-hoc-da-luu" && (await fchip.boundingBox())!.height >= 44);
  check("chip không lẫn vào các chip danh mục (data-chip vẫn là all + danh mục)", (await lp.locator("[data-chip]").count()) === 3);
  await fchip.click();
  await lp.waitForURL(/\/khoa-hoc-da-luu$/, { timeout: 30000 });
  check("bấm chip → trang 'Lớp đang theo dõi' (nơi xem lại / bỏ theo dõi)", await lp.getByRole("heading", { name: /Lớp đang theo dõi/ }).first().isVisible());

  section("LOI-07: gia sư mở /khoa-hoc → KHÔNG có nút theo dõi, KHÔNG chip 'Đang theo dõi', không gọi /api/followed-courses/<lớp> (API chỉ nhận học sinh → 403)");
  const tp = await (await ctxFor(T, { width: 1280, height: 800 })).newPage(); tp.on("pageerror", (e: unknown) => errors.push(String(e)));
  const tutorFollow: string[] = [];
  tp.on("response", r => { if (/\/api\/followed-courses\//.test(r.url())) tutorFollow.push(`${r.request().method()} ${r.status()}`); });
  await tp.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await tp.locator("[data-course-card]").first().waitFor({ timeout: 60000 });
  await tp.waitForTimeout(800);   // đợi AuthContext biết vai (nút theo dõi vẽ cho khách trước khi biết người dùng)
  check("gia sư: 4 thẻ, không thẻ nào có nút 'Theo dõi lớp' / 'Bỏ theo dõi lớp'", (await tp.locator("[data-course-card]").count()) === 4 && (await tp.getByRole("button", { name: /theo dõi lớp/i }).count()) === 0);
  check("gia sư: không có chip 'Đang theo dõi'", (await tp.locator("[data-followed-chip]").count()) === 0);
  check("gia sư: không có yêu cầu POST/DELETE /api/followed-courses/<lớp> nào (không 403)", tutorFollow.length === 0, tutorFollow);
  await lp.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });   // `lp` đang ở /khoa-hoc-da-luu sau ca chip
  await lp.locator("[data-followed-chip]").waitFor({ timeout: 30000 });
  check("ca đối chứng: học sinh (em nghỉ lớp) vẫn có nút theo dõi ở 3 lớp còn lại", (await lp.getByRole("button", { name: /theo dõi lớp/i }).count()) === 3);

  check("không lỗi JS trang", errors.length === 0, errors.slice(0, 3));
  check("gõ tìm / chọn chip / đổi lọc không gây cảnh báo React 'cập nhật Router khi đang dựng' (replaceState ngoài hàm cập nhật state)", reactWarns.length === 0, reactWarns.slice(0, 2));
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", String(e).slice(0, 300)); process.exit(1); });
