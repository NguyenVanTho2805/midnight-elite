// Vỏ gia sư kiểu Outlook (Figma "Vỏ — Gia sư" 9:2): thanh module trái 79px / thanh dưới 60px, Hộp việc (danh sách + khung đọc),
// bảng "Khác", Tổng quan dời sang /lop-cua-toi/tong-quan, trạng thái trống / tải / lỗi, điện thoại 390px, quyền.
import { api, BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T0 = await mkTutor("Cô Mới"), TC = await mkTutor("Cô Gọn");
  const S = await mkUser({ name: "Em An" }), S2 = await mkUser({ name: "Em Bình" }), R = await mkUser({ name: "Người Báo" });
  for (const u of [T, T0]) await prisma.user.update({ where: { id: u.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  const c1 = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [S, S2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: c1.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: (await mkUser({ name: "Em Chờ" })).id, courseId: c1.id, status: "pending_consent" } });
  await api("PUT", "/api/tutor/payout-account", { as: T, body: { bankBin: "970436", accountNo: "0123456789", accountName: "Lan" } });
  const key = (await api("POST", "/api/tutor/payout-account/webhook-key", { as: T })).json.key;
  for (const [i, amt] of [[1, 500000], [2, 120000]] as const) await api("POST", `/api/webhooks/sepay/${T.id}`, { headers: { authorization: `Apikey ${key}` }, body: { id: 7000 + i, transferType: "in", transferAmount: amt, content: i === 1 ? "chuyen khoan" : "khong ma" } });
  const th = await prisma.thread.create({ data: { content: "Bài đăng bị báo cáo", authorId: S2.id, courseId: c1.id } });
  await prisma.threadReport.create({ data: { threadId: th.id, reporterId: R.id, reason: "Spam" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of 5/i.test(m.text())) errors.push(m.text()); }); };
  const RAIL = "Module của gia sư";

  const ctx = await ctxFor(T, { width: 1280, height: 800 });
  const pg = await ctx.newPage(); watch(pg);
  const rail = () => pg.getByRole("navigation", { name: RAIL });
  const mod = (name: string) => rail().getByRole(name === "Khác" ? "button" : "link", { name: new RegExp(`^${name}`) });

  section("Vào /lop-cua-toi → Hộp việc (danh sách + khung đọc)");
  await pg.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  const lb = pg.getByRole("listbox", { name: "Hộp việc" });
  await lb.waitFor({ timeout: 90000 });
  check("ở đúng /lop-cua-toi, không chuyển sang trang khác", new URL(pg.url()).pathname === "/lop-cua-toi", pg.url());

  section("Thanh module");
  check("nhãn vai trò 'GIA SƯ'", await rail().getByText("GIA SƯ").isVisible());
  for (const m of ["Hộp việc", "Lịch", "Lớp", "Học sinh", "Bài tập", "Thư viện", "Học phí", "Cài đặt"]) check(`module '${m}' là liên kết`, await mod(m).count() === 1);
  const order = await rail().getByRole("link").allInnerTexts();
  const idx = ["Hộp việc", "Lịch", "Lớp", "Học sinh", "Bài tập", "Thư viện", "Học phí", "Cài đặt"].map(l => order.findIndex(t => t.startsWith(l)));
  check("đúng thứ tự Figma 299:111821: Hộp việc, Lịch, Lớp, Học sinh, Bài tập, Thư viện, Học phí, Cài đặt (đợt dựng nền 23/10/2026: thêm Học sinh + Cài đặt, đổi nhãn Bài KT thành Bài tập)", idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1])), order);
  check("nút 'Khác' có aria-haspopup + aria-expanded=false", await mod("Khác").getAttribute("aria-haspopup") === "dialog" && await mod("Khác").getAttribute("aria-expanded") === "false");
  check("Hộp việc là mục đang ở (aria-current), chỉ một nút", await mod("Hộp việc").getAttribute("aria-current") === "page" && await rail().locator("[aria-current=page]").count() === 1);
  const clipped = await pg.evaluate(`[...document.querySelectorAll('nav[aria-label="${RAIL}"] a span.truncate, nav[aria-label="${RAIL}"] button span.truncate')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth).map(e => e.textContent)`) as string[];
  check("nhãn module hiện đủ chữ, không bị cắt '…'", clipped.length === 0, clipped);
  const small = await pg.evaluate(`[...document.querySelectorAll('nav[aria-label="${RAIL}"] span.truncate')].filter(e => e.offsetParent).map(e => parseFloat(getComputedStyle(e).fontSize)).filter(f => f < 11.1)`) as number[];
  check("nhãn module ≥ 11,1px (không còn 9,5px cũ)", small.length === 0, small);
  const rb = await rail().boundingBox();
  check("thanh rộng 79px, dọc bên trái", !!rb && Math.round(rb.width) === 79 && rb.x === 0, rb);
  check("mục cũ không còn: menu 226px, 'Doanh thu' trên thanh, biểu tượng emoji", await rail().getByRole("link", { name: /^Doanh thu/ }).count() === 0 && !/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(await rail().innerText()));
  const total = (await pg.evaluate(`fetch("/api/tutor/hop-viec").then(r => r.json())`) as any).total as number;
  const badge = mod("Hộp việc").locator(".kin-badge-dem");
  check("số đỏ trên Hộp việc = tổng việc (API) và có nhãn chữ", total === 4 && (await badge.innerText()) === String(total) && (await badge.getAttribute("aria-label")) === `${total} việc cần xử lý`, total);
  check("các module khác không có số đỏ", await rail().locator(".kin-badge-dem").count() === 1);
  check("dải trên 48px: logo KiN dẫn về Hộp việc + tên người dùng", await pg.getByRole("link", { name: /KiN — Hộp việc/ }).getAttribute("href") === "/lop-cua-toi" && await pg.getByText("Cô Lan").first().isVisible());
  check("Bài tập → /admin/thi-thu (chạy ngay trên tên miền chính, trong vỏ gia sư); Thư viện → /thu-vien; Học sinh → /admin/hoc-sinh; Cài đặt → /lop-cua-toi/cai-dat", await mod("Bài tập").getAttribute("href") === "/admin/thi-thu" && await mod("Thư viện").getAttribute("href") === "/thu-vien" && await mod("Học sinh").getAttribute("href") === "/admin/hoc-sinh" && await mod("Cài đặt").getAttribute("href") === "/lop-cua-toi/cai-dat");

  section("Danh sách + khung đọc");
  const opts = lb.getByRole("option");
  check("có 3 dòng: đối soát, chờ phụ huynh, báo cáo", await opts.count() === 3, await opts.allInnerTexts());
  check("dòng đầu đang chọn; một dòng tabIndex=0 (roving)", await opts.nth(0).getAttribute("aria-selected") === "true" && await lb.locator("[role=option][tabindex='0']").count() === 1);
  const h1 = pg.getByRole("heading", { level: 1 });
  check("việc khẩn đứng đầu: '2 khoản tiền vào cần đối soát' hiện ở khung đọc", /2 khoản tiền vào cần đối soát/.test(await h1.innerText()), await h1.innerText());
  check("dòng có CHỮ trạng thái, không chỉ chấm màu", await lb.locator("[data-kin-status]", { hasText: "Chờ đối soát" }).isVisible() && await lb.locator("[data-kin-status]", { hasText: "Chờ phụ huynh" }).isVisible() && await lb.locator("[data-kin-status]", { hasText: "Chờ xử lý" }).isVisible());
  const items = pg.getByRole("list", { name: "Các việc cụ thể" });
  check("khung đọc liệt kê từng khoản: số tiền + nội dung chuyển khoản", await items.getByText(/500\.000đ/).isVisible() && await items.getByText(/khong ma/).isVisible());
  check("nút chính 'Đối soát' dẫn tới tab đối soát của Học phí", await pg.getByRole("link", { name: "Đối soát", exact: true }).first().getAttribute("href") === "/lop-cua-toi/hoc-phi?tab=doi-soat");
  await opts.nth(1).click();
  check("bấm dòng khác → khung đọc đổi, aria-selected chuyển", /học sinh chờ phụ huynh xác nhận/.test(await h1.innerText()) && await opts.nth(1).getAttribute("aria-selected") === "true" && await opts.nth(0).getAttribute("aria-selected") === "false", await h1.innerText());
  check("dòng chờ phụ huynh dẫn tới danh sách học viên của lớp", await items.getByRole("link", { name: "Em Chờ" }).getAttribute("href") === `/admin/khoa-hoc/${c1.id}/hoc-vien`);
  await opts.nth(1).focus();
  await pg.keyboard.press("ArrowDown");
  check("phím ↓ chọn dòng kế, focus theo", await opts.nth(2).getAttribute("aria-selected") === "true" && await pg.evaluate(`document.activeElement?.getAttribute("role")`) === "option");
  check("khung đọc báo cáo → nút 'Mở Kiểm duyệt' dẫn tới /lop-cua-toi/kiem-duyet", await pg.getByRole("link", { name: "Mở Kiểm duyệt" }).getAttribute("href") === "/lop-cua-toi/kiem-duyet");
  await pg.keyboard.press("Home");
  check("phím Home chọn dòng đầu", await opts.nth(0).getAttribute("aria-selected") === "true");
  const lay = await pg.evaluate(`(() => {
    const list = document.querySelector('section[aria-label="Danh sách"]').getBoundingClientRect(), read = document.querySelector('section[aria-label="Chi tiết"]').getBoundingClientRect();
    return { listW: Math.round(list.width), readLeft: Math.round(read.left), pageScroll: document.documentElement.scrollHeight - window.innerHeight, h: Math.round(list.top) };
  })()`) as any;
  check("danh sách rộng 330px, khung đọc sau thanh module + danh sách (79 + 330)", lay.listW === 330 && lay.readLeft === 79 + 330, lay);
  check("trang không cuộn dọc (hai khung tự cuộn)", lay.pageScroll <= 1, lay);
  await shot(pg, "tutor-shell-hop-viec");

  section("Bảng 'Khác'");
  await mod("Khác").click();
  const dlg = pg.getByRole("dialog", { name: "Các mục khác" });
  check("mở bảng, aria-expanded=true", await dlg.isVisible() && await mod("Khác").getAttribute("aria-expanded") === "true");
  const want: Record<string, string> = {
    "Tổng quan": "/lop-cua-toi/tong-quan", "Kế hoạch buổi": "/lop-cua-toi/ke-hoach-buoi", "Báo cáo tháng": "/lop-cua-toi/bao-cao-thang",
    "Kiểm duyệt cộng đồng": "/lop-cua-toi/kiem-duyet", "Doanh thu": "/lop-cua-toi/doanh-thu", "Hồ sơ gia sư": "/lop-cua-toi/ho-so",
    "Bài đăng tìm học sinh": "/lop-cua-toi/bai-dang", "Cài đặt": "/lop-cua-toi/cai-dat",
  };
  for (const [l, href] of Object.entries(want)) check(`mục '${l}' → ${href}`, await dlg.getByRole("link", { name: l, exact: true }).getAttribute("href") === href);
  check("đủ 4 module bật thì KHÔNG còn mục 'Thêm module'", await dlg.getByRole("link", { name: "Thêm module" }).count() === 0);
  check("có 'Đăng xuất' và tên người dùng", await dlg.getByRole("button", { name: "Đăng xuất" }).isVisible() && await dlg.getByText("Cô Lan").isVisible());
  await shot(pg, "tutor-shell-khac");
  await pg.keyboard.press("Escape");
  check("Esc đóng bảng", await dlg.count() === 0);
  await mod("Khác").click();
  await pg.mouse.click(900, 400);
  check("bấm ra ngoài đóng bảng", await dlg.count() === 0);
  await mod("Khác").click();
  await mod("Khác").click();
  check("bấm 'Khác' lần nữa khi đang mở → đóng, không đóng rồi mở lại", await dlg.count() === 0);
  await mod("Khác").click();
  await dlg.getByRole("link", { name: "Tổng quan", exact: true }).click();
  await pg.waitForURL(/\/lop-cua-toi\/tong-quan/, { timeout: 90000 });
  await pg.getByRole("heading", { name: "Lớp của tôi" }).waitFor({ timeout: 60000 });
  check("chọn 'Tổng quan' → sang trang số liệu, bảng tự đóng, 'Khác' sáng, Hộp việc hết sáng", await dlg.count() === 0 && await mod("Khác").getAttribute("aria-current") === "page" && await mod("Hộp việc").getAttribute("aria-current") === null);
  check("Tổng quan vẫn có số liệu + 'Việc cần làm' như trước", await pg.getByRole("heading", { name: "Việc cần làm" }).isVisible());

  section("Hộp việc chỉ sáng ở đúng /lop-cua-toi");
  await mod("Lịch").click();
  await pg.waitForURL(/\/lop-cua-toi\/lich/, { timeout: 90000 });
  check("sang Lịch: Lịch sáng, Hộp việc và Khác tắt", await mod("Lịch").getAttribute("aria-current") === "page" && await mod("Hộp việc").getAttribute("aria-current") === null && await mod("Khác").getAttribute("aria-current") === null);
  await mod("Hộp việc").click();
  await lb.waitFor({ timeout: 90000 });
  check("bấm Hộp việc → về lại danh sách", await mod("Hộp việc").getAttribute("aria-current") === "page");
  await pg.goto(`${BASE}/lop-cua-toi/cai-dat`, { waitUntil: "networkidle", timeout: 120000 });
  check("trang Cài đặt: mục 'Cài đặt' trên thanh sáng (Figma có mục này; trước đây 'Khác' sáng), 'Khác' và Hộp việc không sáng", await mod("Cài đặt").getAttribute("aria-current") === "page" && await mod("Khác").getAttribute("aria-current") === null && await mod("Hộp việc").getAttribute("aria-current") === null);

  section("Trạng thái tải / lỗi");
  const ctx2 = await ctxFor(T, { width: 1280, height: 800 });
  const p2 = await ctx2.newPage(); watch(p2);
  let delayMs = 1500, failNext = false;
  await p2.route("**/api/tutor/hop-viec", async route => {
    if (failNext) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) });
    await new Promise(r => setTimeout(r, delayMs));
    return route.continue();
  });
  await p2.goto(`${BASE}/lop-cua-toi`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p2.locator("[aria-busy=true]").first().waitFor({ timeout: 60000 });
  check("đang tải lần đầu: khung xương (aria-busy), không vòng xoay", await p2.locator("[aria-busy=true]").count() >= 1 && await p2.locator(".animate-spin").count() === 0);
  await p2.getByRole("listbox", { name: "Hộp việc" }).waitFor({ timeout: 60000 });
  check("tải xong: khung xương biến mất", await p2.locator("[aria-busy=true]").count() === 0);
  failNext = true;
  await p2.evaluate(`window.dispatchEvent(new Event("focus"))`);
  const strip = p2.locator('[role="alert"]:not(#__next-route-announcer__)');
  await strip.waitFor({ timeout: 30000 });
  check("lỗi tải lại: dải báo lỗi + nút 'Thử lại'", await strip.getByText("Không tải được Hộp việc.").isVisible() && await strip.getByRole("button", { name: "Thử lại" }).isVisible());
  check("danh sách cũ vẫn còn dưới dải lỗi", await p2.getByRole("listbox", { name: "Hộp việc" }).getByRole("option").count() === 3);
  failNext = false; delayMs = 0;
  await strip.getByRole("button", { name: "Thử lại" }).click();
  await strip.waitFor({ state: "detached", timeout: 30000 });
  check("'Thử lại' thành công → dải lỗi biến mất", await strip.count() === 0);
  await ctx2.close();

  section("Gia sư chưa có việc nào");
  const ctx3 = await ctxFor(T0, { width: 1280, height: 800 });
  const p3 = await ctx3.newPage(); watch(p3);
  await p3.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await p3.getByText("Không có việc nào đang chờ bạn.").waitFor({ timeout: 60000 });
  check("danh sách trống có câu rõ ràng + khung đọc 'Hộp việc trống'", await p3.getByText("Hộp việc trống").isVisible());
  check("không hiện số đỏ khi không có việc", await p3.locator(".kin-badge-dem").count() === 0);
  await shot(p3, "tutor-shell-trong");
  await ctx3.close();

  section("Chế độ gọn: Hộp việc tắt");
  const cg = await ctxFor(TC, { width: 1280, height: 800 });
  const pc = await cg.newPage(); watch(pc);
  await pc.goto(`${BASE}/lop-cua-toi`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pc.waitForURL(/\/lop-cua-toi\/lich/, { timeout: 90000 });
  check("Hộp việc chưa bật → /lop-cua-toi chuyển về Lịch", /\/lop-cua-toi\/lich$/.test(pc.url()), pc.url());
  await pc.getByRole("navigation", { name: RAIL }).waitFor();
  check("thanh chỉ có Lịch + Học phí + Cài đặt (+ logo, + Khác)", (await pc.getByRole("navigation", { name: RAIL }).getByRole("link").allInnerTexts()).filter(t => t.trim() !== "KiN").length === 3);
  await pc.getByRole("navigation", { name: RAIL }).getByRole("button", { name: /^Khác/ }).click();
  check("bảng Khác có 'Thêm module' → /lop-cua-toi/cai-dat#module", await pc.getByRole("dialog", { name: "Các mục khác" }).getByRole("link", { name: "Thêm module" }).getAttribute("href") === "/lop-cua-toi/cai-dat#module");
  await pc.goto(`${BASE}/lop-cua-toi/tong-quan`, { waitUntil: "networkidle", timeout: 120000 });
  check("Tổng quan vẫn mở được khi Hộp việc tắt", await pc.getByRole("heading", { name: "Lớp của tôi" }).isVisible());
  await cg.close();

  section("Điện thoại 390px");
  const cm = await ctxFor(T, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await pm.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });
  const bar = pm.getByRole("navigation", { name: RAIL });
  await bar.waitFor({ timeout: 90000 });
  const lbm = pm.getByRole("listbox", { name: "Hộp việc" });
  await lbm.waitFor({ timeout: 60000 });
  const bb = await bar.boundingBox();
  check("thanh module thành thanh dưới cao 60px, dính đáy", !!bb && Math.round(bb.height) === 60 && Math.round(bb.y + bb.height) === 800, bb);
  check("chỉ MỘT thanh module nhìn thấy", await pm.getByRole("navigation", { name: RAIL }).count() === 1);
  check("điện thoại: thấy danh sách, chưa thấy khung đọc", await lbm.isVisible() && await pm.getByRole("heading", { level: 1 }).count() === 0);
  const hit = await pm.evaluate(`[...document.querySelectorAll('nav[aria-label="${RAIL}"] a, nav[aria-label="${RAIL}"] button')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height))`) as number[];
  check("4 tab theo Figma 299:116033 (Hộp việc, Lịch, Lớp, Học phí), mỗi nút cao ≥ 44px", hit.length === 4 && hit.every(h => h >= 44), hit);
  const wid = await pm.evaluate(`[...document.querySelectorAll('nav[aria-label="${RAIL}"] a, nav[aria-label="${RAIL}"] button')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().width))`) as number[];
  check("mỗi nút rộng ≥ 44px (390 / 4 ≈ 90)", wid.every(w => w >= 44), wid);
  check("không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  check("nội dung không bị thanh dưới che (đáy danh sách ≤ 740)", await pm.evaluate(`document.querySelector('[role=listbox]').getBoundingClientRect().bottom <= 740`) as boolean);
  await shot(pm, "tutor-shell-mobile");
  await lbm.getByRole("option").nth(0).click();
  await pm.getByRole("heading", { level: 1 }).waitFor({ timeout: 30000 });
  check("chọn một dòng → hiện khung đọc, ẩn danh sách", await pm.getByRole("heading", { level: 1 }).isVisible() && !(await lbm.isVisible()));
  await shot(pm, "tutor-shell-doc-mobile");
  await pm.getByRole("button", { name: /Quay lại/ }).click();
  check("nút '← Quay lại' trở về danh sách", await lbm.isVisible());
  // Điện thoại theo Figma chỉ có 4 tab: bảng "Khác" mở từ menu tài khoản → "Tất cả mục".
  await pm.getByRole("button", { name: /^Tài khoản của/ }).click();
  await pm.getByRole("menuitem", { name: "Tất cả mục" }).click();
  const dm = pm.getByRole("dialog", { name: "Các mục khác" });
  const db = await dm.boundingBox();
  check("bảng 'Khác' (mở từ menu tài khoản) nổi trên thanh dưới, không tràn khỏi màn hình", !!db && db.y >= 0 && db.y + db.height <= 800 - 60 + 1 && db.x >= 0 && db.x + db.width <= 390, db);
  check("mọi mục trong bảng cao ≥ 44px", (await dm.evaluate(`[...document.querySelectorAll('[role=dialog] a, [role=dialog] button')].map(e => Math.round(e.getBoundingClientRect().height))`) as number[]).every(h => h >= 44));
  await shot(pm, "tutor-shell-khac-mobile");
  await cm.close();

  section("Quyền");
  const cs = await ctxFor(S, { width: 1280, height: 800 });
  const ps = await cs.newPage(); watch(ps);
  await ps.goto(`${BASE}/lop-cua-toi/tong-quan`, { waitUntil: "networkidle", timeout: 120000 });
  await ps.waitForURL(u => u.pathname === "/lop-cua-toi", { timeout: 60000 }).catch(() => {}); // NC2-004: chuyển hướng phía trình duyệt sau networkidle
  check("học viên vào /tong-quan → chuyển về /lop-cua-toi (danh sách lớp của họ)", new URL(ps.url()).pathname === "/lop-cua-toi", ps.url());
  check("học viên không thấy Hộp việc / thanh module gia sư", await ps.getByRole("listbox", { name: "Hộp việc" }).count() === 0 && await ps.getByRole("navigation", { name: RAIL }).count() === 0);
  await cs.close();
  const ca = await ctxFor(null);
  const pa = await ca.newPage(); watch(pa);
  await pa.goto(`${BASE}/lop-cua-toi/tong-quan`, { waitUntil: "networkidle", timeout: 120000 });
  await pa.waitForURL(/\/dang-nhap/, { timeout: 60000 });
  check("chưa đăng nhập → /dang-nhap?redirect=… nhớ trang đang vào", new URL(pa.url()).searchParams.get("redirect") === "/lop-cua-toi/tong-quan", pa.url());
  for (const path of ["/lop-cua-toi", "/lop-cua-toi/lich", "/lop-cua-toi/hoc-phi", "/lop-cua-toi/doanh-thu"]) {
    await pa.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await pa.waitForURL(/\/dang-nhap/, { timeout: 60000 });
    check(`${path} khi chưa đăng nhập → đăng nhập xong quay lại đúng trang (redirect=)`, new URL(pa.url()).searchParams.get("redirect") === path, pa.url());
  }
  await ca.close();

  section("Không lỗi trình duyệt");
  check("không lỗi console / pageerror", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
