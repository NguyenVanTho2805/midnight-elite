// GS-LOP-GON (09/11/2026) — ngăn kéo "Thêm bài học" có VÙNG KÉO THẢ tài liệu thật (mục 5 + 9.1 của đặc tả). Bổ sung cho ui-gs-lop-gon.ts (bài đó chỉ kiểm khung có mặt / cờ bật tắt).
// Ca: hai tệp thả CÙNG LÚC (tiến trình hiện, xong thành hàng tài liệu, lưu bài rồi còn tệp, FileAsset gắn vào bài); chưa tích cam kết → KHÔNG có yêu cầu mạng; thả .mp4 → lỗi tại chỗ,
// KHÔNG có yêu cầu /api/media/document/init; 31 tệp → "Mỗi bài tối đa 30 tài liệu." không mạng; ép /api/media/config document.enabled=false → hiện đúng lý do, khung thả khoá, dán link còn chạy;
// ép init 403 → chữ lỗi tại hàng; quản trị không phải chủ → "Chỉ chủ lớp…"; đóng ngăn không Lưu → có DELETE và FileAsset mồ côi biến mất; 390 / 320 không tràn ngang khi hàng đợi đang hiện.
// LOI-02 (11/11/2026): ngăn mở từ "+ Thêm bài" → "Chi tiết…"; vùng thả là upload/OThaTep (data-o-tha: dang-kiem · loi-kiem · tat · khong-chu · san-sang · keo-vao);
// đã BỎ ô dán link Drive ⇒ ca "kho tắt" nay kiểm chữ "Kho tệp chưa bật — chủ cần cấu hình." và KHÔNG có ô dán link; mở lại bài bằng "Chi tiết bài …".
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-gs-lop-gon-tha.ts   (máy chủ thử ở BASE, DB riêng — bài gọi wipe()). Tệp thử ghi vào .kin-media của worktree (kho cục bộ của máy dev).
// Ghi chú: ở máy dev kho tài liệu LUÔN bật (driver local); ca "kho tắt" dùng route() ép /api/media/config, vì production thiếu 3 biến Cloudinary mới tắt thật (việc của chủ).
import { BASE, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

const PDF = [..."%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"].map(c => c.charCodeAt(0));
const PNG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 73, 72, 68, 82];
const TXT = [..."tai lieu thu\n"].map(c => c.charCodeAt(0));
type F = { name: string; type: string; bytes: number[] };
const f = (name: string, type: string, bytes: number[]): F => ({ name, type, bytes });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), SA = await mkSuper("Quản trị cấp 1");
  const course = await mkCourse(T.id, { name: "Toán 9 — kéo thả tài liệu" });
  await prisma.section.create({ data: { id: "sec-tha", title: "PHẦN 1", order: 0, courseId: course.id } });
  await prisma.chapter.create({ data: { id: "ch-tha", title: "Chương 1", order: 0, sectionId: "sec-tha" } });
  const URL_TAB = `${BASE}/lop-cua-toi/quan-lop/${course.id}?tab=chuong-bai`;

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => { if (!/negative time stamp/i.test(String(e))) errors.push(String(e)); });
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|hydrat/i.test(m.text())) errors.push(m.text()); });
  };
  /** Ghi lại mọi yêu cầu tài liệu của một trang để đếm. */
  const track = (p: any) => {
    const rec = { init: 0, put: 0, complete: 0, del: [] as string[] };
    p.on("request", (r: any) => {
      const u = new URL(r.url());
      if (u.pathname === "/api/media/document/init") rec.init++;
      else if (u.pathname.startsWith("/api/media/upload/")) rec.put++;
      else if (u.pathname === "/api/media/document/complete") rec.complete++;
      else if (r.method() === "DELETE" && /^\/api\/media\/document\//.test(u.pathname)) rec.del.push(u.pathname);
    });
    return rec;
  };
  const drop = async (pg: any, files: F[]) => {
    const dt = await pg.evaluateHandle((fs: F[]) => { const d = new DataTransfer(); for (const x of fs) d.items.add(new File([new Uint8Array(x.bytes)], x.name, { type: x.type })); return d; }, files);
    await pg.locator("[data-o-tha]").first().dispatchEvent("drop", { dataTransfer: dt });
  };
  const openDrawer = async (pg: any, url = URL_TAB) => {
    await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
    await pg.getByRole("button", { name: "+ Thêm bài" }).first().click({ timeout: 120000 });
    await pg.locator('[data-sua-nhanh="them"]').getByRole("button", { name: "Chi tiết…" }).click();
    await pg.getByRole("heading", { name: "Thêm bài học", level: 2 }).waitFor({ timeout: 60000 });
    await pg.locator("[data-o-tha]").first().waitFor({ timeout: 60000 });
    await pg.waitForFunction(() => document.querySelector("[data-o-tha]")?.getAttribute("data-o-tha") !== "dang-kiem", undefined, { timeout: 60000 });
    await pg.waitForTimeout(500); // ngăn trượt vào 0,28s
  };
  const noOverflow = (pg: any) => pg.evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
  const drawer = (pg: any) => pg.locator("[data-tai-lieu]").first();

  // ── 1. Kho bật (máy dev): chưa tích cam kết, video, nhiều tệp, tiến trình ───────────────────────────────
  section("1. Gia sư chủ lớp · 1280px: khung thả, cam kết, .mp4, hai tệp cùng lúc");
  const ctx = await ctxFor(T, { width: 1280, height: 900, rail: "mac-dinh" });
  const pg = await ctx.newPage(); watch(pg);
  const net = track(pg);
  await openDrawer(pg);
  const cfg = await pg.evaluate(`fetch("/api/media/config", { credentials: "same-origin" }).then(r => r.json())`) as { document?: { enabled?: boolean } };
  check("máy dev: kho tài liệu bật (driver local) → khung 'san-sang'", cfg.document?.enabled === true && (await pg.locator('[data-o-tha="san-sang"]').count()) === 1, cfg.document);
  const accept = (await pg.locator('[data-tai-lieu] input[type=file]').first().getAttribute("accept")) ?? "";
  check("ô chọn tệp nhận Word / PDF / ảnh, KHÔNG nhận video, cho chọn nhiều tệp", /\.docx?/.test(accept) && /\.pdf/.test(accept) && /\.png/.test(accept) && !/mp4|mov|webm|mkv|avi|video\//i.test(accept) && (await pg.locator('[data-tai-lieu] input[type=file]').first().getAttribute("multiple")) !== null, accept);

  await drop(pg, [f("de-cuong.pdf", "application/pdf", PDF)]);
  await pg.getByText("Hãy tích ô cam kết bản quyền trước khi tải tệp lên.").waitFor({ timeout: 10000 });
  await sleep(800);
  check("chưa tích cam kết bản quyền → có lời nhắc, KHÔNG yêu cầu mạng nào (init = 0)", net.init === 0 && (await drawer(pg).locator("[data-tai-lieu-tep]").count()) === 0, net);

  await pg.locator("[data-tai-lieu-cam-ket]").check();
  await drop(pg, [f("bai-giang.mp4", "video/mp4", [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70])]);
  await pg.locator("[data-tai-lieu-loi-tep]").first().waitFor({ timeout: 10000 });
  const mp4Msg = await pg.locator("[data-tai-lieu-loi-tep]").first().innerText();
  await sleep(800);
  check(`thả .mp4 → lỗi NGAY tại hàng ("${mp4Msg.slice(0, 60)}…"), nhắc dán link YouTube`, /video|YouTube/i.test(mp4Msg), mp4Msg);
  check("thả .mp4 → KHÔNG có yêu cầu /api/media/document/init, không PUT", net.init === 0 && net.put === 0, net);
  await pg.getByRole("button", { name: /^Đóng thông báo về bai-giang\.mp4/ }).click();
  check("đóng được dòng lỗi của .mp4", (await pg.locator("[data-tai-lieu-loi-tep]").count()) === 0);

  // hai tệp cùng lúc; làm chậm gửi byte để THẤY thanh tiến trình
  await pg.route("**/api/media/upload/*", async r => { await sleep(1800); await r.continue(); });
  await drop(pg, [f("de-cuong.pdf", "application/pdf", PDF), f("so-do.png", "image/png", PNG)]);
  await pg.locator('[data-tai-lieu-tep="up"] [role=progressbar], [data-tai-lieu-tep="wait"] [role=progressbar]').first().waitFor({ timeout: 15000 });
  const bars = await pg.locator("[data-tai-lieu-tep] [role=progressbar]").count();
  check(`hai tệp thả cùng lúc: thanh tiến trình hiện (${bars} thanh), có nút Huỷ ≥ 44px`, bars >= 1 && (await pg.locator("[data-tai-lieu-tep]").getByRole("button", { name: /^Huỷ tải/ }).first().evaluate(e => e.getBoundingClientRect().height >= 43.5)));
  check("lúc đang tải: nút Lưu của ngăn khoá, đọc 'Đang tải tệp…'", await pg.getByRole("button", { name: "Đang tải tệp…" }).isDisabled());
  const wasNarrow = await noOverflow(pg);
  await pg.screenshot({ path: `${process.env.SHOTS ?? "scratchpad/shots"}/gs-lop-gon-tha-tien-trinh-1280.png` });
  await pg.locator("[data-tai-lieu-hang]").nth(1).waitFor({ timeout: 60000 });
  await pg.unroute("**/api/media/upload/*");
  check("xong → thành HAI hàng tài liệu (de-cuong.pdf, so-do.png), hàng đợi trống", (await pg.locator("[data-tai-lieu-hang]").count()) === 2 && (await pg.locator("[data-tai-lieu-tep]").count()) === 0 && (await drawer(pg).innerText()).includes("de-cuong.pdf") && (await drawer(pg).innerText()).includes("so-do.png"));
  check("chỉ 2 lượt init / 2 PUT / 2 complete (mp4 không tính)", net.init === 2 && net.put === 2 && net.complete === 2, net);
  check("lúc tải không tràn ngang", wasNarrow);
  check("tệp tải lên có nhãn 'Tệp tải lên KiN' (không lộ đường dẫn)", (await drawer(pg).innerText()).includes("Tệp tải lên KiN"));
  const before = await prisma.fileAsset.findMany({ where: { ownerId: T.id }, orderBy: { createdAt: "asc" } });
  check("DB: hai FileAsset 'ready' của cô Lan, thuộc đúng lớp, chưa gắn bài", before.length === 2 && before.every(a => a.status === "ready" && a.courseId === course.id && a.kind === "document" && !a.lessonId), before.map(a => [a.originalName, a.status, a.lessonId]));

  // thêm bài (chưa có id) + lưu → bài mới có đủ tệp
  await pg.getByPlaceholder(/Buổi 1: Hệ phương trình/).fill("Bài có hai tệp");
  await pg.getByRole("button", { name: /^Lưu$/ }).first().click();
  let lesson: Awaited<ReturnType<typeof prisma.lesson.findFirst>> = null;
  for (let k = 0; k < 40 && !lesson; k++) { await sleep(500); lesson = await prisma.lesson.findFirst({ where: { title: "Bài có hai tệp" } }); }
  const ids = (lesson?.documents ?? "").match(/\/api\/media\/([A-Za-z0-9_-]+)\/file/g) ?? [];
  check("thêm bài MỚI + thả tệp + Lưu → bài trong DB có 2 tài liệu dạng /api/media/<mã>/file", !!lesson && ids.length === 2, lesson?.documents);
  let linked = 0;
  for (let k = 0; k < 20 && linked < 2; k++) { await sleep(500); linked = await prisma.fileAsset.count({ where: { ownerId: T.id, lessonId: lesson?.id ?? "x" } }); }
  check("máy chủ gắn cả hai FileAsset vào bài lúc lưu (lessonId)", linked === 2, linked);
  check("lưu xong KHÔNG có yêu cầu DELETE tệp (không dọn nhầm tệp đã dùng)", net.del.length === 0, net.del);
  // mở lại bài → còn tệp
  await pg.reload({ waitUntil: "domcontentloaded" });
  await pg.getByText("Bài có hai tệp").first().waitFor({ timeout: 120000 });
  await pg.getByRole("button", { name: "Chi tiết bài Bài có hai tệp" }).click();
  await pg.locator("[data-tai-lieu]").first().waitFor({ timeout: 60000 });
  await pg.locator("[data-tai-lieu-hang]").nth(1).waitFor({ timeout: 30000 });
  check("lưu bài rồi MỞ LẠI → vẫn thấy 2 hàng tài liệu", (await pg.locator("[data-tai-lieu-hang]").count()) === 2);
  // lưu đường link cũ không mất: tệp tải lên vẫn mở được cho chủ (đường file có kiểm quyền)
  const fileResp = await pg.evaluate(`fetch("/api/media/${before[0].id}/file", { credentials: "same-origin" }).then(r => r.status)`) as number;
  check("chủ lớp mở được tệp vừa tải qua /api/media/<mã>/file (200)", fileResp === 200, fileResp);
  await pg.getByRole("button", { name: "Đóng", exact: true }).first().click();

  // ── 2. 31 tệp ──────────────────────────────────────────────────────────────────────────────────────
  section("2. 31 tệp một lúc → 'Mỗi bài tối đa 30 tài liệu.', không mạng");
  const pg2 = await ctx.newPage(); watch(pg2);
  const net2 = track(pg2);
  await openDrawer(pg2);
  await pg2.locator("[data-tai-lieu-cam-ket]").check();
  await drop(pg2, Array.from({ length: 31 }, (_, i) => f(`tep-${i}.txt`, "text/plain", TXT)));
  await pg2.getByText("Mỗi bài tối đa 30 tài liệu.").first().waitFor({ timeout: 10000 });
  await sleep(800);
  check("31 tệp → lời 'Mỗi bài tối đa 30 tài liệu.', không hàng đợi, KHÔNG yêu cầu mạng", (await pg2.locator("[data-tai-lieu-tep]").count()) === 0 && net2.init === 0 && net2.put === 0, net2);
  await pg2.close();

  // ── 3. Kho tắt (ép cấu hình) ───────────────────────────────────────────────────────────────────────
  section("3. /api/media/config trả document.enabled=false → 'Kho tệp chưa bật — chủ cần cấu hình.', khung thả khoá, không còn ô dán link (LOI-02)");
  const REASON = "Tải tệp tài liệu lên chưa bật (kho chưa cấu hình). Hãy dán link Google Drive hoặc link tài liệu.";
  const pg3 = await ctx.newPage(); watch(pg3);
  const net3 = track(pg3);
  await pg3.route("**/api/media/config", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    video: { enabled: false, driver: "none", maxBytes: 0, reason: "tắt" },
    document: { enabled: false, driver: "none", maxBytes: 20971520, reason: REASON, exts: ["pdf"], quotaBytes: 0, usedBytes: 0 },
  }) }));
  await openDrawer(pg3);
  check("khung = 'tat' và KHÔNG có ô chọn tệp", (await pg3.locator('[data-o-tha="tat"]').count()) === 1 && (await pg3.locator('[data-tai-lieu] input[type=file]').count()) === 0);
  const offTxt = await pg3.locator("[data-o-tha-ly-do]").innerText();
  check("hiện 'Kho tệp chưa bật — chủ cần cấu hình.' (KHÔNG hiện lý do máy chủ bảo dán link Drive)", offTxt.trim() === "Kho tệp chưa bật — chủ cần cấu hình." && !(await drawer(pg3).innerText()).includes(REASON), offTxt);
  check("kho tắt: không còn ô dán link Drive (LOI-02)", (await pg3.getByPlaceholder(/Dán link Google Drive/).count()) === 0);
  await drop(pg3, [f("de-cuong.pdf", "application/pdf", PDF)]);
  await sleep(600);
  check("kho tắt: thả tệp không gọi mạng", net3.init === 0 && net3.put === 0, net3);
  await pg3.close();

  // ── 4. Kho báo lỗi ở init (403) và kiểm kho lỗi ────────────────────────────────────────────────────
  section("4. init trả 403 → chữ lỗi tại hàng; kiểm kho lỗi → 'Thử lại'");
  const pg4 = await ctx.newPage(); watch(pg4);
  await pg4.route("**/api/media/document/init", r => r.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Bạn không có quyền với lớp này." }) }));
  await openDrawer(pg4);
  await pg4.locator("[data-tai-lieu-cam-ket]").check();
  await drop(pg4, [f("de-cuong.pdf", "application/pdf", PDF)]);
  await pg4.locator("[data-tai-lieu-loi-tep]").first().waitFor({ timeout: 15000 });
  check("init 403 → hàng báo đúng chữ lỗi của máy chủ, không có hàng tài liệu", (await pg4.locator("[data-tai-lieu-loi-tep]").first().innerText()).includes("Bạn không có quyền với lớp này.") && (await pg4.locator("[data-tai-lieu-hang]").count()) === 0);
  check("hàng lỗi có nút 'Đóng' ≥ 44px", await pg4.getByRole("button", { name: /^Đóng thông báo về de-cuong\.pdf/ }).evaluate(e => e.getBoundingClientRect().height >= 43.5));
  await pg4.close();
  const pg4b = await ctx.newPage(); watch(pg4b);
  await pg4b.route("**/api/media/config", r => r.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await pg4b.goto(URL_TAB, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pg4b.getByRole("button", { name: "+ Thêm bài" }).first().click({ timeout: 120000 });
  await pg4b.locator('[data-sua-nhanh="them"]').getByRole("button", { name: "Chi tiết…" }).click();
  await pg4b.locator('[data-o-tha="loi-kiem"]').waitFor({ timeout: 30000 });
  check("kiểm kho lỗi (500) → ô 'loi-kiem' có chữ 'Chưa kiểm được kho tệp.' + nút 'Thử lại'", (await pg4b.locator('[data-o-tha="loi-kiem"]').getByRole("button", { name: "Thử lại" }).count()) === 1 && (await pg4b.locator('[data-o-tha="loi-kiem"]').innerText()).includes("Chưa kiểm được kho tệp."));
  await pg4b.close();

  // ── 5. Đóng ngăn không Lưu → dọn tệp mồ côi ─────────────────────────────────────────────────────────
  section("5. Thả một tệp rồi ĐÓNG ngăn không Lưu → gửi DELETE, FileAsset mồ côi biến mất");
  const pg5 = await ctx.newPage(); watch(pg5);
  const net5 = track(pg5);
  const nAssets0 = await prisma.fileAsset.count({ where: { ownerId: T.id } });
  await openDrawer(pg5);
  await pg5.locator("[data-tai-lieu-cam-ket]").check();
  await drop(pg5, [f("nhap.pdf", "application/pdf", PDF)]);
  await pg5.locator("[data-tai-lieu-hang]").first().waitFor({ timeout: 60000 });
  const nAssets1 = await prisma.fileAsset.count({ where: { ownerId: T.id } });
  check("tệp lên NGAY khi thả (thêm 1 FileAsset trước khi Lưu)", nAssets1 === nAssets0 + 1, [nAssets0, nAssets1]);
  await pg5.getByRole("button", { name: "Huỷ", exact: true }).first().click();
  let gone = false;
  for (let k = 0; k < 30 && !gone; k++) { await sleep(400); gone = (await prisma.fileAsset.count({ where: { ownerId: T.id } })) === nAssets0; }
  check("đóng không Lưu → có yêu cầu DELETE /api/media/document/<mã>", net5.del.length === 1 && /^\/api\/media\/document\/[A-Za-z0-9_-]+$/.test(net5.del[0]), net5.del);
  check("…và FileAsset mồ côi đã bị xoá khỏi DB", gone, await prisma.fileAsset.count({ where: { ownerId: T.id } }));
  await pg5.close();
  await ctx.close();

  // ── 6. Quản trị không phải chủ ────────────────────────────────────────────────────────────────────
  // Ngăn của /admin/khoa-hoc/<id> do phòng Quản trị giữ (bản gốc, KHÔNG có khung thả: còn dòng "sắp có"); khung 'khong-chu' của DocumentsEditor chỉ
  // dựng được khi canUpload=false mà trang gia sư không mở được cho quản trị (redirectIfNotTutor). Nên ca này kiểm hai điều còn đúng: quản trị
  // KHÔNG có đường tải tệp lên KiN (không vùng thả, không gọi init / config) và vẫn dán link được.
  section("6. Quản trị (không phải chủ lớp): /admin/khoa-hoc/<id> không có vùng thả tệp, không gọi kho tệp, vẫn dán link");
  const ca = await ctxFor(SA, { width: 1280, height: 900 });
  const pa = await ca.newPage(); watch(pa);
  const neta = track(pa);
  await pa.goto(`${ADMIN}/admin/khoa-hoc/${course.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pa.getByRole("button", { name: /Chương bài/ }).first().click({ timeout: 120000 }).catch(() => {});
  await pa.getByRole("button", { name: /\+ Thêm bài học/ }).first().click({ timeout: 120000 });
  await pa.getByText("Tài liệu đính kèm").first().waitFor({ timeout: 60000 });
  check("quản trị: KHÔNG có vùng thả / ô chọn tệp tài liệu, KHÔNG gọi /api/media/config hay init", (await pa.locator("[data-tai-lieu-tha], [data-o-tha]").count()) === 0 && (await pa.locator('input[type=file]').count()) === 0 && neta.init === 0);
  check("quản trị: vẫn có ô dán link", (await pa.getByPlaceholder(/paste link Google Drive/i).count()) === 1);
  await ca.close();

  // ── 7. 390 / 320: không tràn ngang khi hàng đợi đang hiện ────────────────────────────────────────────
  for (const [W, H] of [[390, 844], [320, 700]] as const) {
    section(`7. ${W}px: ngăn kéo có hàng đợi, không tràn ngang, nút ≥ 44px`);
    const cm = await ctxFor(T, { width: W, height: H, rail: "mac-dinh" });
    const pm = await cm.newPage(); watch(pm);
    await pm.route("**/api/media/upload/*", async r => { await sleep(2500); await r.continue(); });
    await openDrawer(pm);
    await pm.locator("[data-tai-lieu-cam-ket]").check();
    await drop(pm, [f("mot-cai-ten-tep-rat-dai-de-thu-xem-co-tran-ngang-hay-khong-tren-man-hinh-nho.pdf", "application/pdf", PDF), f("so-do.png", "image/png", PNG), f("bai-giang.mp4", "video/mp4", [0, 0, 0, 24])]);
    await pm.locator("[data-tai-lieu-tep]").first().waitFor({ timeout: 15000 });
    check(`${W}px: hàng đợi (đang tải + lỗi mp4) không tràn ngang`, await noOverflow(pm));
    const tiny = await pm.evaluate(`[...document.querySelectorAll("[data-tai-lieu] button, [data-tai-lieu] label")].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5).map(e => (e.textContent||"").trim().slice(0,20) + ":" + Math.round(e.getBoundingClientRect().height))`) as string[];
    check(`${W}px: nút / ô trong khung tài liệu ≥ 44px`, tiny.length === 0, tiny);
    await pm.screenshot({ path: `${process.env.SHOTS ?? "scratchpad/shots"}/gs-lop-gon-tha-${W}.png` });
    await pm.unroute("**/api/media/upload/*").catch(() => {});
    await pm.close(); await cm.close();
  }

  check("không lỗi JS / console", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(e => { console.error(e); process.exit(1); });
