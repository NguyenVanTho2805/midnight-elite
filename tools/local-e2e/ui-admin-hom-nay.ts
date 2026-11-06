// BU-08 — /admin = "Hôm nay cần làm gì" (Figma 608:1083): nhóm việc, số đếm, liên kết ?loai=, chỉ số gọn; KHÔNG số điện thoại học sinh, KHÔNG biểu đồ.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-admin-hom-nay.ts
import { mkUser, mkSuper, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN, adminGet } from "./ui";
import { prisma } from "@/lib/prisma";
import { COIN_VISIBLE } from "@/lib/features";

const PHONE = "0987654321";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  const stu = await mkUser({ name: "Em Có Số Điện Thoại" });
  await prisma.user.update({ where: { id: stu.id }, data: { phone: PHONE } });
  const course = await mkCourse(T.id, { name: "Toán 9 Hôm Nay" });
  await prisma.enrollment.create({ data: { userId: stu.id, courseId: course.id, status: "active" } }).catch(() => {});
  const rv = await mkUser({ name: "Em Đánh Giá" });
  await prisma.courseReview.create({ data: { userId: rv.id, courseId: course.id, rating: 5, comment: "tốt", status: "pending" } });
  const ap = await mkUser({ name: "Gia sư chờ duyệt", emailVerified: true });
  await prisma.user.update({ where: { id: ap.id }, data: { tutorAppliedAt: new Date(), subjects: ["Toán"] } });
  await prisma.coinTopupRequest.create({ data: { userId: stu.id, amountVnd: 100000, coinAmount: 100000 } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };

  const ctx = await ctxFor(SA, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);

  section("Hôm nay 1280 (cấp 1)");
  await pg.goto(`${ADMIN}/admin`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.getByRole("heading", { level: 1, name: "Hôm nay cần làm gì" }).waitFor({ timeout: 120000 });
  await pg.locator("[data-todo]").first().waitFor({ timeout: 60000 });
  check("h1 'Hôm nay cần làm gì' + dòng phụ có số việc", /\d+ việc đang chờ/.test(await pg.locator("header p").innerText()));
  const hrefs = await pg.locator("[data-todo] a").evaluateAll(els => els.map(e => e.getAttribute("href")));
  check("các việc duyệt gộp thành MỘT dòng 'hang-cho' trỏ /admin/kiem-duyet (không ?loai=); Pro / hỗ trợ giữ trang riêng; không /admin/topups hay /admin/cong-dong/bao-cao", hrefs.length > 0 && hrefs.every(h => /^\/admin\/(kiem-duyet$|goi-pro|ho-tro)/.test(h ?? "")) && await pg.locator('[data-todo="hang-cho"]').count() === 1 && !hrefs.some(h => /topups|bao-cao|loai=/.test(h ?? "")), hrefs);
  const hcText = await pg.locator('[data-todo="hang-cho"]').innerText();
  check("dòng tổng ghi số theo loại (1 đánh giá khoá học, 1 hồ sơ gia sư) và có số đếm tổng", /đánh giá khoá học/.test(hcText) && /hồ sơ gia sư/.test(hcText) && /\d/.test(hcText), hcText);
  check("không còn hàng riêng 'danh-gia' / 'gia-su' / 'nap-coin' trên Hôm nay", await pg.locator('[data-todo="danh-gia"], [data-todo="gia-su"], [data-todo="nap-coin"]').count() === 0);
  check("Hôm nay chỉ có một đường vào: logo thanh bên dẫn /admin, thanh bên không có mục 'Hôm nay'", (await pg.locator("[data-rail-home]").first().getAttribute("href")) === "/admin" && (await pg.locator("#kin-rail").getByRole("link", { name: "Hôm nay", exact: true }).count()) === 0);
  check("mỗi hàng việc cao ≥ 44px", (await pg.locator("[data-todo] a").evaluateAll(els => els.map(e => e.getBoundingClientRect().height))).every(h => h >= 43.5));
  const html = await pg.content();
  check("KHÔNG có số điện thoại học sinh mẫu (văn bản + thuộc tính)", !html.includes(PHONE) && !html.includes("Em Có Số Điện Thoại"));
  // adm-test: bỏ phần tử của thanh công cụ dev (agentation: data-feedback-toolbar / lớp styles-module__) — canvas & svg dasharray của nó không thuộc trang.
  const chart = await pg.evaluate(`[...document.querySelectorAll('canvas, svg [stroke-dasharray], svg[stroke-dasharray]')].filter(e => !e.closest('[data-feedback-toolbar],[data-annotation-popup],[data-annotation-marker],[class*="styles-module__"]') && !/styles-module__/.test(String(e.getAttribute('class')))).map(e => e.outerHTML.slice(0, 120))`) as string[];
  check("không canvas, không svg hình tròn / stroke-dasharray", chart.length === 0, chart);
  check("chỉ số gọn: 4 ô (Học sinh, Lớp đang mở, Gia sư đã duyệt, Doanh thu 30 ngày)", await pg.locator("[data-chi-so] [data-kin-stat]").count() === 4);
  check("không còn khối nhắc hàng loạt / 'Lớp đông học viên nhất' / 'Mua VIP gần đây'", !/Lớp đông học viên nhất|Mua VIP gần đây|Nhắc nhở|Liên hệ học sinh/.test(await pg.innerText("body")));
  await shot(pg, "admin-hom-nay-1280");

  section("Lỗi từng nguồn: có 'Thử lại' riêng, không che nhau");
  await pg.route("**/api/admin/analytics**", r => r.fulfill({ status: 500, body: "{}" , contentType: "application/json" }));
  await pg.reload({ waitUntil: "domcontentloaded" });
  await pg.getByText("Chưa tải được doanh thu").waitFor({ timeout: 60000 });
  check("analytics lỗi → chỉ ô doanh thu báo lỗi + Thử lại; danh sách việc vẫn hiện", await pg.locator("[data-todo]").count() > 0 && await pg.locator("[data-chi-so]").getByRole("button", { name: "Thử lại" }).count() === 1);
  await pg.unroute("**/api/admin/analytics**");
  await pg.route("**/api/admin/hom-nay", r => r.fulfill({ status: 500, body: "{}", contentType: "application/json" }));
  await pg.reload({ waitUntil: "domcontentloaded" });
  await pg.getByText("Chưa tải được danh sách việc").waitFor({ timeout: 60000 });
  check("hom-nay lỗi → 'Thử lại' cho danh sách việc; tiêu đề trang vẫn hiện", await pg.getByRole("button", { name: "Thử lại" }).count() >= 1 && await pg.getByRole("heading", { level: 1 }).isVisible());
  check("lỗi dùng role=status + data-loi, không role=alert trần", await pg.locator("[data-loi]").count() >= 1 && await pg.locator('main [role="alert"]').count() === 0);
  await pg.unroute("**/api/admin/hom-nay");
  await ctx.close();

  section("Quản trị nội dung: ẩn khối tiền / nạp Coin");
  const cc = await ctxFor(CA, { width: 1280, height: 900 });
  const pc = await cc.newPage(); watch(pc);
  await pc.goto(`${ADMIN}/admin`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pc.getByRole("heading", { level: 1, name: "Hôm nay cần làm gì" }).waitFor({ timeout: 120000 });
  await pc.locator("[data-todo]").first().waitFor({ timeout: 60000 });
  check("không hàng nạp Coin, không ô doanh thu", await pc.locator('[data-todo="nap-coin"]').count() === 0 && !/Doanh thu 30 ngày/.test(await pc.innerText("body")));
  await cc.close();

  section("Gia sư không vào được /admin");
  const ct = await ctxFor(T, { width: 1280, height: 900 });
  const pt = await ct.newPage(); watch(pt);
  const hn = await adminGet(pt, `${ADMIN}/api/admin/hom-nay`);
  check("GET /api/admin/hom-nay bằng gia sư → 403", hn.status() === 403, hn.status());
  await ct.close();

  section("Điện thoại 390px");
  const cm = await ctxFor(SA, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${ADMIN}/admin`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pm.locator("[data-todo]").first().waitFor({ timeout: 120000 });
  check("390: không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  await shot(pm, "admin-hom-nay-390");
  await cm.close();

  check("không lỗi console/pageerror lạ", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
