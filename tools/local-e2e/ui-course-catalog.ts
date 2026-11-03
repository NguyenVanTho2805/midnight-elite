// CAT-01 — /khoa-hoc trong trình duyệt (COO chạy, KHÔNG chạy trên cổng 3100 chung khi chưa được phép): 1280 và 390, URL giữ bộ lọc, thẻ, trạng thái rỗng, vai khách / học sinh.
import { mkTutor, mkUser, mkCourse, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
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
  await prisma.courseCategory.upsert({ where: { name: "ĐGNL HCM" }, update: { sortOrder: 1 }, create: { name: "ĐGNL HCM", slug: "dgnl-hcm", sortOrder: 1 } });
  await prisma.courseCategory.upsert({ where: { name: "ĐGNL HSA" }, update: { sortOrder: 2 }, create: { name: "ĐGNL HSA", slug: "dgnl-hsa", sortOrder: 2 } });

  await launch();
  const errors: string[] = [];

  section("1280 — khách");
  const ctx = await ctxFor(null, { width: 1280, height: 800 });
  const pg = await ctx.newPage(); pg.on("pageerror", (e: unknown) => errors.push(String(e)));
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
  await pg.getByRole("combobox", { name: "Giá" }).selectOption("free");
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

  check("không lỗi JS trang", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
