// Vỏ quản trị kiểu Outlook (Figma 11:287): thanh module, dải tab trang con, "Chờ kiểm duyệt" (danh sách + khung đọc + lệnh), quyền từng vai, điện thoại 390px.
import { BASE, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Em An" }), B = await mkUser({ name: "Em Bình" });
  const mine = await mkCourse(T.id, { name: "Toán 9 của cô Lan" });
  const ok = await mkUser({ name: "Gia sư chờ duyệt", emailVerified: true }), unv = await mkUser({ name: "Gia sư chưa xác thực", emailVerified: false }), rej = await mkUser({ name: "Gia sư bị từ chối", emailVerified: true });
  const d0 = Date.now() - 5 * 86_400_000;
  for (const [u, k, sub] of [[ok, 0, ["Toán", "Lý"]], [unv, 1, []], [rej, 2, ["Văn"]]] as const) await prisma.user.update({ where: { id: u.id }, data: { tutorAppliedAt: new Date(d0 + k * 1000), bio: `Giới thiệu của ${u.name}`, subjects: [...sub], city: "Hà Nội" } });
  const th = (content: string, courseId: string | null) => prisma.thread.create({ data: { content, authorId: A.id, courseId, category: "hoi-dap" } });
  const t1 = await th("BAI_GO_BO nội dung vi phạm", null), t2 = await th("BAI_LOP_COLAN lạc đề", mine.id);
  const r1 = await prisma.threadReport.create({ data: { threadId: t1.id, reporterId: B.id, reason: "Quảng cáo" } });
  await prisma.threadReport.create({ data: { threadId: t2.id, reporterId: B.id, reason: "Lạc đề" } });
  const q = await prisma.question.create({ data: { authorId: A.id, title: "CAU_HOI_X", content: "nội dung", bountyPaid: 0 } });
  const ans = await prisma.answer.create({ data: { questionId: q.id, authorId: A.id, content: "Trả lời sai", rewardPaid: 20 } });
  await prisma.answerReport.create({ data: { answerId: ans.id, reporterId: B.id, reason: "Sai kiến thức" } });
  await prisma.tutorProfileReport.create({ data: { tutorId: T.id, reason: "Ảnh không phải của gia sư" } });
  const TOTAL = 3 + 2 + 1 + 1; // 3 gia sư, 2 bài viết, 1 hồ sơ, 1 câu trả lời

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const railName = "Module quản trị";

  const ctx = await ctxFor(SA, { width: 1280, height: 800 });
  const pg = await ctx.newPage(); watch(pg);
  const rail = () => pg.getByRole("navigation", { name: railName });
  const mod = (n: string) => rail().getByRole("link", { name: new RegExp(`^${n}`) });
  const lb = () => pg.getByRole("listbox", { name: "Chờ kiểm duyệt" });
  const badge = () => rail().locator(".kin-badge-dem").first();

  section("Thanh module và hàng chờ");
  await pg.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "networkidle", timeout: 120000 });
  await lb().waitFor({ timeout: 90000 });
  check("nhãn 'QUẢN TRỊ' + 4 module (Kiểm duyệt, Người dùng, Nội dung, Báo cáo)", await rail().getByText("QUẢN TRỊ").isVisible() && (await rail().getByRole("link").count()) === 4);
  check("'Kiểm duyệt' đang ở (aria-current=page, đúng một nút)", await mod("Kiểm duyệt").getAttribute("aria-current") === "page" && await rail().locator("[aria-current=page]").count() === 1);
  check(`badge '${TOTAL}' có nhãn chữ '${TOTAL} việc cần xử lý'`, (await badge().innerText()) === String(TOTAL) && (await badge().getAttribute("aria-label")) === `${TOTAL} việc cần xử lý`);
  check("badge CHỈ nằm trên Kiểm duyệt", await rail().locator(".kin-badge-dem").count() === 1 && (await mod("Kiểm duyệt").locator(".kin-badge-dem").count()) === 1);
  const tabs = pg.getByRole("navigation", { name: "Trang của Kiểm duyệt" });
  check("dải tab 5 trang con, 'Hàng chờ' đang ở", (await tabs.getByRole("link").count()) === 5 && await tabs.getByRole("link", { name: "Hàng chờ" }).getAttribute("aria-current") === "page");
  check("thanh bên cũ (neumorphic) và dòng 'Hệ thống hoạt động bình thường' giả không còn", await pg.getByLabel("Menu quản trị").count() === 0 && await pg.getByText("Hệ thống hoạt động bình thường").count() === 0);
  const opts = lb().getByRole("option");
  check(`${TOTAL} dòng; dòng đầu đang chọn; chờ lâu nhất đứng đầu (hồ sơ gia sư)`, await opts.count() === TOTAL && await opts.nth(0).getAttribute("aria-selected") === "true" && /Gia sư chờ duyệt/.test(await opts.nth(0).innerText()), await opts.count());
  check("tiêu đề danh sách theo Figma: 'Chờ kiểm duyệt' + 'Hàng chờ nội dung và hồ sơ'", await pg.getByRole("heading", { name: "Chờ kiểm duyệt" }).isVisible() && await pg.getByText("Hàng chờ nội dung và hồ sơ").isVisible());
  const h1 = pg.getByRole("heading", { level: 1 });
  check("khung đọc: tiêu đề + giới thiệu + lệnh Duyệt / Từ chối", /Hồ sơ gia sư: Gia sư chờ duyệt/.test(await h1.innerText()) && await pg.getByText("Giới thiệu của Gia sư chờ duyệt").isVisible() && await pg.getByRole("button", { name: "Duyệt gia sư" }).isEnabled() && await pg.getByRole("button", { name: "Từ chối" }).isEnabled());

  section("Bố cục");
  const lay = await pg.evaluate(`(() => {
    const list = document.querySelector('section[aria-label="Danh sách"]').getBoundingClientRect();
    const read = document.querySelector('section[aria-label="Chi tiết"]').getBoundingClientRect();
    return { listW: Math.round(list.width), readLeft: Math.round(read.left), pageScroll: document.documentElement.scrollHeight - window.innerHeight, readBottom: Math.round(read.bottom), vh: window.innerHeight, lbOverflow: getComputedStyle(document.querySelector('[role=listbox]')).overflowY };
  })()`) as any;
  check("danh sách 330px cạnh thanh module 79px; mỗi khung cuộn riêng", lay.listW === 330 && lay.readLeft === 79 + 330 && lay.lbOverflow === "auto", lay);
  check("trang không cuộn dọc; khung đọc chạm đáy màn hình (dải trên + tab đã trừ)", lay.pageScroll <= 1 && Math.abs(lay.readBottom - lay.vh) <= 1, lay);
  await shot(pg, "admin-shell-kiem-duyet");

  section("Duyệt / từ chối hồ sơ gia sư");
  await opts.nth(1).click();
  check("dòng 2 (chưa xác thực email): nhãn đỏ có chữ, nút Duyệt bị khoá", await pg.getByText("Chưa xác thực email").first().isVisible() && await pg.getByRole("button", { name: "Duyệt gia sư" }).isDisabled() && await pg.getByText("Chưa duyệt được").isVisible());
  await opts.nth(0).click();
  await pg.getByRole("button", { name: "Từ chối" }).click();
  const group = pg.getByRole("group", { name: "Từ chối" });
  check("Từ chối → hỏi lý do (ô nhập + bộ đếm /500); nút xác nhận khoá khi chưa nhập", await group.isVisible() && await group.getByText("0/500").isVisible() && await group.getByRole("button", { name: /^Xác nhận/ }).isDisabled());
  await group.getByRole("textbox").fill("Chưa đủ thông tin");
  check("nhập lý do → nút xác nhận mở, bộ đếm chạy", await group.getByRole("button", { name: /^Xác nhận: Từ chối/ }).isEnabled() && await group.getByText("17/500").isVisible());
  await group.getByRole("button", { name: "Huỷ" }).click();
  check("Huỷ → đóng khung lý do, chưa gửi gì", await group.count() === 0 && (await prisma.user.findUnique({ where: { id: ok.id } }))?.tutorRejectedAt === null);
  await pg.getByRole("button", { name: "Duyệt gia sư" }).click();
  await pg.waitForFunction(`document.querySelectorAll('[role=option]').length === ${TOTAL - 1}`, null, { timeout: 30000 });
  check("Duyệt → dòng biến mất ngay, DB: thành gia sư", await opts.count() === TOTAL - 1 && (await prisma.user.findUnique({ where: { id: ok.id } }))?.tutorVerified === true);
  await pg.waitForFunction(`document.querySelector('.kin-badge-dem')?.textContent === '${TOTAL - 1}'`, null, { timeout: 15000 });
  check(`badge trên thanh module giảm theo: ${TOTAL - 1}`, (await badge().getAttribute("aria-label")) === `${TOTAL - 1} việc cần xử lý`);
  check("khung đọc chuyển sang dòng kế tiếp (không trống)", /Hồ sơ gia sư: /.test(await h1.innerText()));
  await opts.filter({ hasText: "Gia sư bị từ chối" }).click();
  await pg.getByRole("button", { name: "Từ chối" }).click();
  await pg.getByRole("group", { name: "Từ chối" }).getByRole("textbox").fill("Chưa đủ kinh nghiệm");
  await pg.getByRole("button", { name: /^Xác nhận: Từ chối/ }).click();
  await pg.waitForFunction(`document.querySelectorAll('[role=option]').length === ${TOTAL - 2}`, null, { timeout: 30000 });
  const rejDb = await prisma.user.findUnique({ where: { id: rej.id } });
  check("Từ chối kèm lý do → DB lưu lý do, người nộp vẫn là học viên", rejDb?.tutorRejectedAt !== null && rejDb?.tutorRejectReason === "Chưa đủ kinh nghiệm" && rejDb?.role === "student");

  section("Báo cáo bài viết: hỏi lại trước khi gỡ");
  await opts.filter({ hasText: "Bài viết bị báo cáo" }).first().click();
  await pg.getByRole("button", { name: "Gỡ bài viết" }).click();
  const cg = pg.getByRole("group", { name: "Gỡ bài viết" });
  check("Gỡ bài → hiện câu hỏi lại (không hoàn tác), chưa gửi", await cg.getByText(/Bài viết sẽ bị gỡ khỏi cộng đồng/).isVisible() && (await prisma.thread.findUnique({ where: { id: t1.id } }))?.deletedAt === null);
  await cg.getByRole("button", { name: "Xác nhận: Gỡ bài viết" }).click();
  await pg.waitForFunction(`document.querySelectorAll('[role=option]').length === ${TOTAL - 3}`, null, { timeout: 30000 });
  check("xác nhận → bài bị xoá mềm trong DB, dòng biến mất", !!(await prisma.thread.findUnique({ where: { id: t1.id } }))?.deletedAt);
  void r1;

  section("Báo cáo câu trả lời: không xử lý ngay trong khung đọc");
  await opts.filter({ hasText: "Câu trả lời bị báo cáo" }).click();
  check("không có nút lệnh; có liên kết sang trang báo cáo trả lời; có cảnh báo về trừ xu", await pg.getByRole("link", { name: "Xử lý ở trang báo cáo trả lời" }).getAttribute("href") === "/admin/cong-dong/bao-cao" && await pg.getByRole("button", { name: /Duyệt|Từ chối|Gỡ|Khoá|Xác nhận/ }).count() === 0 && await pg.getByText(/Xác nhận vi phạm sẽ trừ lại phần thưởng/).isVisible());
  await opts.filter({ hasText: "Hồ sơ gia sư bị báo cáo" }).click();
  check("báo cáo hồ sơ: có 'Khoá hồ sơ công khai' + 'Bỏ qua báo cáo'", await pg.getByRole("button", { name: "Khoá hồ sơ công khai" }).isVisible() && await pg.getByRole("button", { name: "Bỏ qua báo cáo" }).isVisible());

  section("Phím mũi tên trong danh sách");
  await opts.nth(0).click();
  await pg.keyboard.press("ArrowDown");
  check("↓ chọn dòng kế và dời focus theo", await opts.nth(1).getAttribute("aria-selected") === "true" && await pg.evaluate(`document.activeElement?.getAttribute("role")`) === "option");

  section("Các trang quản trị cũ nằm trong vỏ, quyền giữ nguyên");
  await mod("Người dùng").click();
  await pg.waitForURL(/\/admin\/hoc-sinh/, { timeout: 60000 });
  check("Người dùng → /admin/hoc-sinh, module sáng, 2 tab (Hồ sơ học sinh, Quản trị viên)", await mod("Người dùng").getAttribute("aria-current") === "page" && await mod("Kiểm duyệt").getAttribute("aria-current") === null && await pg.getByRole("navigation", { name: "Trang của Người dùng" }).getByRole("link").count() === 2);
  await pg.getByRole("heading").first().waitFor({ timeout: 60000 });
  await pg.goto(`${ADMIN}/admin/khoa-hoc/danh-muc`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await rail().waitFor({ timeout: 90000 });
  const nd = pg.getByRole("navigation", { name: "Trang của Nội dung" });
  check("trang sâu /admin/khoa-hoc/danh-muc: module Nội dung sáng, tab 'Danh mục' đang ở", await mod("Nội dung").getAttribute("aria-current") === "page" && await nd.getByRole("link", { name: "Danh mục" }).getAttribute("aria-current") === "page");
  check("trang cũ có lề riêng (không dính mép) và vẫn cuộn trong khung nội dung", await pg.evaluate(`(() => { const m = document.querySelector('main'); return parseFloat(getComputedStyle(m).paddingLeft) >= 16 && getComputedStyle(m).overflowY === 'auto'; })()`) as boolean);
  await mod("Báo cáo").click();
  await pg.waitForURL(/\/admin$/, { timeout: 60000 });
  check("Báo cáo → /admin (Tổng quan)", await mod("Báo cáo").getAttribute("aria-current") === "page");
  await shot(pg, "admin-shell-tong-quan");

  section("Quản trị nội dung (admin_content): không có 'Người dùng'");
  const cc = await ctxFor(CA, { width: 1280, height: 800 });
  const pc = await cc.newPage(); watch(pc);
  await pc.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "networkidle", timeout: 120000 });
  const railC = pc.getByRole("navigation", { name: railName });
  await railC.waitFor({ timeout: 90000 });
  const namesC = await railC.getByRole("link").allInnerTexts();
  check("3 module: Kiểm duyệt, Nội dung, Báo cáo", namesC.length === 3 && !namesC.some(n => /Người dùng/.test(n)), namesC);
  await cc.close();

  section("Giáo viên: chỉ thấy phần của mình (14/10: ở LẠI tên miền chính, trong vỏ gia sư — không sang tên miền quản trị)");
  const ct = await ctxFor(T, { width: 1280, height: 800 });
  const pt = await ct.newPage(); watch(pt);
  await pt.goto(`${BASE}/admin/kiem-duyet`, { waitUntil: "networkidle", timeout: 120000 });
  await pt.getByRole("listbox", { name: "Chờ kiểm duyệt" }).waitFor({ timeout: 90000 });
  check("vẫn ở tên miền chính (không bị chuyển sang admin.…)", !new URL(pt.url()).host.startsWith("admin."), pt.url());
  check("thanh bên là của GIA SƯ; không có thanh bên quản trị", await pt.getByRole("navigation", { name: "Module của gia sư" }).first().isVisible() && (await pt.getByRole("navigation", { name: railName }).count()) === 0);
  check("hàng chờ của giáo viên: đúng 1 dòng — bài viết của lớp mình", await pt.getByRole("listbox", { name: "Chờ kiểm duyệt" }).getByRole("option").count() === 1 && (await pt.getByRole("listbox", { name: "Chờ kiểm duyệt" }).innerText()).includes("Bài viết bị báo cáo") && !(await pt.content()).includes("Gia sư chờ duyệt"));
  check("dải tab của Kiểm duyệt không có 'Duyệt gia sư' / 'Báo cáo trả lời' (không đủ quyền)", await pt.getByRole("navigation", { name: "Trang của Kiểm duyệt" }).getByRole("link", { name: /Duyệt gia sư|Báo cáo trả lời/ }).count() === 0);
  await ct.close();

  section("Trạng thái lỗi: giữ danh sách cũ, có nút thử lại");
  const ce = await ctxFor(SA, { width: 1280, height: 800 });
  const pe = await ce.newPage(); watch(pe);
  let failNext = false;
  await pe.route("**/api/admin/kiem-duyet", route => failNext ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : route.continue());
  await pe.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "networkidle", timeout: 120000 });
  const lbe = pe.getByRole("listbox", { name: "Chờ kiểm duyệt" });
  await lbe.waitFor({ timeout: 90000 });
  const before = await lbe.getByRole("option").count();
  failNext = true;
  await pe.evaluate(`window.dispatchEvent(new Event("focus"))`);
  const strip = pe.locator('[role="alert"]:not(#__next-route-announcer__)');
  await strip.waitFor({ timeout: 30000 });
  check("lỗi tải lại → dải báo lỗi + 'Thử lại'; danh sách cũ còn nguyên", await strip.getByText("Không tải được hàng chờ.").isVisible() && (await lbe.getByRole("option").count()) === before);
  failNext = false;
  await strip.getByRole("button", { name: "Thử lại" }).click();
  await strip.waitFor({ state: "detached", timeout: 30000 });
  check("'Thử lại' thành công → dải lỗi biến mất", await strip.count() === 0);
  await ce.close();

  section("Điện thoại 390px");
  const cm = await ctxFor(SA, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "networkidle", timeout: 120000 });
  await pm.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });
  const bar = pm.getByRole("navigation", { name: railName });
  await bar.waitFor({ timeout: 90000 });
  const lbm = pm.getByRole("listbox", { name: "Chờ kiểm duyệt" });
  await lbm.waitFor({ timeout: 60000 });
  const bb = await bar.boundingBox();
  check("thanh module thành thanh dưới cao 60px, dính đáy; chỉ một thanh module hiện", !!bb && Math.round(bb.height) === 60 && Math.round(bb.y + bb.height) === 800 && await pm.getByRole("navigation", { name: railName }).count() === 1, bb);
  const hit = await pm.evaluate(`[...document.querySelectorAll('nav[aria-label="${railName}"] a')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height))`) as number[];
  check("4 nút thanh dưới, mỗi nút cao ≥ 44px", hit.length === 4 && hit.every(h => h >= 44), hit);
  check("không tràn ngang; dải tab cuộn ngang được trong khung của nó", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  check("điện thoại: thấy danh sách, chưa thấy khung đọc", await lbm.isVisible() && await pm.getByRole("heading", { level: 1 }).count() === 0);
  await shot(pm, "admin-shell-kiem-duyet-mobile");
  await lbm.getByRole("option").nth(0).click();
  await pm.getByRole("heading", { level: 1 }).waitFor({ timeout: 30000 });
  const btns = await pm.evaluate(`[...document.querySelectorAll('section[aria-label="Chi tiết"] button, section[aria-label="Chi tiết"] a')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height))`) as number[];
  check("chọn một dòng → khung đọc; mọi nút/liên kết trong khung đọc cao ≥ 44px", await pm.getByRole("heading", { level: 1 }).isVisible() && !(await lbm.isVisible()) && btns.length >= 2 && btns.every(h => h >= 44), btns);
  await shot(pm, "admin-shell-doc-mobile");
  await pm.getByRole("button", { name: /Quay lại/ }).click();
  check("'← Quay lại' trở về danh sách", await lbm.isVisible());
  await cm.close();

  section("Học sinh không vào được quản trị");
  const cs = await ctxFor(A, { width: 1280, height: 800 });
  const ps = await cs.newPage(); watch(ps);
  await ps.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "networkidle", timeout: 120000 });
  await ps.waitForURL(u => !/\/admin\/kiem-duyet/.test(u.pathname), { timeout: 60000 }).catch(() => {});
  check("học sinh bị đưa khỏi /admin/kiem-duyet, không thấy hàng chờ", !(await ps.content()).includes("Gia sư chưa xác thực") && await ps.getByRole("listbox", { name: "Chờ kiểm duyệt" }).count() === 0, ps.url());
  await cs.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));

  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
