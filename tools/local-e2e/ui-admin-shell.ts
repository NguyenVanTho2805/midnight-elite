// Vỏ quản trị (BU-08 viết lại 02/11/2026 bởi adm-test). Bản cũ kiểm vỏ kiểu Outlook 3 khung (listbox "Chờ kiểm duyệt", 5 module) — đã thay bằng Hàng chờ một cửa
// (ui-admin-hang-cho) và 4 module (ui-admin-shell-4module). Bài này giữ phần còn lại của hợp đồng vỏ theo VAI:
//  • cấp 1: nút "Xem thử trang học sinh" (BU-00), thanh bên cũ không còn; quản trị nội dung: module khớp adminNav.visibleModules, không lối vào trang cấp 1;
//  • gia sư mở /admin/kiem-duyet → Hộp việc /lop-cua-toi (không vào được /admin*); học sinh bị đưa khỏi;
//  • điện thoại 390px: thanh dưới 60px dính đáy, mỗi nút module ≥ 44px, đúng 4 nút cho cấp 1, không tràn ngang;
//  • không role="alert" trần trong cây admin; không console.error lạ (lọc cảnh báo React 19 "script tag" đã biết, KHÔNG nới rộng hơn).
import { BASE, mkTutor, mkUser, mkSuper, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { visibleModules } from "@/lib/adminNav";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Em An" });

  await launch();
  const errors: string[] = [];
  // Bộ lọc giữ như ui-admin-shell cũ: tài nguyên 4xx/5xx, favicon, mạng; THÊM đúng cảnh báo hydrate/script của React 19 ở dev (chủ đề "script tag") thay vì nới rộng.
  const NOISE = /Failed to load resource|favicon|net::ERR|status of (4|5)|Encountered a script tag while rendering React component/i;
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !NOISE.test(m.text())) errors.push(m.text()); }); };
  const railName = "Module quản trị";

  section("Cấp 1 (1280)");
  const ctx = await ctxFor(SA, { width: 1280, height: 800 });
  const pg = await ctx.newPage(); watch(pg);
  await pg.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.getByRole("navigation", { name: railName }).first().waitFor({ timeout: 120000 });
  const preview = pg.locator("a[data-preview-student]");
  check("nút 'Xem thử trang học sinh' → https://midnightelite-edu.com/dang-nhap?redirect=%2Fstudent%2Fviec-cua-toi (tab mới)", await preview.count() === 1 && (await preview.innerText()).trim() === "Xem thử trang học sinh" && await preview.getAttribute("href") === "https://midnightelite-edu.com/dang-nhap?redirect=%2Fstudent%2Fviec-cua-toi" && await preview.getAttribute("target") === "_blank", await preview.getAttribute("href"));
  check("thanh bên cũ (neumorphic) và dòng 'Hệ thống hoạt động bình thường' giả không còn", await pg.getByLabel("Menu quản trị").count() === 0 && await pg.getByText("Hệ thống hoạt động bình thường").count() === 0);
  check("không còn khung Outlook cũ: không listbox 'Chờ kiểm duyệt'", await pg.getByRole("listbox", { name: "Chờ kiểm duyệt" }).count() === 0);
  await pg.getByText("Hàng chờ trống").first().waitFor({ timeout: 60000 }).catch(() => {});
  check("hàng chờ mới có mặt (DB trống → 'Hàng chờ trống')", await pg.getByText("Hàng chờ trống").count() >= 1);
  // bỏ bộ thông báo tuyến của Next (#__next-route-announcer__ role=alert, README: "getByRole(alert) dính cả bộ thông báo tuyến của Next") và thanh công cụ dev
  const alerts = await pg.locator('[role="alert"]').evaluateAll(els => els.filter(e => e.id !== "__next-route-announcer__" && !e.closest("nextjs-portal") && !e.closest("[class*='styles-module__']")).map(e => e.outerHTML.slice(0, 100)));
  check("không role=\"alert\" trần trong cây admin (Kiểm duyệt)", alerts.length === 0, alerts);
  await shot(pg, "admin-shell-cap1-1280");
  await ctx.close();

  section("Quản trị nội dung: module khớp adminNav, không lối vào trang cấp 1");
  const cc = await ctxFor(CA, { width: 1280, height: 800 });
  const pc = await cc.newPage(); watch(pc);
  await pc.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const railC = pc.getByRole("navigation", { name: railName }).first();
  await railC.waitFor({ timeout: 120000 });
  const namesC = ((await pc.evaluate(`[...(([...document.querySelectorAll('nav[aria-label="${railName}"]')].find(n => n.getBoundingClientRect().width > 0))?.querySelectorAll('a.kin-rail-it') ?? [])].map(a => (a.textContent || '').replace(/\\d+\\s*$/, '').trim())`)) as string[]).filter(n => n && !/^KiN\b/.test(n));
  const expectC = visibleModules("admin_content").map(m => m.label);
  check("module của quản trị nội dung = adminNav.visibleModules('admin_content')", JSON.stringify(namesC) === JSON.stringify(expectC), { namesC, expectC });
  const links = (await pc.getByRole("link").allInnerTexts()).map(l => l.trim());
  check("không lối vào Nhật ký, Doanh thu, Triển khai, Gói KiN Pro, Lịch sử nạp Coin, Học sinh, Quản trị viên", !links.some(l => /^(Nhật ký|Doanh thu|Triển khai và hạn mức|Gói KiN Pro|Lịch sử nạp Coin|Học sinh|Quản trị viên)$/.test(l)), links.filter(Boolean).slice(0, 40));
  await cc.close();

  section("Gia sư: không còn ở /admin/*");
  const ct = await ctxFor(T, { width: 1280, height: 800 });
  const pt = await ct.newPage(); watch(pt);
  await pt.goto(`${BASE}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pt.waitForURL(/\/lop-cua-toi$/, { timeout: 120000 });
  await pt.getByRole("navigation", { name: "Module của gia sư" }).first().waitFor({ timeout: 90000 });
  check("gia sư mở /admin/kiem-duyet → Hộp việc /lop-cua-toi, giữ tên miền chính", new URL(pt.url()).pathname === "/lop-cua-toi" && !new URL(pt.url()).host.startsWith("admin."), pt.url());
  check("vỏ là của GIA SƯ; không thanh bên quản trị, không bảng hàng chờ", (await pt.getByRole("navigation", { name: railName }).count()) === 0 && (await pt.locator("[data-queue-table]").count()) === 0);
  for (const p of ["/admin", "/admin/gia-su", "/admin/ho-so-gia-su"]) {
    await pt.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await pt.waitForURL(u => !/^\/admin(\/|$)/.test(u.pathname), { timeout: 60000 }).catch(() => {});
    check(`gia sư mở ${p} → không ở lại /admin* (${new URL(pt.url()).pathname})`, !/^\/admin(\/|$)/.test(new URL(pt.url()).pathname), pt.url());
  }
  await ct.close();

  section("Điện thoại 390px (cấp 1)");
  const cm = await ctxFor(SA, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pm.getByRole("navigation", { name: railName }).first().waitFor({ timeout: 120000 });
  await pm.waitForTimeout(1500);
  const bar = await pm.evaluate(`(() => { const n = [...document.querySelectorAll('nav[aria-label="${railName}"]')].find(x => x.getBoundingClientRect().width > 0); const r = n.getBoundingClientRect(); return { h: Math.round(r.height), bottom: Math.round(innerHeight - r.bottom), links: [...n.querySelectorAll('a')].map(a => Math.round(a.getBoundingClientRect().height)) }; })()`) as any;
  check("thanh module ở đáy, cao ≤ 60px, dính đáy", bar.h <= 60 && bar.bottom <= 1, bar);
  check("đúng 4 nút module, mỗi nút cao ≥ 44px", bar.links.length === 4 && bar.links.every((h: number) => h >= 44), bar.links);
  check("390: không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  await shot(pm, "admin-shell-cap1-390");
  await cm.close();

  section("Học sinh không vào được quản trị");
  const cs = await ctxFor(A, { width: 1280, height: 800 });
  const ps = await cs.newPage(); watch(ps);
  await ps.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await ps.waitForURL(u => !/\/admin\/kiem-duyet/.test(u.pathname), { timeout: 60000 }).catch(() => {});
  check("học sinh bị đưa khỏi /admin/kiem-duyet, không thấy bảng hàng chờ", (await ps.locator("[data-queue-table]").count()) === 0 && !/\/admin\/kiem-duyet/.test(new URL(ps.url()).pathname), ps.url());
  await cs.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error lạ", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
