// LOI-02 (11/11/2026) — lõi dạy học của gia sư chạy thật bằng trình duyệt ở 1600 / 1280 / 390 (đặc tả docs/kin/phong-ban/dac-ta/LOI-02.md mục 2.A–C, 2.G, 4, 6).
// Kiểm: thư viện lớp → bấm thẻ → URL = GỐC lớp, dải đúng 4 tab "Bài học · Học sinh · Điểm danh · Cài đặt", "Bài học" sáng (aria-current), thấy cây; thanh bên MỘT mục sáng;
// …/giao-trinh → 307 + no-store, Location = gốc (bỏ query); ?tab=chuong-bai → 200, tab Bài học sáng; …/giao-trinh/xem/<id> còn mở; …/lich-hoc mở bằng link, dải không có
// "Lịch học" và không tab nào sáng; panel không có "Link phòng Zoom", không có ô "Dán link Google Drive"; bài cũ có link Drive vẫn hiện và XOÁ được, link Zoom cũ còn nguyên
// trong DB (không gửi khoá zoomUrl); thả 2 tệp có % ; .exe và tệp 26 MB báo lỗi NGAY (0 yêu cầu /init cho chúng); kho tắt (ép /api/media/config) → "Kho tệp chưa bật — chủ cần
// cấu hình.", trang không lỗi; chip "Nháp · học sinh chưa thấy"; Sửa nhanh đổi tên + ngày (Enter) → tải lại thấy chip đúng giờ VN, DB đúng ISO; KinSelect bằng bàn phím
// (↓ Enter, Esc trả tiêu điểm, gõ chữ không dấu); đổi trạng thái lỗi → giữ phần đã lưu, báo riêng; bài mới chỉ Đã đăng · Nháp (Nháp đi trong POST, không PATCH);
// nhân bản bài Nháp / chương có bài Nháp · Ẩn ⇒ bản sao Nháp; lớp rỗng → "Tạo chương đầu tiên" → thêm bài ngay trong cây;
// 390: không cuộn ngang ở cây / Sửa nhanh / panel, nút ≥ 44px. Phá: gia sư B mở lớp của A → "Bạn không có quyền với lớp này" (không tên lớp A); lớp không có →
// "Không tìm thấy lớp"; gia sư chờ duyệt mở gốc lớp và …/giao-trinh → /lop-cua-toi/cho-duyet.
// Chạy: TZ=Asia/Ho_Chi_Minh; source tools/local-e2e/env.sh && SHOTS=<thư mục ảnh> npx tsx tools/local-e2e/ui-loi-02.ts   (máy chủ thử ở BASE, DB riêng — bài gọi wipe()).
import { BASE, mkTutor, mkUser, mkCourse, cookieFor, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { featureOn } from "@/lib/features";
import { formatVnLessonWhen } from "@/lib/tutorLessonDate";

const RAIL = "Module của gia sư";
const STRIP = 'nav[aria-label^="Trang của"]';
// DG (14/11/2026): tab Điểm danh theo cờ DIEM_DANH (mặc định ẨN) — chạy bài cùng biến NEXT_PUBLIC_KIN_MO_* với máy chủ dev.
const TABS = ["Bài học", "Học sinh", ...(featureOn("DIEM_DANH") ? ["Điểm danh"] : []), "Cài đặt"];
const SHOTS = process.env.SHOTS ?? "scratchpad/shots";
const PDF = [..."%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"].map(c => c.charCodeAt(0));
type F = { name: string; type: string; bytes?: number[]; size?: number };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), TB = await mkTutor("Thầy Bình");
  const PEND = await mkUser({ name: "Người nộp đơn" });
  await prisma.user.update({ where: { id: PEND.id }, data: { tutorAppliedAt: new Date() } });
  const A = await mkCourse(T.id, { name: "Toán 9 — Lõi lớp" });
  const E = await mkCourse(T.id, { name: "Lớp trống chưa có bài" });
  const B = await mkCourse(TB.id, { name: "Lớp riêng của thầy Bình" });
  const S = await mkUser({ name: "Em Mai" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  await prisma.section.create({ data: { id: "loi-s", title: "Nội dung lớp", order: 1, courseId: A.id } });
  await prisma.chapter.create({ data: { id: "loi-c", title: "Chương 1: Hàm số", order: 1, sectionId: "loi-s" } });
  const DRIVE = "https://drive.google.com/file/d/1Xq9LoiHaiDriveCuAbcdEfGhIjKlMnO/view?usp=sharing";
  const ZOOM = "https://us02web.zoom.us/j/81234567890?pwd=LoiHai";
  const mkLesson = (id: string, title: string, order: number, o: Record<string, unknown>) =>
    prisma.lesson.create({ data: { id, code: id, title, type: "document", order, chapterId: "loi-c", isLocked: false, ...o } as never });
  await mkLesson("loi-l1", "Bài có Drive cũ", 1, { type: "live", zoomUrl: ZOOM, documents: JSON.stringify([{ name: "Đề cương Drive", url: DRIVE, type: "file" }]), status: "published" });
  // Bài nháp CÓ nội dung (luật G4: bài rỗng không đăng được — publishBlockFor).
  await mkLesson("loi-l2", "Bài soạn nháp", 2, { status: "draft", documents: JSON.stringify([{ name: "Phiếu nháp", url: "https://drive.google.com/file/d/1Xq9LoiHaiNhapAbcdEfGhIjKlMnOpQr/view?usp=sharing", type: "file" }]) });
  await mkLesson("loi-l3", "Bài đổi trạng thái lỗi", 3, { status: "published" });
  await prisma.section.create({ data: { id: "loi-sb", title: "Phần của thầy Bình", order: 1, courseId: B.id } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => { if (!/negative time stamp/i.test(String(e))) errors.push(String(e)); });
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|hydrat|Encountered a script tag/i.test(m.text())) errors.push(m.text()); });
  };
  const track = (p: any) => {
    const rec = { init: 0, put: 0, complete: 0, patchStatus: 0 };
    p.on("request", (r: any) => {
      const u = new URL(r.url());
      if (u.pathname === "/api/media/document/init") rec.init++;
      else if (u.pathname.startsWith("/api/media/upload/")) rec.put++;
      else if (u.pathname === "/api/media/document/complete") rec.complete++;
      else if (/\/giao-trinh\/trang-thai$/.test(u.pathname)) rec.patchStatus++;
    });
    return rec;
  };
  const drop = async (pg: any, files: F[]) => {
    const dt = await pg.evaluateHandle((fs: F[]) => {
      const d = new DataTransfer();
      for (const x of fs) d.items.add(new File([x.size ? new Uint8Array(x.size) : new Uint8Array(x.bytes ?? [])], x.name, { type: x.type }));
      return d;
    }, files);
    await pg.locator("[data-o-tha]").first().dispatchEvent("drop", { dataTransfer: dt });
  };
  const noOverflow = (pg: any) => pg.evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`) as Promise<boolean>;
  const base = (id: string) => `/lop-cua-toi/quan-lop/${id}`;
  const lessonRow = (pg: any, title: string) => pg.locator("[data-bai]", { hasText: title }).first();
  const openDetail = async (pg: any, title: string) => {
    await pg.getByRole("button", { name: `Chi tiết bài ${title}` }).first().click(); // 7b nhân bản chương ⇒ tên bài lặp ở chương bản sao
    await pg.getByRole("heading", { name: "Sửa bài học", level: 2 }).waitFor({ timeout: 30000 });
    await pg.waitForTimeout(450); // panel trượt vào 0,28s
  };
  const closePanel = async (pg: any) => { await pg.getByRole("button", { name: "Huỷ", exact: true }).first().click(); await pg.waitForTimeout(400); };

  // ── 1. Thư viện → thẻ → Bài học (1600 / 1280 / 390) ─────────────────────────────────────────────────
  for (const [W, H, tag] of [[1600, 1000, "1600"], [1280, 900, "1280"], [390, 844, "390"]] as const) {
    section(`1. Thư viện lớp → bấm thẻ → tab Bài học · ${tag}px`);
    const ctx = await ctxFor(T, { width: W, height: H, rail: "mac-dinh" });
    const pg = await ctx.newPage(); watch(pg);
    const railCurrent = () => pg.locator(`nav[aria-label="${RAIL}"] [aria-current=page]:visible`).count();
    await pg.goto(`${BASE}/lop-cua-toi/lop`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await pg.locator("[data-lop-the]").first().waitFor({ timeout: 120000 });
    if (process.env.NEXT_PUBLIC_KIN_MO_LICH !== "1")
      check(`${tag}: cờ lịch tắt → thẻ lớp không có "Chưa xếp lịch" / "Đặt lịch"`, (await pg.getByText("Chưa xếp lịch").count()) === 0 && (await pg.getByRole("link", { name: /^Đặt lịch/ }).count()) === 0);
    const href = await pg.locator("[data-lop-the]", { hasText: "Toán 9" }).getByRole("link", { name: /^Mở lớp/ }).getAttribute("href");
    check(`${tag}: liên kết "Mở lớp" = gốc lớp, không query, không /giao-trinh`, href === base(A.id), href);
    await pg.locator("[data-lop-the]", { hasText: "Toán 9" }).getByRole("link", { name: /^Mở lớp/ }).click();
    await pg.waitForURL(u => u.pathname === base(A.id) && u.search === "", { timeout: 120000 });
    await lessonRow(pg, "Bài có Drive cũ").waitFor({ timeout: 120000 });
    const strip = pg.locator(`${STRIP}:visible`);
    check(`${tag}: dải tab đúng ${TABS.length} mục theo thứ tự`, JSON.stringify((await strip.getByRole("link").allInnerTexts()).map(s => s.trim())) === JSON.stringify(TABS), await strip.getByRole("link").allInnerTexts());
    check(`${tag}: "Bài học" sáng (aria-current=page)`, (await strip.locator("[aria-current=page]").innerText()).trim() === "Bài học");
    check(`${tag}: không còn tab Giáo trình / Lịch học / Bài tập`, (await strip.getByRole("link", { name: /^(Giáo trình|Lịch học|Bài tập)$/ }).count()) === 0);
    check(`${tag}: thấy cây Chương · Bài (dòng tóm tắt + chương + bài)`, (await pg.locator("[data-bai-hoc-tong]").innerText()).includes("1 phần · 1 chương · 3 bài") && (await pg.getByText("Chương 1: Hàm số").count()) > 0);
    check(`${tag}: thanh bên MỘT mục sáng`, (await railCurrent()) === 1);
    check(`${tag}: không còn dòng dẫn sang tab Giáo trình`, (await pg.locator("[data-bai-tap-dan]").count()) === 0 && (await pg.getByText("nằm ở tab").count()) === 0);
    check(`${tag}: bài Nháp có chip CHỮ "Nháp · học sinh chưa thấy"`, (await lessonRow(pg, "Bài soạn nháp").locator('[data-bai-trang-thai="draft"]').innerText()).includes("Nháp · học sinh chưa thấy"));
    check(`${tag}: bài đã đăng không có chip trạng thái`, (await lessonRow(pg, "Bài có Drive cũ").locator("[data-bai-trang-thai]").count()) === 0);
    const smallBtn = await pg.evaluate(`[...document.querySelectorAll("[data-bai-hoc] button")].filter(e => e.offsetParent && e.closest("[data-bai-hoc]") && !e.closest('[role="dialog"]') && getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().height < 43.5 && e.getBoundingClientRect().width > 0).map(e => (e.textContent||"").trim().slice(0,16) + ":" + Math.round(e.getBoundingClientRect().height))`) as string[];
    check(`${tag}: nút trong cây ≥ 44px`, smallBtn.length === 0, smallBtn);
    check(`${tag}: không tràn ngang (cây)`, await noOverflow(pg));
    await shot(pg, `loi-02-bai-hoc-${tag}`);
    if (W === 390) {
      const handles = await pg.locator("[data-bai] svg.cursor-grab:visible").count();
      check("390: ẩn tay kéo ở hàng bài", handles === 0, handles);
      const rowH = await lessonRow(pg, "Bài soạn nháp").evaluate(e => e.getBoundingClientRect().height);
      check("390: hàng bài xếp nhiều dòng (tên / chip / nút), không ép một dòng", rowH > 90, rowH);
    }
    await ctx.close();
  }

  // ── 2. Đường cũ → mới (HTTP thật) ──────────────────────────────────────────────────────────────────
  section("2. …/giao-trinh → 307 + no-store về gốc; ?tab=chuong-bai → 200");
  const ck = await cookieFor(T);
  for (const q of ["", "?tab=x&moi=1"]) {
    const r = await fetch(`${BASE}${base(A.id)}/giao-trinh${q}`, { headers: { cookie: ck }, redirect: "manual" });
    const loc = r.headers.get("location") ?? "";
    const u = loc ? new URL(loc, BASE) : null;
    check(`GET …/giao-trinh${q} → 307, Location = gốc lớp (bỏ query), Cache-Control no-store`, r.status === 307 && u?.pathname === base(A.id) && u.search === "" && /no-store/.test(r.headers.get("cache-control") ?? ""), { status: r.status, loc, cc: r.headers.get("cache-control") });
  }
  const r200 = await fetch(`${BASE}${base(A.id)}?tab=chuong-bai`, { headers: { cookie: ck }, redirect: "manual" });
  check("GET gốc ?tab=chuong-bai → 200 (render thẳng, không chuyển hướng)", r200.status === 200, r200.status);
  const rXem = await fetch(`${BASE}${base(A.id)}/giao-trinh/xem/loi-l1`, { headers: { cookie: ck }, redirect: "manual" });
  check("GET …/giao-trinh/xem/<id> → 200 (trang con còn sống cạnh route.ts)", rXem.status === 200, rXem.status);
  const rLich = await fetch(`${BASE}${base(A.id)}/lich-hoc`, { headers: { cookie: ck }, redirect: "manual" });
  check("GET …/lich-hoc → 200 (vẫn mở bằng link)", rLich.status === 200, rLich.status);

  // ── 3. Trình duyệt: ?tab=chuong-bai, xem như học sinh, lịch học ─────────────────────────────────────
  section("3. Trình duyệt · 1600: ?tab=chuong-bai sáng Bài học; Xem như học sinh; …/lich-hoc không tab nào sáng");
  const ctx = await ctxFor(T, { width: 1600, height: 1000, rail: "mac-dinh" });
  const pg = await ctx.newPage(); watch(pg);
  const net = track(pg);
  await pg.goto(`${BASE}${base(A.id)}?tab=chuong-bai`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await lessonRow(pg, "Bài có Drive cũ").waitFor({ timeout: 120000 });
  check("?tab=chuong-bai: URL giữ nguyên, Bài học sáng, thấy cây", pg.url().includes("tab=chuong-bai") && (await pg.locator(`${STRIP} [aria-current=page]`).innerText()).trim() === "Bài học");
  await pg.goto(`${BASE}${base(A.id)}/giao-trinh`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pg.waitForURL(u => u.pathname === base(A.id), { timeout: 120000 });
  await lessonRow(pg, "Bài có Drive cũ").waitFor({ timeout: 120000 });
  check("trình duyệt mở …/giao-trinh → về gốc, thấy cây", true);
  await pg.goto(`${BASE}${base(A.id)}/giao-trinh/xem/loi-l1`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pg.getByText("Bài có Drive cũ").first().waitFor({ timeout: 120000 });
  check("…/giao-trinh/xem/<id>: mở được, Bài học sáng", (await pg.locator(`${STRIP} [aria-current=page]`).innerText()).trim() === "Bài học");
  await pg.goto(`${BASE}${base(A.id)}/lich-hoc`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pg.locator(`${STRIP}`).first().waitFor({ timeout: 120000 });
  await pg.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 90000 });
  check("…/lich-hoc: dải vẫn hiện, không có 'Lịch học', KHÔNG tab nào sáng",
    (await pg.locator(STRIP).getByRole("link", { name: "Lịch học", exact: true }).count()) === 0 && (await pg.locator(`${STRIP} [aria-current=page]`).count()) === 0);

  // ── 4. Panel Sửa bài: không Zoom, không dán Drive; Drive cũ hiện + xoá được; tải 2 tệp; .exe / 26 MB báo ngay ────────
  section("4. Panel Sửa bài học · 1600: Zoom bỏ, Drive cũ xoá được, tải 2 tệp có %, lỗi kiểu / dung lượng không gọi mạng");
  await pg.goto(`${BASE}${base(A.id)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await lessonRow(pg, "Bài có Drive cũ").waitFor({ timeout: 120000 });
  await openDetail(pg, "Bài có Drive cũ");
  await pg.waitForFunction(() => document.querySelector("[data-o-tha]")?.getAttribute("data-o-tha") !== "dang-kiem", undefined, { timeout: 60000 });
  const panelText = await pg.locator("[data-tai-lieu]").first().locator("xpath=ancestor::div[contains(@class,'fixed')][1]").innerText();
  check("panel không có ô 'Link phòng Zoom'", !panelText.includes("Link phòng Zoom") && (await pg.getByPlaceholder("https://zoom.us/j/...").count()) === 0);
  check("panel không có ô 'Dán link Google Drive' / 'Hoặc dán link tài liệu'", (await pg.getByPlaceholder(/Dán link Google Drive/).count()) === 0 && !panelText.includes("Hoặc dán link tài liệu"));
  check("bài có Zoom cũ: dòng chỉ đọc 'Bài này có link phòng Zoom cũ — học sinh vẫn thấy.'", (await pg.locator("[data-zoom-cu]").innerText()).includes("Bài này có link phòng Zoom cũ — học sinh vẫn thấy."));
  check("thứ tự khối: Tên → Ngày học → Trạng thái → Tài liệu → Thêm link → Ghi chú → Xem như học sinh", await pg.evaluate(`(() => {
    const order = ["#ls-ten", "[data-ngay-hoc]", "#ls-trang-thai", "[data-tai-lieu]", "[data-them-link]", "#ls-ghi-chu", "[data-xem-nhu-hoc-sinh]"].map(s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top : -1; });
    return order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1]));
  })()`));
  check("'Xem như học sinh ↗' trỏ …/giao-trinh/xem/<id>", (await pg.locator("[data-xem-nhu-hoc-sinh]").getAttribute("href")) === `${base(A.id)}/giao-trinh/xem/loi-l1`);
  check("tài liệu cũ dạng link Drive vẫn hiện (tên + đường)", (await pg.locator("[data-tai-lieu-hang]").count()) === 1 && (await pg.locator("[data-tai-lieu-hang]").first().innerText()).includes("Đề cương Drive") && (await pg.locator("[data-tai-lieu-hang]").first().innerText()).includes("drive.google.com"));
  await pg.getByRole("button", { name: 'Bỏ "Đề cương Drive"' }).click();
  check("bấm ✕ → hàng Drive cũ biến mất", (await pg.locator("[data-tai-lieu-hang]").count()) === 0);
  check("ô thả: sẵn sàng, cao ≥ 160px, có 'Chọn tệp từ máy' ≥ 44px", (await pg.locator('[data-o-tha="san-sang"]').count()) === 1
    && (await pg.locator("[data-o-tha]").evaluate(e => e.getBoundingClientRect().height >= 159.5))
    && (await pg.getByRole("button", { name: "Chọn tệp từ máy" }).evaluate(e => e.getBoundingClientRect().height >= 43.5)));
  check("ô chọn tệp cho chọn nhiều tệp, không nhận video", (await pg.locator("[data-o-tha-input]").getAttribute("multiple")) !== null && !/mp4|video/i.test((await pg.locator("[data-o-tha-input]").getAttribute("accept")) ?? ""));
  // DG (14/11/2026, vòng dạy thật): thả tệp khi CHƯA tích cam kết ⇒ câu báo nằm NGAY TRÊN ô thả (trước: dưới đoạn pháp lý dài, gia sư không thấy), không gọi init.
  if (!(await pg.locator("[data-tai-lieu-cam-ket]").isChecked())) {
    const nInit = net.init;
    await drop(pg, [{ name: "chua-cam-ket.pdf", type: "application/pdf", bytes: PDF }]);
    const msg = pg.locator("[data-tai-lieu] [data-loi]");
    await msg.waitFor({ timeout: 10000 });
    const above = await pg.evaluate(() => { const m = document.querySelector("[data-tai-lieu] [data-loi]"), z = document.querySelector("[data-o-tha]"); return !!m && !!z && m.getBoundingClientRect().bottom <= z.getBoundingClientRect().top + 1; });
    check("chưa tích cam kết: thả tệp ⇒ báo 'Hãy tích ô cam kết…' ngay trên ô thả, không gọi init", /tích ô cam kết/.test(await msg.innerText()) && above && net.init === nInit, { above });
  }
  await pg.locator("[data-tai-lieu-cam-ket]").check();
  await pg.route("**/api/media/upload/*", async r => { await sleep(1800); await r.continue(); });
  await drop(pg, [{ name: "de-cuong.pdf", type: "application/pdf", bytes: PDF }, { name: "phieu-bai-tap.pdf", type: "application/pdf", bytes: PDF }]);
  await pg.locator('[data-tai-lieu-tep] [role=progressbar]').first().waitFor({ timeout: 15000 });
  const pctText = await pg.locator("[data-tai-lieu-tep]").first().innerText();
  check("đang tải: thanh role=progressbar + chữ 'Đang tải lên… n%' hoặc 'Đang chờ tới lượt…'", /Đang tải lên… \d+%|Đang chờ tới lượt…/.test(pctText), pctText);
  check("đang tải: nút Lưu khoá, đọc 'Đang tải tệp…'", await pg.getByRole("button", { name: "Đang tải tệp…" }).isDisabled());
  await pg.screenshot({ path: `${SHOTS}/loi-02-panel-dang-tai-1600.png` });
  await pg.locator("[data-tai-lieu-hang]").nth(1).waitFor({ timeout: 60000 });
  await pg.unroute("**/api/media/upload/*");
  check("hai tệp xong → hai hàng tài liệu 'Tệp tải lên KiN'", (await pg.locator("[data-tai-lieu-hang]").count()) === 2 && (await pg.locator("[data-tai-lieu-hang]").first().innerText()).includes("Tệp tải lên KiN"));
  const init0 = net.init;
  await drop(pg, [{ name: "cai-dat.exe", type: "application/octet-stream", bytes: [77, 90] }, { name: "qua-nang.pdf", type: "application/pdf", size: 26 * 1024 * 1024 }]);
  await pg.locator("[data-tai-lieu-loi-tep]").nth(1).waitFor({ timeout: 15000 });
  await sleep(700);
  const errs = await pg.locator("[data-tai-lieu-loi-tep]").allInnerTexts();
  check("tệp .exe → lỗi kiểu NGAY tại hàng", errs.some(t => /cai-dat\.exe/.test(t) && /loại/.test(t)), errs);
  check("tệp 26 MB → 'nặng … vượt giới hạn' NGAY tại hàng", errs.some(t => /qua-nang\.pdf/.test(t) && /vượt giới hạn/.test(t)), errs);
  check("hai tệp sai: KHÔNG có yêu cầu /api/media/document/init nào", net.init === init0, { truoc: init0, sau: net.init });
  await pg.locator("#ls-ngay").fill("2026-11-20");
  await pg.getByRole("button", { name: /^Lưu$/ }).first().click();
  check("chỉ có ngày, chưa có giờ → 'Chọn giờ học.' tại chỗ, không lưu", await pg.locator("[data-ngay-loi]").innerText().then(t => t.includes("Chọn giờ học.")).catch(() => false));
  await pg.locator("#ls-gio").fill("18:30");
  await shot(pg, "loi-02-panel-1600");
  await pg.screenshot({ path: `${SHOTS}/loi-02-panel-khung-1600.png` });
  await pg.getByRole("button", { name: /^Lưu$/ }).first().click();
  await pg.getByRole("heading", { name: "Sửa bài học", level: 2 }).waitFor({ state: "hidden", timeout: 30000 });
  let l1 = await prisma.lesson.findUnique({ where: { id: "loi-l1" } });
  for (let k = 0; k < 20 && !(l1?.documents ?? "").includes("/api/media/"); k++) { await sleep(400); l1 = await prisma.lesson.findUnique({ where: { id: "loi-l1" } }); }
  const kinFiles = (l1?.documents ?? "").match(/\/api\/media\/[A-Za-z0-9_-]+\/file/g) ?? [];
  check("DB: tài liệu = 2 tệp KiN, link Drive cũ đã bỏ", kinFiles.length === 2 && !(l1?.documents ?? "").includes("drive.google.com"), l1?.documents);
  check("DB: link Zoom cũ CÒN NGUYÊN (PUT không gửi khoá zoomUrl), nhãn Live giữ", l1?.zoomUrl === ZOOM && /live/.test(String(l1?.type)), { zoom: l1?.zoomUrl, type: l1?.type });
  check("DB: scheduledAt = 20/11/2026 18:30 giờ VN = 11:30Z", l1?.scheduledAt?.toISOString() === "2026-11-20T11:30:00.000Z", l1?.scheduledAt);

  // ── 5. Kho tắt ─────────────────────────────────────────────────────────────────────────────────────
  section("5. Kho tắt (ép /api/media/config document.enabled=false) → chữ rõ, trang không vỡ");
  const pgOff = await ctx.newPage(); watch(pgOff);
  const netOff = track(pgOff);
  await pgOff.route("**/api/media/config", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    video: { enabled: false, driver: "none", maxBytes: 0, reason: "tắt" },
    document: { enabled: false, driver: "none", maxBytes: 0, reason: "Tải tệp lên chưa bật. Hãy dán link Google Drive.", exts: ["pdf"], quotaBytes: 0, usedBytes: 0 },
  }) }));
  await pgOff.goto(`${BASE}${base(A.id)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await lessonRow(pgOff, "Bài soạn nháp").waitFor({ timeout: 120000 });
  await openDetail(pgOff, "Bài soạn nháp");
  await pgOff.locator('[data-o-tha="tat"]').waitFor({ timeout: 30000 });
  const offText = await pgOff.locator('[data-o-tha="tat"]').innerText();
  check("ô thả: 'Kho tệp chưa bật — chủ cần cấu hình.' + 'Tài liệu cũ vẫn hiện cho học sinh.'", offText.includes("Kho tệp chưa bật — chủ cần cấu hình.") && offText.includes("Tài liệu cũ vẫn hiện cho học sinh."), offText);
  check("không hiện lý do máy chủ bảo dán link Drive, không có ô chọn tệp", !offText.includes("dán link Google Drive") && (await pgOff.locator("[data-o-tha-input]").count()) === 0);
  await drop(pgOff, [{ name: "x.pdf", type: "application/pdf", bytes: PDF }]);
  await sleep(600);
  check("thả tệp khi kho tắt → không gọi mạng, trang không đổi hướng", netOff.init === 0 && pgOff.url().includes(base(A.id)));
  check("nút Lưu vẫn dùng được", await pgOff.getByRole("button", { name: /^Lưu$/ }).first().isEnabled());
  await closePanel(pgOff);
  await pgOff.close();

  // ── 6. Sửa nhanh trong cây ─────────────────────────────────────────────────────────────────────────
  section("6. Sửa nhanh · 1600: đổi tên + ngày (Enter) → tải lại thấy chip đúng giờ VN");
  await pg.goto(`${BASE}${base(A.id)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await lessonRow(pg, "Bài soạn nháp").waitFor({ timeout: 120000 });
  await lessonRow(pg, "Bài soạn nháp").getByRole("button", { name: "Sửa nhanh", exact: true }).click();
  const qf = pg.locator('[data-sua-nhanh="sua"]');
  await qf.waitFor({ timeout: 10000 });
  await qf.getByLabel("Tên bài").fill("Buổi 2 — đổi tên");
  await qf.getByLabel("Ngày học").fill("2026-11-13");
  await qf.getByLabel("Giờ học").fill("19:00");
  await qf.getByLabel("Tên bài").press("Enter");
  await qf.waitFor({ state: "detached", timeout: 30000 });
  await pg.reload({ waitUntil: "domcontentloaded" });
  await lessonRow(pg, "Buổi 2 — đổi tên").waitFor({ timeout: 120000 });
  const want = formatVnLessonWhen("2026-11-13T12:00:00.000Z")!;
  const chip = (await lessonRow(pg, "Buổi 2 — đổi tên").locator("[data-bai-ngay]").innerText()).trim();
  check(`tải lại: chip ngày "${want}" (giờ VN)`, chip === want && /T6 13\/11/.test(chip) && chip.endsWith("19:00"), chip);
  const l2 = await prisma.lesson.findUnique({ where: { id: "loi-l2" } });
  check("DB: tên mới + scheduledAt = 2026-11-13T12:00:00.000Z; vẫn Nháp", l2?.title === "Buổi 2 — đổi tên" && l2?.scheduledAt?.toISOString() === "2026-11-13T12:00:00.000Z" && l2?.status === "draft", l2);
  await lessonRow(pg, "Buổi 2 — đổi tên").locator("[data-bai-ngay]").click();
  await qf.waitFor({ timeout: 10000 });
  check("bấm chip ngày → mở Sửa nhanh với ngày giờ sẵn", (await qf.getByLabel("Ngày học").inputValue()) === "2026-11-13" && (await qf.getByLabel("Giờ học").inputValue()) === "19:00");
  await qf.getByLabel("Tên bài").fill("Không lưu tên này");
  await qf.getByLabel("Tên bài").press("Escape");
  await qf.waitFor({ state: "detached", timeout: 10000 });
  check("Esc huỷ Sửa nhanh, tên cũ giữ", (await lessonRow(pg, "Buổi 2 — đổi tên").count()) === 1 && (await pg.getByText("Không lưu tên này").count()) === 0);

  // ── 7. KinSelect bằng bàn phím (ô Trạng thái) + đổi trạng thái ─────────────────────────────────────
  section("7. KinSelect bàn phím · ô Trạng thái của panel; Nháp → Đã đăng; đổi trạng thái lỗi báo riêng");
  await openDetail(pg, "Buổi 2 — đổi tên");
  const sel = pg.locator("#ls-trang-thai");
  check("KinSelect: role=combobox, đọc 'Nháp', đóng (aria-expanded=false), cao ≥ 44px", (await sel.getAttribute("role")) === "combobox" && (await sel.innerText()).includes("Nháp") && (await sel.getAttribute("aria-expanded")) === "false" && (await sel.evaluate(e => e.getBoundingClientRect().height >= 43.5)));
  await sel.focus();
  await pg.keyboard.press("ArrowDown");
  check("↓ mở danh sách (aria-expanded=true, listbox + 3 option)", (await sel.getAttribute("aria-expanded")) === "true" && (await pg.locator('[role="listbox"] [role="option"]').count()) === 3);
  check("mục 'Ẩn' bị khoá với bài Nháp (luật G4)", (await pg.locator('[role="option"]', { hasText: "Ẩn" }).getAttribute("aria-disabled")) === "true");
  const optH = await pg.locator('[role="option"]').evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
  check("mỗi mục ≥ 44px", optH.every(h => h >= 43.5), optH);
  await pg.keyboard.press("Escape");
  check("Esc đóng và trả tiêu điểm về nút", (await sel.getAttribute("aria-expanded")) === "false" && (await pg.evaluate(() => document.activeElement?.id)) === "ls-trang-thai");
  await pg.keyboard.press("d"); // gõ chữ không dấu → "Đã đăng"
  check("gõ 'd' (không dấu) khi đóng → chọn 'Đã đăng'", (await sel.innerText()).includes("Đã đăng"), await sel.innerText());
  await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("Enter");
  check("↓ ↓ Enter → chọn 'Nháp', đóng", (await sel.innerText()).includes("Nháp") && (await sel.getAttribute("aria-expanded")) === "false");
  await sel.click();
  await pg.locator('[role="option"]', { hasText: "Đã đăng" }).click();
  check("bấm chuột chọn 'Đã đăng' → đóng, hiện 'Đã đăng'", (await sel.innerText()).includes("Đã đăng") && (await sel.getAttribute("aria-expanded")) === "false");
  const p0 = net.patchStatus;
  await pg.getByRole("button", { name: /^Lưu$/ }).first().click();
  await pg.getByRole("heading", { name: "Sửa bài học", level: 2 }).waitFor({ state: "hidden", timeout: 30000 })
    .catch(async e => { console.log("  · panel còn mở:", await pg.locator("[data-trang-thai-loi], [data-panel-loi]").allInnerTexts()); throw e; });
  let st = "";
  for (let k = 0; k < 20 && st !== "published"; k++) { await sleep(300); st = (await prisma.lesson.findUnique({ where: { id: "loi-l2" } }))?.status ?? ""; }
  check("Lưu → đổi trạng thái qua PATCH …/giao-trinh/trang-thai (DB = published), chip Nháp biến mất", st === "published" && net.patchStatus === p0 + 1 && (await lessonRow(pg, "Buổi 2 — đổi tên").locator("[data-bai-trang-thai]").count()) === 0, { st, patch: net.patchStatus - p0 });
  await pg.route("**/giao-trinh/trang-thai", r => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Máy chủ đang bận." }) }));
  await openDetail(pg, "Bài đổi trạng thái lỗi");
  await pg.locator("#ls-ghi-chu").fill("Ghi chú mới đã lưu");
  await pg.locator("#ls-trang-thai").click();
  await pg.locator('[role="option"]', { hasText: "Ẩn" }).click();
  await pg.getByRole("button", { name: /^Lưu$/ }).first().click();
  await pg.locator("[data-trang-thai-loi]").waitFor({ timeout: 30000 });
  check("đổi trạng thái lỗi → báo riêng 'Đã lưu bài, chưa đổi được trạng thái: …'", (await pg.locator("[data-trang-thai-loi]").innerText()).includes("Đã lưu bài, chưa đổi được trạng thái: Máy chủ đang bận."));
  const l3 = await prisma.lesson.findUnique({ where: { id: "loi-l3" } });
  check("…phần đã lưu GIỮ (ghi chú mới trong DB), trạng thái vẫn published", l3?.adminNote === "Ghi chú mới đã lưu" && l3?.status === "published", { note: l3?.adminNote, st: l3?.status });
  await pg.unroute("**/giao-trinh/trang-thai");
  await closePanel(pg);

  // ── 7b. Bài mới: chỉ Đã đăng · Nháp, Nháp gửi thẳng trong POST (không PATCH); nhân bản bài / chương Nháp · Ẩn ⇒ bản sao Nháp ──────────
  section("7b. Bài mới không có 'Ẩn'; Nháp đi trong POST; nhân bản bài Nháp / chương có bài Nháp · Ẩn ⇒ bản sao Nháp (TRẺ EM)");
  const posts: { url: string; body: Record<string, unknown> }[] = [];
  const onReq = (r: any) => { if (r.method() === "POST" && /\/api\/chapters\/[^/]+\/lessons$/.test(new URL(r.url()).pathname)) posts.push({ url: r.url(), body: JSON.parse(r.postData() || "{}") }); };
  pg.on("request", onReq);
  await pg.locator("[data-them-bai]").first().click();
  const qn = pg.locator('[data-sua-nhanh="them"]');
  await qn.waitFor({ timeout: 10000 });
  await qn.getByLabel("Tên bài").fill("Bài mới để nháp");
  await qn.getByRole("button", { name: "Chi tiết…" }).click();
  await pg.getByRole("heading", { name: "Thêm bài học", level: 2 }).waitFor({ timeout: 30000 });
  await pg.waitForTimeout(450);
  await pg.locator("#ls-trang-thai").click();
  const addOpts = (await pg.locator('[role="listbox"] [role="option"]').allInnerTexts()).map(t => t.replace("✓", "").trim()); // mục đang chọn có dấu ✓
  check("panel Thêm bài: ô Trạng thái chỉ có 'Đã đăng' · 'Nháp' (không 'Ẩn')", JSON.stringify(addOpts) === JSON.stringify(["Đã đăng", "Nháp"]), addOpts);
  check("…có chữ gợi ý 'Bài mới chưa muốn hiện thì chọn Nháp.'", (await pg.locator("[data-goi-y-nhap]").innerText()).trim() === "Bài mới chưa muốn hiện thì chọn Nháp.");
  await pg.locator('[role="option"]', { hasText: "Nháp" }).click();
  await shot(pg, "loi-02-them-bai-nhap-1600");
  const pAdd = net.patchStatus, nPost = posts.length;
  await pg.getByRole("button", { name: /^Lưu$/ }).first().click();
  await pg.getByRole("heading", { name: "Thêm bài học", level: 2 }).waitFor({ state: "hidden", timeout: 30000 });
  await lessonRow(pg, "Bài mới để nháp").waitFor({ timeout: 30000 });
  const ln = await prisma.lesson.findFirst({ where: { title: "Bài mới để nháp" } });
  check("Lưu bài mới Nháp → POST mang status:'draft', KHÔNG gọi PATCH trạng thái, DB = draft, chip Nháp", ln?.status === "draft" && posts.length === nPost + 1 && posts[nPost].body.status === "draft" && net.patchStatus === pAdd
    && (await lessonRow(pg, "Bài mới để nháp").locator('[data-bai-trang-thai="draft"]').count()) === 1, { st: ln?.status, post: posts[nPost]?.body.status, patch: net.patchStatus - pAdd });

  await mkLesson("loi-l4", "Bài ẩn để sao", 20, { status: "hidden", documents: JSON.stringify([{ name: "Phiếu ẩn", url: DRIVE, type: "file" }]) });
  await pg.reload({ waitUntil: "domcontentloaded" });
  await lessonRow(pg, "Bài ẩn để sao").waitFor({ timeout: 120000 });
  await pg.getByRole("button", { name: 'Thêm thao tác cho bài "Bài mới để nháp"' }).click();
  await pg.getByRole("menuitem", { name: "Sao chép bài" }).click();
  await lessonRow(pg, "Bài mới để nháp (bản sao)").waitFor({ timeout: 30000 });
  const cp1 = await prisma.lesson.findFirst({ where: { title: "Bài mới để nháp (bản sao)" } });
  check("nhân bản bài Nháp → bản sao Nháp (DB + chip 'Nháp · học sinh chưa thấy'), POST mang status:'draft'", cp1?.status === "draft"
    && (await lessonRow(pg, "Bài mới để nháp (bản sao)").locator('[data-bai-trang-thai="draft"]').innerText()).includes("Nháp · học sinh chưa thấy") && posts[posts.length - 1].body.status === "draft", cp1?.status);
  const src = await prisma.lesson.findMany({ where: { chapterId: "loi-c" }, select: { title: true, status: true } });
  await pg.getByRole("button", { name: "Sao chép chương" }).first().click();
  let copies: { title: string; status: string }[] = [];
  for (let k = 0; k < 60; k++) {
    await sleep(300);
    const ch = await prisma.chapter.findFirst({ where: { title: "Chương 1: Hàm số (bản sao)" }, include: { lessons: { select: { title: true, status: true } } } });
    copies = ch?.lessons ?? [];
    if (copies.length === src.length) break;
  }
  const stOf = (t: string) => copies.find(c => c.title === t)?.status;
  check("nhân bản chương → đủ bài; bài Nháp → Nháp, bài Ẩn → Nháp, bài Đã đăng → Đã đăng (không bài nào lộ thêm)", copies.length === src.length
    && src.every(x => stOf(x.title) === (x.status === "published" ? "published" : "draft")), { src, copies });
  await pg.getByText("Chương 1: Hàm số (bản sao)").first().waitFor({ timeout: 30000 });
  const chCopy = pg.locator("[data-bai]", { hasText: "Bài ẩn để sao" });
  check("…cây hiện chip Nháp ở bài sao của bài Ẩn", (await chCopy.count()) === 2 && (await chCopy.nth(1).locator('[data-bai-trang-thai="draft"]').count()) === 1, await chCopy.count());
  await shot(pg, "loi-02-nhan-ban-nhap-1600");
  pg.off("request", onReq);

  section("7c. Q2 (14/11): 'Lưu và thêm bài tập' — một màn: bài lưu xong, panel thành Sửa bài học, phần bài tập mở sẵn");
  await pg.locator("[data-them-bai]").first().click();
  const qn2 = pg.locator('[data-sua-nhanh="them"]');
  await qn2.waitFor({ timeout: 10000 });
  await qn2.getByLabel("Tên bài").fill("Bài có bài tập ngay");
  await qn2.getByRole("button", { name: "Chi tiết…" }).click();
  await pg.getByRole("heading", { name: "Thêm bài học", level: 2 }).waitFor({ timeout: 30000 });
  await pg.waitForTimeout(450);
  const lbt = pg.locator("[data-luu-them-bai-tap]");
  const lbtBox = await lbt.boundingBox();
  check("panel Thêm bài: có ô 'Bài tập của bài' + nút 'Lưu và thêm bài tập' ≥44px, chưa có trình soạn bài tập", (await lbt.count()) === 1 && (lbtBox?.height ?? 0) >= 43.5 && (await pg.locator("[data-bai-tap-tu-nop]").count()) === 0, lbtBox);
  const nPost2 = posts.length;
  pg.on("request", onReq);
  await lbt.click();
  await pg.getByRole("heading", { name: "Sửa bài học", level: 2 }).waitFor({ timeout: 30000 });
  await pg.locator("[data-bai-tap-cua-bai] [data-bai-tap-tu-nop]").waitFor({ timeout: 30000 });
  pg.off("request", onReq);
  const lq2 = await prisma.lesson.findFirst({ where: { title: "Bài có bài tập ngay" } });
  check("…bấm ⇒ đúng 1 POST, bài có trong DB, panel ở lại thành 'Sửa bài học' với trình soạn bài tập của bài vừa lưu", !!lq2 && posts.length === nPost2 + 1
    && (await pg.getByRole("heading", { name: "Thêm bài học", level: 2 }).count()) === 0, { lesson: lq2?.id, posts: posts.length - nPost2 });
  await shot(pg, "loi-02-luu-them-bai-tap-1600");
  await pg.getByRole("button", { name: "Đóng" }).first().click();
  await pg.getByRole("heading", { name: "Sửa bài học", level: 2 }).waitFor({ state: "hidden", timeout: 30000 });
  await lessonRow(pg, "Bài có bài tập ngay").waitFor({ timeout: 30000 });

  // ── 8. Lớp rỗng → Tạo chương đầu tiên → thêm bài ngay trong cây ─────────────────────────────────────
  section("8. Lớp rỗng: 'Lớp chưa có bài học' → 'Tạo chương đầu tiên' → + bài nhanh");
  await pg.goto(`${BASE}${base(E.id)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pg.getByText("Lớp chưa có bài học").first().waitFor({ timeout: 120000 });
  await pg.getByRole("button", { name: "Tạo chương đầu tiên" }).click();
  const qa = pg.locator('[data-sua-nhanh="them"]');
  await qa.waitFor({ timeout: 30000 });
  check("tạo xong phần 'Nội dung lớp' + 'Chương 1', mở sẵn hàng thêm bài", (await pg.getByText("Chương 1", { exact: true }).count()) > 0 && (await prisma.chapter.count({ where: { section: { courseId: E.id } } })) === 1);
  await qa.getByLabel("Tên bài").fill("Buổi 1: Làm quen");
  await qa.getByLabel("Ngày học").fill("2026-11-14");
  await qa.getByLabel("Giờ học").fill("08:00");
  await qa.getByRole("button", { name: "Lưu" }).click();
  await lessonRow(pg, "Buổi 1: Làm quen").waitFor({ timeout: 30000 });
  const le = await prisma.lesson.findFirst({ where: { title: "Buổi 1: Làm quen" } });
  check("DB: bài mới Đã đăng, scheduledAt = 2026-11-14T01:00:00.000Z, không có zoomUrl", le?.status === "published" && le?.scheduledAt?.toISOString() === "2026-11-14T01:00:00.000Z" && !le?.zoomUrl, le);
  await ctx.close();

  // ── 9. 390: Sửa nhanh + panel không tràn ─────────────────────────────────────────────────────────────
  section("9. 390px: Sửa nhanh và panel không cuộn ngang, nút ≥ 44px");
  const cm = await ctxFor(T, { width: 390, height: 844, rail: "mac-dinh" });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${BASE}${base(A.id)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await lessonRow(pm, "Buổi 2 — đổi tên").waitFor({ timeout: 120000 });
  await lessonRow(pm, "Buổi 2 — đổi tên").getByRole("button", { name: "Sửa nhanh", exact: true }).click();
  await pm.locator('[data-sua-nhanh="sua"]').waitFor({ timeout: 10000 });
  check("390: form Sửa nhanh không tràn ngang", await noOverflow(pm));
  const dY = await pm.locator('[data-sua-nhanh="sua"]').evaluate(f => { const t = f.querySelector('input[type="date"]')!.getBoundingClientRect(), g = f.querySelector('input[type="time"]')!.getBoundingClientRect(); return Math.abs(t.top - g.top); });
  check("390: Ngày + Giờ cùng một dòng", dY < 4, dY);
  await pm.screenshot({ path: `${SHOTS}/loi-02-sua-nhanh-390.png` });
  await pm.locator('[data-sua-nhanh="sua"]').getByRole("button", { name: "Huỷ" }).click();
  await openDetail(pm, "Buổi 2 — đổi tên");
  await pm.waitForFunction(() => document.querySelector("[data-o-tha]")?.getAttribute("data-o-tha") !== "dang-kiem", undefined, { timeout: 60000 });
  check("390: panel phủ toàn màn, không tràn ngang", await noOverflow(pm) && (await pm.locator("[data-tai-lieu]").first().locator("xpath=ancestor::div[contains(@class,'fixed')][1]").evaluate(e => Math.round(e.getBoundingClientRect().width))) === 390);
  const tiny = await pm.evaluate(`[...document.querySelectorAll("[data-tai-lieu] button, [data-ngay-hoc] button, #ls-trang-thai")].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5).map(e => (e.textContent||"").trim().slice(0,16) + ":" + Math.round(e.getBoundingClientRect().height))`) as string[];
  check("390: nút trong panel ≥ 44px", tiny.length === 0, tiny);
  check("390: nút Lưu / Huỷ dính đầu panel", await pm.getByRole("button", { name: /^Lưu$/ }).first().isVisible());
  // DG (14/11/2026, vòng dạy thật): khối "Bài tập tự nộp" trong panel — nút ≥ 44px (trước: "+ Thêm bài tập" 16px, "Lưu bài tập" 28px) và
  // không còn hứa "tab Giáo trình (sắp có)" (tab đã bỏ ở LOI-02); chỉ đúng chỗ thả tệp đề là ô Tài liệu của bài.
  {
    const bt = pm.locator("[data-bai-tap-tu-nop]");
    await bt.scrollIntoViewIfNeeded();
    await bt.getByRole("button", { name: "+ Thêm bài tập" }).click();
    await bt.getByPlaceholder("Tiêu đề bài tập *").waitFor({ timeout: 30000 });
    const small = await bt.evaluate(el => [...el.querySelectorAll("button")].filter(b => (b as HTMLElement).offsetParent && b.getBoundingClientRect().height < 43.5).map(b => `${(b.textContent || "").trim().slice(0, 16)}:${Math.round(b.getBoundingClientRect().height)}`));
    const hint = await bt.locator("[data-tai-lieu-dong]").innerText();
    check("390: Bài tập tự nộp — mọi nút ≥ 44px; chữ chỉ ô Tài liệu, không 'tab Giáo trình' / 'sắp có'", small.length === 0 && /ô Tài liệu/.test(hint) && !/Giáo trình|sắp có/.test(hint), { small, hint });
    await bt.getByRole("button", { name: "Huỷ", exact: true }).click();
  }
  await pm.screenshot({ path: `${SHOTS}/loi-02-panel-390.png` });
  await pm.locator("[data-o-tha]").scrollIntoViewIfNeeded();
  await pm.screenshot({ path: `${SHOTS}/loi-02-panel-o-tha-390.png` });
  await cm.close();

  // ── 10. Phân quyền ────────────────────────────────────────────────────────────────────────────────
  section("10. Phá: gia sư B mở lớp của A; lớp không có; gia sư chờ duyệt");
  const cb = await ctxFor(TB, { width: 1280, height: 900, rail: "mac-dinh" });
  const pb = await cb.newPage(); watch(pb);
  await pb.goto(`${BASE}${base(A.id)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pb.getByText("Bạn không có quyền với lớp này").first().waitFor({ timeout: 120000 });
  const bodyB = await pb.locator("body").innerText();
  check("gia sư B → 'Bạn không có quyền với lớp này', KHÔNG tên lớp / bài / học sinh của A", !bodyB.includes("Toán 9 — Lõi lớp") && !bodyB.includes("Buổi 2") && !bodyB.includes("Em Mai"));
  check("tiêu đề trang không mang tên lớp A", !(await pb.title()).includes("Toán 9"), await pb.title());
  await pb.goto(`${BASE}${base("khong-co-lop-nay")}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pb.getByText("Không tìm thấy lớp").first().waitFor({ timeout: 120000 });
  check("lớp không có → 'Không tìm thấy lớp'", true);
  await cb.close();
  const cp = await ctxFor(PEND, { width: 1280, height: 900, rail: "mac-dinh" });
  const pp = await cp.newPage(); watch(pp);
  for (const path of [base(A.id), `${base(A.id)}/giao-trinh`]) {
    await pp.goto(`${BASE}${path}`, { timeout: 180000 }).catch(() => {});
    await pp.waitForURL(/\/lop-cua-toi\/cho-duyet/, { timeout: 120000 });
    check(`gia sư chờ duyệt mở ${path.replace(/^\/lop-cua-toi\//, "")} → /lop-cua-toi/cho-duyet`, /cho-duyet/.test(pp.url()), pp.url());
  }
  await cp.close();

  check("không lỗi JS / console", errors.length === 0, errors.slice(0, 5));
  void B; void S;
  await closeAll();
  await done();
})().catch(e => { console.error(e); process.exit(1); });
