// Vỏ học sinh (Figma 11:98): thanh module trái / thanh dưới 60px, "Việc của tôi" (trang dọc, Figma 299:114360), bảng "Khác",
// phòng thi không có vỏ, trạng thái trống / tải / lỗi, điện thoại 390px.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

const H = 3_600_000, D = 24 * H;

(async () => {
  await wipe();
  const now = Date.now();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Minh Anh" }), LONE = await mkUser({ name: "Bạn Mới" });
  const A = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const sid = "s-ss", cid = "c-ss", lid = "l-ss";
  await prisma.section.create({ data: { id: sid, title: "P", courseId: A.id } });
  await prisma.chapter.create({ data: { id: cid, title: "C", sectionId: sid } });
  await prisma.lesson.create({ data: { id: lid, code: lid, title: "Bài giảng", type: "record", chapterId: cid } });
  const mk = (title: string, due: number, extra: Record<string, unknown> = {}) => prisma.assignment.create({ data: { lessonId: lid, title, dueDate: new Date(now + due), instructions: `Làm ${title} theo hướng dẫn`, ...extra } });
  await mk("Bài một", 3 * H);
  await mk("Bài hai", 2 * D);
  await mk("Bài ba", 5 * D);
  await mk("Bài quá hạn", -D);
  const sent = await mk("Bài đã nộp", D);
  await prisma.assignmentSubmission.create({ data: { assignmentId: sent.id, userId: S.id, fileUrl: "/u/x.pdf" } });
  const ed = new Date(now + 3 * D + 7 * H); // 3 ngày tới (giờ VN), trong cửa sổ lịch 90 ngày
  const examDate = `${String(ed.getUTCDate()).padStart(2, "0")}/${String(ed.getUTCMonth() + 1).padStart(2, "0")}/${ed.getUTCFullYear()}`;
  const exam = await prisma.exam.create({ data: { id: "ex-ss", code: "ex-ss", title: "Đề thử", category: "Toán", date: examDate, time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2020", courseId: A.id } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of 5/i.test(m.text())) errors.push(m.text()); }); };

  const ctx = await ctxFor(S, { width: 1280, height: 800 });
  const pg = await ctx.newPage(); watch(pg);
  const railName = "Module của học sinh";
  const rail = () => pg.getByRole("navigation", { name: railName });
  const mod = (name: string) => rail().getByRole(name === "Khác" ? "button" : "link", { name: new RegExp(`^${name}`) });

  section("Vào /student → thẳng 'Việc của tôi'");
  await pg.goto(`${BASE}/student`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { level: 1, name: "Việc của tôi" }).waitFor({ timeout: 90000 });
  check("/student chuyển tới /student/viec-cua-toi", new URL(pg.url()).pathname === "/student/viec-cua-toi", pg.url());

  section("Thanh module");
  check("nhãn vai trò 'HỌC SINH'", await rail().getByText("HỌC SINH").isVisible());
  for (const m of ["Việc của tôi", "Lịch học", "Lớp của tôi", "Bài tập"]) check(`module '${m}' là liên kết`, await mod(m).count() === 1);
  check("nút 'Khác' có aria-haspopup + aria-expanded=false", await mod("Khác").getAttribute("aria-haspopup") === "dialog" && await mod("Khác").getAttribute("aria-expanded") === "false");
  check("module đang ở có aria-current=page (đúng một nút)", await mod("Việc của tôi").getAttribute("aria-current") === "page" && await rail().locator("[aria-current=page]").count() === 1);
  const clipped = await rail().evaluate(`[...document.querySelectorAll('nav[aria-label="${railName}"] a span.truncate, nav[aria-label="${railName}"] button span.truncate')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth).map(e => e.textContent)`) as string[];
  check("nhãn module hiện đủ chữ, không bị cắt thành '…' ('Việc của tôi' nằm vừa nút 66px)", clipped.length === 0, clipped);
  const railBox = await rail().boundingBox();
  check("thanh rộng 79px, dọc bên trái", !!railBox && Math.round(railBox.width) === 79 && railBox.x === 0, railBox);
  const api = await pg.evaluate(`fetch("/api/student/viec-cua-toi").then(r => r.json())`) as any;
  const badgeEl = rail().locator(".kin-badge-dem");
  check("badge đếm đúng việc cần ra tay và có nhãn chữ", api.badge === 3 && (await badgeEl.first().getAttribute("aria-label")) === `${api.badge} việc cần xử lý` && (await badgeEl.first().innerText()) === String(api.badge), api.badge);
  check("thanh trên cũ (Navbar) và thanh dưới cũ không còn", await pg.getByRole("link", { name: /^Cộng đồng$/ }).count() === 0 && await pg.getByRole("navigation", { name: /Chính|main/i }).count() === 0);
  check("có chuông 'Thông báo' ở dải trên", await pg.getByRole("button", { name: "Thông báo" }).isVisible());

  section("Trang dọc theo Figma 299:114360: Cần làm / Đã nộp · đang chờ chấm");
  const rows = pg.locator("[data-student-task]");
  check("có 5 dòng (4 bài chưa nộp ở 'Cần làm' + 1 bài đã nộp ở 'Chờ chấm')", await rows.count() === 5, await rows.count());
  check("tiêu đề 'Việc của tôi' (h1) và hai khu 'Cần làm', 'Đã nộp · đang chờ chấm'", await pg.getByRole("heading", { level: 1, name: "Việc của tôi" }).isVisible() && await pg.getByRole("heading", { name: "Cần làm" }).isVisible() && await pg.getByRole("heading", { name: "Đã nộp · đang chờ chấm" }).isVisible());
  const todoList = pg.getByRole("list", { name: "Cần làm" });
  check("'Cần làm' có đúng 4 bài, bài quá hạn (hạn sớm nhất) nằm đầu", await todoList.locator("[data-student-task]").count() === 4 && /Bài quá hạn/.test(await todoList.locator("[data-student-task]").first().innerText()));
  check("trạng thái có CHỮ, không chỉ chấm màu (Quá hạn / Chưa nộp / Chờ chấm)", await todoList.getByText("Quá hạn").first().isVisible() && await todoList.getByText("Chưa nộp").first().isVisible() && await pg.getByRole("list", { name: "Đã nộp, đang chờ chấm" }).getByText("Chờ chấm").isVisible());
  const send = todoList.getByRole("link", { name: "Nộp bài" }).first();
  check("nút 'Nộp bài' trỏ vào bài giảng chứa bài tập", (await send.getAttribute("href")) === `/student/bai-giang/${lid}`);
  check("bài đã nộp có nút 'Xem bài nộp' (không còn 'Nộp bài' ở đó)", await pg.getByRole("link", { name: "Xem bài nộp" }).count() === 1);
  check("cột phải: 'Kiểm tra sắp mở' (đề thi) và 'Buổi học' trống có lối sang Lịch học", await pg.getByText("Kiểm tra sắp mở").isVisible() && await pg.getByRole("link", { name: "Mở Lịch học" }).isVisible());
  check("nút 'Xem lịch tuần' ở góc phải → /student/lich-hoc", (await pg.getByRole("link", { name: "Xem lịch tuần" }).getAttribute("href")) === "/student/lich-hoc");

  section("Bố cục: một trang dọc, không còn hai khung");
  const lay = await pg.evaluate(`({ listbox: document.querySelectorAll('[role=listbox]').length, hOverflow: document.documentElement.scrollWidth - window.innerWidth })`) as any;
  check("không còn danh sách + khung đọc (listbox) và không tràn ngang", lay.listbox === 0 && lay.hOverflow <= 0, lay);
  await shot(pg, "student-shell-viec");

  section("Bảng 'Khác'");
  await mod("Khác").click();
  const dlg = pg.getByRole("dialog", { name: "Các mục khác" });
  check("mở bảng, aria-expanded=true", await dlg.isVisible() && await mod("Khác").getAttribute("aria-expanded") === "true");
  for (const l of ["Thư viện", "Thi thử", "Bảng xếp hạng", "Cộng đồng", "Tin tức", "Hồ sơ", "Học phí", "Chủ đề màu"]) check(`có mục '${l}'`, await dlg.getByRole("link", { name: l, exact: true }).count() === 1);
  check("NC2-048: không còn mục 'Hỏi đáp' riêng (gộp vào Cộng đồng)", await dlg.getByRole("link", { name: "Hỏi đáp", exact: true }).count() === 0);
  check("có 'Đăng xuất' và tên người dùng", await dlg.getByRole("button", { name: "Đăng xuất" }).isVisible() && await dlg.getByText("Minh Anh").isVisible());
  await shot(pg, "student-shell-khac");
  await pg.keyboard.press("Escape");
  check("Esc đóng bảng", await dlg.count() === 0);
  await mod("Khác").click();
  await pg.mouse.click(900, 400);
  check("bấm ra ngoài đóng bảng", await dlg.count() === 0);
  await mod("Khác").click();
  await dlg.getByRole("link", { name: "Hồ sơ", exact: true }).click();
  await pg.waitForURL(/\/student\/ho-so/, { timeout: 60000 });
  check("chọn 'Hồ sơ' → sang trang và bảng tự đóng", await dlg.count() === 0 && await mod("Khác").getAttribute("aria-current") === "page");

  section("Chuyển module: Lịch");
  await mod("Lịch").click();
  await pg.waitForURL(/\/student\/lich-hoc/, { timeout: 60000 });
  check("aria-current chuyển sang 'Lịch', 'Khác' hết sáng", await mod("Lịch").getAttribute("aria-current") === "page" && await mod("Khác").getAttribute("aria-current") === null);
  await pg.getByRole("heading", { level: 1, name: "Lịch học" }).waitFor({ timeout: 90000 });
  check("trang Lịch hiển thị trong vỏ, đúng tiêu đề Figma", await rail().isVisible());
  await mod("Bài tập").click();
  await pg.waitForURL(/\/student\/bai-tap/, { timeout: 60000 });
  check("module 'Bài tập' → /student/bai-tap, sáng đúng một nút", await mod("Bài tập").getAttribute("aria-current") === "page" && await rail().locator("[aria-current=page]").count() === 1);

  section("Phòng thi không có vỏ");
  await pg.goto(`${BASE}/student/thi-thu`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await rail().waitFor({ timeout: 90000 });
  check("danh sách thi thử CÓ vỏ", await rail().isVisible());
  await pg.goto(`${BASE}/student/thi-thu/${exam.id}`, { waitUntil: "networkidle", timeout: 120000 });
  check("phòng thi KHÔNG có thanh module (toàn màn hình)", await pg.getByRole("navigation", { name: railName }).count() === 0);

  section("Trạng thái tải / lỗi");
  const ctx2 = await ctxFor(S, { width: 1280, height: 800 });
  const p2 = await ctx2.newPage(); watch(p2);
  let delayMs = 1500, failNext = false;
  await p2.route("**/api/student/viec-cua-toi", async route => {
    if (failNext) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) });
    await new Promise(r => setTimeout(r, delayMs));
    return route.continue();
  });
  const wait = p2.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await wait;
  await p2.locator("[aria-busy=true]").first().waitFor({ timeout: 60000 });
  check("đang tải lần đầu: khung xương (aria-busy), không có vòng xoay", await p2.locator("[aria-busy=true]").count() >= 1 && await p2.locator(".animate-spin").count() === 0);
  await p2.getByRole("heading", { level: 1, name: "Việc của tôi" }).waitFor({ timeout: 60000 });
  await p2.locator("[data-student-task]").first().waitFor({ timeout: 60000 });
  check("tải xong: khung xương biến mất", await p2.locator("[aria-busy=true]").count() === 0);
  failNext = true;
  await p2.evaluate(`window.dispatchEvent(new Event("focus"))`);
  const strip = p2.locator('[role="alert"]:not(#__next-route-announcer__)');
  await strip.waitFor({ timeout: 30000 });
  check("lỗi tải lại: hiện dải báo lỗi + nút 'Thử lại'", await strip.getByText("Không tải được danh sách.").isVisible() && await strip.getByRole("button", { name: "Thử lại" }).isVisible());
  check("danh sách cũ vẫn còn dưới dải lỗi (không mất việc đang xem)", await p2.locator("[data-student-task]").count() === 5);
  failNext = false; delayMs = 0;
  await strip.getByRole("button", { name: "Thử lại" }).click();
  await strip.waitFor({ state: "detached", timeout: 30000 });
  check("'Thử lại' thành công → dải lỗi biến mất", await strip.count() === 0);
  await ctx2.close();

  section("Học sinh chưa có việc nào");
  const ctx3 = await ctxFor(LONE, { width: 1280, height: 800 });
  const p3 = await ctx3.newPage(); watch(p3);
  await p3.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await p3.getByText("Chưa có việc nào cho bạn").waitFor({ timeout: 60000 });
  check("trạng thái rỗng có câu giải thích + lối đi tiếp 'Nhập mã lớp'", await p3.getByText(/thầy cô giao bài/).isVisible() && (await p3.getByRole("link", { name: "Nhập mã lớp" }).getAttribute("href")) === "/student/nhap-ma-lop");
  check("không hiện badge khi không có việc cần ra tay", await p3.locator(".kin-badge-dem").count() === 0);
  await shot(p3, "student-shell-trong");
  await ctx3.close();

  section("Điện thoại 390px");
  const cm = await ctxFor(S, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  // Thanh công cụ Agentation chỉ có khi chạy dev, đè lên nút ngoài cùng bên phải của thanh dưới → ẩn đi để bấm được.
  await pm.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });
  const bar = pm.getByRole("navigation", { name: railName });
  await bar.waitFor({ timeout: 90000 });
  await pm.locator("[data-student-task]").first().waitFor({ timeout: 60000 });
  const bb = await bar.boundingBox();
  check("thanh module thành thanh dưới cao 60px, dính đáy", !!bb && Math.round(bb.height) === 60 && Math.round(bb.y + bb.height) === 800, bb);
  check("chỉ có MỘT thanh module nhìn thấy (thanh dọc ẩn)", await pm.getByRole("navigation", { name: railName }).count() === 1);
  check("điện thoại: một cột, thấy tiêu đề và danh sách việc", await pm.getByRole("heading", { level: 1, name: "Việc của tôi" }).isVisible() && await pm.locator("[data-student-task]").first().isVisible());
  const taskBtn = await pm.locator("[data-student-task] a").evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  check("nút trong dòng việc cao ≥ 44px", taskBtn.length > 0 && taskBtn.every(h => h >= 44), taskBtn);
  const hit = await pm.evaluate(`[...document.querySelectorAll('nav[aria-label="${railName}"] a, nav[aria-label="${railName}"] button')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height))`) as number[];
  check("4 tab (Figma 299:116497), mỗi nút cao ≥ 44px (chạm được)", hit.length === 4 && hit.every(h => h >= 44), hit);
  check("không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(pm, "student-shell-viec-mobile");
  // Điện thoại theo Figma 299:116497 chỉ có 4 tab; bảng "Khác" mở từ menu tài khoản → "Tất cả mục".
  await pm.getByRole("button", { name: /^Tài khoản của/ }).click();
  await pm.getByRole("menuitem", { name: "Tất cả mục" }).click();
  const dm = pm.getByRole("dialog", { name: "Các mục khác" });
  const db = await dm.boundingBox();
  check("bảng 'Khác' nổi ngay trên thanh dưới, không tràn khỏi màn hình", !!db && db.y >= 0 && db.y + db.height <= 800 - 60 && db.x >= 0 && db.x + db.width <= 390, db);
  check("mọi mục trong bảng cao ≥ 44px", (await dm.evaluate(`[...document.querySelectorAll('[role=dialog] a, [role=dialog] button')].map(e => Math.round(e.getBoundingClientRect().height))`) as number[]).every(h => h >= 44));
  await shot(pm, "student-shell-khac-mobile");
  await cm.close();

  section("Chưa đăng nhập");
  const cg = await ctxFor(null);
  const pgst = await cg.newPage(); watch(pgst);
  await pgst.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await pgst.waitForURL(/\/dang-nhap/, { timeout: 60000 });
  check("chuyển về đăng nhập, nhớ trang đang vào", /redirect=%2Fstudent%2Fviec-cua-toi/.test(pgst.url()), pgst.url());
  await cg.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));

  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
