// BU-08 — vỏ quản trị 4 module (Figma 606:7): Việc chờ · Con người · Học vụ · Vận hành. Thay các kỳ vọng "5 module" của ui-admin-shell.ts (bản cũ, cần gỡ khi gộp).
// Phần "dải tab của NHÓM ≤ 6" phụ thuộc AdminShell.tsx (tệp chung, COO giữ — mục D3): chưa đổi vỏ thì ca đó đỏ và ghi rõ vì sao.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-admin-shell-4module.ts
import { mkUser, mkSuper, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN, adminGet } from "./ui";
import { prisma } from "@/lib/prisma";

const SKIP_44 = /nextjs-portal|KinToast|Mở rộng thanh bên/;

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  const course = await mkCourse(T.id, { name: "Toán 9 Vỏ" });
  const N = 3;
  for (let i = 0; i < N; i++) {
    const s = await mkUser({ name: `Em ${i}` });
    await prisma.courseReview.create({ data: { userId: s.id, courseId: course.id, rating: 5, comment: "tốt", status: "pending" } });
  }

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const railName = "Module quản trị";

  const ctx = await ctxFor(SA, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);
  const rail = () => pg.getByRole("navigation", { name: railName });

  section("Cấp 1: đúng 4 module theo thứ tự");
  await pg.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await rail().waitFor({ timeout: 120000 });
  const names = (await rail().getByRole("link").allInnerTexts()).map(n => n.replace(/\d+\s*$/, "").trim()).filter(n => n && !/^KiN\b/.test(n)); // adm-test: bỏ liên kết logo "KiN — Tổng quan quản trị"
  check("nhãn 'QUẢN TRỊ' + đúng 4 module: Việc chờ, Con người, Học vụ, Vận hành", ((await rail().locator(".kin-rail-role").first().textContent()) ?? "").trim() === "QUẢN TRỊ" && JSON.stringify(names.slice(0, 4)) === JSON.stringify(["Việc chờ", "Con người", "Học vụ", "Vận hành"]), names);
  // adm-test 02/11: DOM có 3 bản của thanh (thanh hẹp, thanh rộng, thanh dưới điện thoại) nên chỉ đếm bản ĐANG HIỆN.
  const curVis = await pg.evaluate(`[...document.querySelectorAll('nav[aria-label="Module quản trị"] [aria-current=page]')].filter(e => e.getBoundingClientRect().width > 0).map(e => (e.textContent || '').trim())`) as string[];
  check("'Việc chờ' đang ở (aria-current=page, đúng một nút đang hiện)", curVis.length === 1 && /^Việc chờ/.test(curVis[0]), curVis);
  await pg.waitForFunction(`document.querySelector('.kin-badge-dem')?.textContent === '${N}'`, null, { timeout: 60000 }).catch(() => {});
  check(`badge đúng '${N}' và CHỈ nằm trên 'Việc chờ'`, (await rail().locator(".kin-badge-dem").count()) === 1 && (await rail().locator(".kin-badge-dem").innerText()) === String(N));
  await shot(pg, "admin-shell-4module-1280");

  section("Mỗi module dẫn tới trang đầu được phép; Vận hành → /admin (Hôm nay)");
  await rail().getByRole("link", { name: /^Vận hành/ }).click();
  await pg.waitForURL(/\/admin$/, { timeout: 60000 });
  check("Vận hành → /admin, module sáng", await rail().getByRole("link", { name: /^Vận hành/ }).getAttribute("aria-current") === "page");
  await rail().getByRole("link", { name: /^Con người/ }).click();
  await pg.waitForURL(/\/admin\/gia-su/, { timeout: 60000 });
  check("Con người → /admin/gia-su (trang con đầu tiên)", /\/admin\/gia-su/.test(pg.url()));

  section("Dải tab: tối đa 6 tab mỗi lần (nhóm) — phụ thuộc AdminShell (D3)");
  await pg.goto(`${ADMIN}/admin/khoa-hoc`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const strip = pg.getByRole("navigation", { name: /^Trang của / });
  await strip.first().waitFor({ timeout: 120000 });
  const n = await strip.first().getByRole("link").count();
  check("Học vụ: dải tab hiện ≤ 6 liên kết (chỉ nhóm 'Lớp'), không dồn cả 13 trang", n <= 6, n);

  section("Mọi trang trong nav mở được, không 404");
  for (const href of ["/admin/gia-su", "/admin/hoc-sinh", "/admin/quan-tri-vien", "/admin/danh-gia", "/admin/topups", "/admin/nhat-ky", "/admin/trien-khai", "/admin/goi-pro", "/admin/ho-tro"]) {
    const r = await adminGet(pg, `${ADMIN}${href}`);
    check(`GET ${href} → 200`, r.status() === 200, r.status());
  }
  await ctx.close();

  section("Quản trị nội dung: không thấy Nhật ký, Doanh thu, Triển khai, Gói Pro, Lịch sử nạp Coin, Học sinh, Quản trị viên");
  const cc = await ctxFor(CA, { width: 1280, height: 900 });
  const pc = await cc.newPage(); watch(pc);
  await pc.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pc.getByRole("navigation", { name: railName }).waitFor({ timeout: 120000 });
  const links = (await pc.getByRole("link").allInnerTexts()).map(l => l.trim());
  check("không có lối vào các trang cấp 1", !links.some(l => /^(Nhật ký|Doanh thu|Triển khai và hạn mức|Gói KiN Pro|Lịch sử nạp Coin|Học sinh|Quản trị viên)$/.test(l)), links.filter(Boolean).slice(0, 40));
  await cc.close();

  section("Gia sư không vào vỏ quản trị");
  const ct = await ctxFor(T, { width: 1280, height: 900 });
  const pt = await ct.newPage(); watch(pt);
  const kd = await adminGet(pt, `${ADMIN}/api/admin/kiem-duyet?badge=1`);
  check("gia sư gọi /api/admin/kiem-duyet?badge=1 → 403", kd.status() === 403, kd.status());
  await ct.close();

  section("Điện thoại 390px: thanh dưới 60px, nút ≥ 44px");
  const cm = await ctxFor(SA, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pm.getByRole("navigation", { name: railName }).waitFor({ timeout: 120000 });
  const bar = await pm.evaluate(`(() => { const n = [...document.querySelectorAll('nav[aria-label="Module quản trị"]')].find(x => x.getBoundingClientRect().width > 0); const r = n.getBoundingClientRect(); return { h: Math.round(r.height), bottom: Math.round(innerHeight - r.bottom) }; })()`) as any;
  check("thanh module ở đáy, cao ≤ 60px", bar.h <= 60 && bar.bottom <= 1, bar);
  const small = await pm.evaluate(`(() => [...document.querySelectorAll("button, a[href]")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 43.5 && !e.closest("nextjs-portal") && !/Mở rộng thanh bên/.test(e.getAttribute("aria-label") || "") && !/styles-module__/.test(String(e.className)) && !e.closest("[data-feedback-toolbar],[data-annotation-popup],[data-annotation-marker]"); }).map(e => (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30)))()`) as string[];
  check("không nút/liên kết < 44px (trừ nextjs-portal, KinToast, 'Mở rộng thanh bên')", small.filter(s => !SKIP_44.test(s)).length === 0, small);
  check("390: không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  await shot(pm, "admin-shell-4module-390");
  await cm.close();

  check("không lỗi console/pageerror lạ", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
