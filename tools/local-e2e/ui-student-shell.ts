// Vỏ học sinh (Figma 11:98): thanh module trái / thanh dưới 60px, "Việc của tôi" (trang dọc, Figma 299:114360), bảng "Khác",
// phòng thi không có vỏ, trạng thái trống / tải / lỗi, điện thoại 390px.
// 09/11/2026 (BU-HS-TRANG-CHU mục 8): thanh module có thêm mục "Trang chủ" (đầu thanh, chỉ máy tính, không `aria-current`, không lên thanh dưới điện thoại → vẫn 4 ô);
// bảng "Khác" ở 390px có thêm hàng đầu "Trang chủ KiN" (6 liên kết nhìn thấy; ở 1280 hàng đó ẩn nên vẫn 5).
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { featureOn } from "@/lib/features";

// LOI-01 (11/11/2026): Lịch học, Gia sư, Cộng đồng, Tin tức, Tiếng Anh tự học là phần ẨN mặc định (src/lib/features.ts). Bài đọc cờ ở tiến trình này — chạy với CÙNG biến
// NEXT_PUBLIC_KIN_MO_* như máy chủ dev. Tắt hết: thanh còn Việc của tôi · Lớp của tôi (+ Khác), bảng Khác chỉ còn "Lớp miễn phí", điện thoại 3 ô. Bật đủ: như trước.
const LICH = featureOn("LICH");
const MORE_EXPECT = ["Lớp miễn phí", ...(featureOn("TIM_GIA_SU") ? ["Gia sư"] : []), ...(featureOn("CONG_DONG") ? ["Cộng đồng"] : []), ...(featureOn("TIN_TUC") ? ["Tin tức"] : []), ...(featureOn("TIENG_ANH") ? ["Tiếng Anh tự học"] : [])];
const MORE_HIDDEN = ["Gia sư", "Cộng đồng", "Tin tức", "Tiếng Anh tự học"].filter(l => !MORE_EXPECT.includes(l));
const MOBILE_CELLS = LICH ? 4 : 3;

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
  // LOI-07: "HỌC SINH" có 2 bản trong thanh — <span aria-hidden> cạnh logo (chỉ thanh RỘNG 272px, display:none ở thanh hẹp) và <p sr-only> cho trình đọc màn hình
  // (ModuleRail.tsx:201, :205). Bài chạy thanh hẹp 79px ⇒ `.first()` rơi vào bản ẩn. Kiểm như ui-tutor-shell: có ít nhất một bản đang dựng (sr-only vẫn có hộp 1px).
  check("nhãn vai trò 'HỌC SINH'", await rail().getByText("HỌC SINH").evaluateAll(els => els.some(e => !!(e as HTMLElement).offsetParent || e.getClientRects().length > 0)));
  for (const m of ["Việc của tôi", ...(LICH ? ["Lịch học"] : []), "Lớp của tôi"]) check(`module '${m}' là liên kết`, await mod(m).count() === 1);
  if (!LICH) check("LOI-01: Lịch đang ẩn → không có module 'Lịch học' trên thanh", await mod("Lịch học").count() === 0 && await rail().locator(":scope a[href='/student/lich-hoc']").count() === 0);
  check("BU-HS-TRANG-CHU: module 'Trang chủ' là liên kết tới '/', đứng ĐẦU thanh, KHÔNG có aria-current (vỏ không bao giờ hiện ở '/')",
    await mod("Trang chủ").count() === 1 && (await mod("Trang chủ").getAttribute("href")) === "/" && (await mod("Trang chủ").getAttribute("aria-current")) === null
    && (await rail().evaluate(`[...document.querySelectorAll('nav[aria-label="${railName}"] a')].filter(e => e.offsetParent && e.getAttribute("data-rail-home") === null)[0].textContent.trim().startsWith("Trang chủ")`)) === true);
  check("B1: chỉ còn 3 module + 'Khác' (module 'Bài tập' đã bỏ khỏi thanh)", await mod("Bài tập").count() === 0 && await rail().locator(":scope a[href='/student/bai-tap']").count() === 0);
  check("nút 'Khác' có aria-haspopup + aria-expanded=false", await mod("Khác").getAttribute("aria-haspopup") === "dialog" && await mod("Khác").getAttribute("aria-expanded") === "false");
  // LOI-07: thanh máy tính dựng CẢ hai bản mục (thanh hẹp .kin-rail-items và thanh rộng .kin-rail-groups), CSS ẩn một bản theo data-kin-rail (kin-motion.css:228-235) ⇒
  // bản ẩn cũng mang aria-current nhưng không vào cây trợ năng. Đếm mục ĐANG HIỆN (như ui-tutor-shell :55), và đếm riêng bản ẩn để thấy rõ đó là bản thanh rộng.
  const currentVisible = await rail().locator("[aria-current=page]:visible").count();
  const currentHiddenWide = await rail().locator(".kin-rail-groups [aria-current=page]").evaluateAll(els => els.filter(e => !(e as HTMLElement).offsetParent && e.getClientRects().length === 0).length);
  check("module đang ở có aria-current=page (đúng một mục ĐANG HIỆN; bản thanh rộng đang ẩn không tính)", await mod("Việc của tôi").getAttribute("aria-current") === "page" && currentVisible === 1, { currentVisible, currentHiddenWide });
  {
    // Đối chứng ở thanh RỘNG 272px (bản hẹp ẩn, bản có nhóm hiện): vẫn đúng MỘT mục đang hiện mang aria-current và nhãn "HỌC SINH" cạnh logo hiện thật.
    const wp = await (await ctxFor(S, { width: 1280, height: 800, rail: "rong" })).newPage(); watch(wp);
    await wp.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
    await wp.getByRole("heading", { level: 1, name: "Việc của tôi" }).waitFor({ timeout: 90000 });
    const wr = wp.getByRole("navigation", { name: railName });
    const lit = await wr.locator("[aria-current=page]:visible").evaluateAll(els => els.map(e => e.getAttribute("href")));
    check("thanh rộng: đúng một mục đang hiện mang aria-current (Việc của tôi); nhãn 'HỌC SINH' cạnh logo hiện", lit.length === 1 && lit[0] === "/student/viec-cua-toi" && await wr.locator(".kin-rail-tag", { hasText: "HỌC SINH" }).isVisible(), lit);
    await wp.close();
  }
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
  check("cột phải: 'Kiểm tra sắp mở' (đề thi) và 'Buổi học' trống có lối sang Lịch học", await pg.getByText("Kiểm tra sắp mở").isVisible() && await pg.getByText("3 ngày tới chưa có buổi học").isVisible() && await pg.getByRole("link", { name: "Mở Lịch học" }).count() === 0);
  check("nút 'Xem lịch tuần' ở góc phải → /student/lich-hoc", (await pg.getByRole("link", { name: "Xem lịch tuần" }).getAttribute("href")) === "/student/lich-hoc");

  section("Bố cục: một trang dọc, không còn hai khung");
  const lay = await pg.evaluate(`({ listbox: document.querySelectorAll('[role=listbox]').length, hOverflow: document.documentElement.scrollWidth - window.innerWidth })`) as any;
  check("không còn danh sách + khung đọc (listbox) và không tràn ngang", lay.listbox === 0 && lay.hOverflow <= 0, lay);
  await shot(pg, "student-shell-viec");

  section("Bảng 'Khác'");
  await mod("Khác").click();
  const dlg = pg.getByRole("dialog", { name: "Các mục khác" });
  check("mở bảng, aria-expanded=true", await dlg.isVisible() && await mod("Khác").getAttribute("aria-expanded") === "true");
  // BU-00 bước 6 (31/10/2026): bảng "Khác" rút còn Khám phá (Gia sư, Cộng đồng, Tin tức) + Tự học; B2 (08/11): nhóm Tài khoản rút khỏi bảng (đã có ở menu tài khoản); A6 (07/11): "Nhập mã lớp" rút khỏi bảng, Cộng đồng / Tin tức trỏ thẳng.
  for (const l of MORE_EXPECT) check(`có mục '${l}'`, await dlg.getByRole("link", { name: l, exact: true }).count() === 1);
  for (const l of MORE_HIDDEN) check(`LOI-01: mục '${l}' đang ẩn theo cờ → không có trong bảng Khác`, await dlg.getByRole("link", { name: l, exact: true }).count() === 0);
  for (const l of ["Hồ sơ", "Học phí", "Chủ đề màu"]) check(`B2: '${l}' không còn trong bảng Khác (chỉ ở menu tài khoản)`, await dlg.getByRole("link", { name: l, exact: true }).count() === 0);
  check("NC2-048: không còn mục 'Hỏi đáp' riêng (gộp vào Cộng đồng)", await dlg.getByRole("link", { name: "Hỏi đáp", exact: true }).count() === 0);
  for (const l of ["Thư viện", "Thi thử", "Bảng xếp hạng", "Khoá học đang mở", "Lớp đang theo dõi", "Tra cứu điểm chuẩn", "Ví và Coin"]) check(`BU-00: mục '${l}' đã rời bảng Khác (route vẫn giữ, chỉ ẩn lối vào)`, await dlg.getByRole("link", { name: l, exact: true }).count() === 0);
  check("A6: bảng Khác không còn 'Nhập mã lớp'", await dlg.getByRole("link", { name: "Nhập mã lớp", exact: true }).count() === 0);
  if (MORE_EXPECT.includes("Cộng đồng") && MORE_EXPECT.includes("Tin tức"))
    check("A6: Cộng đồng → /cong-dong, Tin tức → /tin-tuc (không qua chuyển hướng)", (await dlg.getByRole("link", { name: "Cộng đồng", exact: true }).getAttribute("href")) === "/cong-dong" && (await dlg.getByRole("link", { name: "Tin tức", exact: true }).getAttribute("href")) === "/tin-tuc");
  check(`bảng Khác đúng ${MORE_EXPECT.length} mục (bật đủ cờ: 5 mục, 2 nhóm — Khám phá có thêm Lớp miễn phí 08/11, Tự học)`, await dlg.getByRole("link").count() === MORE_EXPECT.length, await dlg.getByRole("link").count());
  check("BU-HS-TRANG-CHU: ở 1280 hàng 'Trang chủ KiN' của bảng Khác không hiện (máy tính đã có mục Trang chủ ở thanh bên)", await dlg.getByRole("link", { name: "Trang chủ KiN", exact: true }).count() === 0 && (await dlg.locator("[data-more-home]").count()) === 1 && !(await dlg.locator("[data-more-home]").isVisible()));
  check("có 'Đăng xuất' và tên người dùng", await dlg.getByRole("button", { name: "Đăng xuất" }).isVisible() && await dlg.getByText("Minh Anh").isVisible());
  await shot(pg, "student-shell-khac");
  await pg.keyboard.press("Escape");
  check("Esc đóng bảng", await dlg.count() === 0);
  await mod("Khác").click();
  await pg.mouse.click(900, 400);
  check("bấm ra ngoài đóng bảng", await dlg.count() === 0);
  await mod("Khác").click();
  // Bật Tìm gia sư: đi "Gia sư" như trước. Ẩn: mục đầu tiên còn lại là "Lớp miễn phí" (/khoa-hoc?gia=free).
  const pick = MORE_EXPECT.includes("Gia sư") ? { name: "Gia sư", url: /\/giang-vien/ } : { name: "Lớp miễn phí", url: /\/khoa-hoc/ };
  await dlg.getByRole("link", { name: pick.name, exact: true }).click();
  await pg.waitForURL(pick.url, { timeout: 60000 });
  check(`chọn '${pick.name}' → sang trang và bảng tự đóng`, await dlg.count() === 0 && await mod("Khác").getAttribute("aria-current") === "page");

  if (LICH) {
    section("Chuyển module: Lịch");
    await mod("Lịch").click();
    await pg.waitForURL(/\/student\/lich-hoc/, { timeout: 60000 });
    check("aria-current chuyển sang 'Lịch', 'Khác' hết sáng", await mod("Lịch").getAttribute("aria-current") === "page" && await mod("Khác").getAttribute("aria-current") === null);
    await pg.getByRole("heading", { level: 1, name: "Lịch học" }).waitFor({ timeout: 90000 });
    check("trang Lịch hiển thị trong vỏ, đúng tiêu đề Figma", await rail().isVisible());
  } else {
    section("LOI-01: Lịch ẩn khỏi menu nhưng route vẫn chạy");
    await pg.goto(`${BASE}/student/lich-hoc`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await pg.getByRole("heading", { level: 1, name: "Lịch học" }).waitFor({ timeout: 90000 });
    check("/student/lich-hoc mở thẳng vẫn chạy, trong vỏ học sinh (không chuyển hướng)", new URL(pg.url()).pathname === "/student/lich-hoc" && await rail().isVisible(), pg.url());
  }
  await pg.goto(`${BASE}/student/bai-tap`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForURL(/\/student\/viec-cua-toi/, { timeout: 60000 });
  check("B1: /student/bai-tap (thông báo cũ) chuyển về 'Việc của tôi', module đó sáng", await mod("Việc của tôi").getAttribute("aria-current") === "page" && (!LICH || await mod("Lịch học").getAttribute("aria-current") === null));

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
  check(`B3: ${MOBILE_CELLS} ô (${MOBILE_CELLS - 1} module + Khác), mỗi nút cao ≥ 44px (chạm được)`, hit.length === MOBILE_CELLS && hit.every(h => h >= 44), hit);
  check("không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(pm, "student-shell-viec-mobile");
  // B3 (08/11/2026): nút "Khác" nằm ngay trên thanh dưới → Gia sư / Cộng đồng / Tin tức cách 2 bấm. Menu tài khoản không còn "Tất cả mục" (một đường chính).
  check("B3: nút 'Khác' có trên thanh dưới điện thoại", await bar.getByRole("button", { name: /^Khác/ }).isVisible());
  await bar.getByRole("button", { name: /^Khác/ }).click();
  const dm = pm.getByRole("dialog", { name: "Các mục khác" });
  const db = await dm.boundingBox();
  check("bảng 'Khác' nổi ngay trên thanh dưới, không tràn khỏi màn hình", !!db && db.y >= 0 && db.y + db.height <= 800 - 60 && db.x >= 0 && db.x + db.width <= 390, db);
  check("mọi mục trong bảng cao ≥ 44px", (await dm.evaluate(`[...document.querySelectorAll('[role=dialog] a, [role=dialog] button')].map(e => Math.round(e.getBoundingClientRect().height))`) as number[]).every(h => h >= 44));
  check(`BU-HS-TRANG-CHU: ở 390px bảng Khác có ${MORE_EXPECT.length + 1} liên kết, hàng ĐẦU là 'Trang chủ KiN' → '/', cao ≥ 44px, không nằm trong nhóm nào của các mục cũ`,
    await dm.getByRole("link").count() === MORE_EXPECT.length + 1 && (await dm.getByRole("link").first().innerText()).trim() === "Trang chủ KiN" && (await dm.getByRole("link").first().getAttribute("href")) === "/" && ((await dm.getByRole("link").first().boundingBox())?.height ?? 0) >= 44);
  await shot(pm, "student-shell-khac-mobile");
  await pm.keyboard.press("Escape");
  await pm.getByRole("button", { name: /^Tài khoản của/ }).click();
  check("B2/B3: menu tài khoản trên điện thoại không còn 'Tất cả mục' nhưng còn lối tới Hồ sơ", await pm.getByRole("menuitem", { name: "Tất cả mục" }).count() === 0 && await pm.getByRole("menuitem", { name: "Hồ sơ" }).isVisible());
  await cm.close();
  // B3: đo thật vùng chạm 4 ô thanh dưới ở 320px và 390px (rộng VÀ cao ≥ 44px), không ô nào đè lên ô khác, trang không tràn ngang.
  for (const w of [320, 390]) {
    const cw = await ctxFor(S, { width: w, height: 700 });
    const pw = await cw.newPage(); watch(pw);
    await pw.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
    await pw.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });
    await pw.getByRole("navigation", { name: railName }).waitFor({ timeout: 90000 });
    const boxes = await pw.evaluate(`[...document.querySelectorAll('nav[aria-label="${railName}"] a, nav[aria-label="${railName}"] button')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), clipped: e.scrollWidth > e.clientWidth + 1 }; })`) as { x: number; w: number; h: number; clipped: boolean }[];
    check(`B3 ${w}px: ${MOBILE_CELLS} ô, mỗi ô rộng và cao ≥ 44px`, boxes.length === MOBILE_CELLS && boxes.every(b => b.w >= 44 && b.h >= 44), boxes);
    check(`B3 ${w}px: các ô không đè nhau, nằm trọn trong màn hình`, boxes.every((b, i) => b.x >= 0 && b.x + b.w <= w && (i === 0 || boxes[i - 1].x + boxes[i - 1].w <= b.x)), boxes);
    check(`B3 ${w}px: không tràn ngang`, await pw.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
    await cw.close();
  }

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
