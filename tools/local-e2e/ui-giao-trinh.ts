// BU-02 — màn Giáo trình của gia sư (/lop-cua-toi/quan-lop/<id>/giao-trinh) + "Xem như học sinh", trên trình duyệt thật (1280 + 390, có chụp ảnh).
// Figma: chưa đối chiếu (606:5, 607:218, 607:491) — bài này kiểm hành vi và số đo, không kiểm giống bản vẽ.
// Kiểm: ba trạng thái (tải / lỗi giả lập 500 / lớp rỗng), giới hạn hiện TRƯỚC khi chọn, dán link nhận diện NGAY (chip), link độc báo lỗi tại chỗ và không có yêu cầu mạng,
// thả PDF thật → thanh tiến trình → mục xuất hiện và F5 vẫn còn (DB có FileAsset ready + lessonId), thả .exe → lỗi tại chỗ, không init; cờ video tắt/bật (chặn G1 để đổi cờ),
// gỡ có hộp xác nhận KiN + Hoàn tác, "Xem như học sinh" hai góc nhìn và KHÔNG có yêu cầu /api/progress, gia sư chờ duyệt → /lop-cua-toi/cho-duyet, gia sư lớp khác bị từ chối,
// lớp không có → "Không tìm thấy lớp này", 390px không tràn ngang và nút >= 44px. Cần Postgres + Next dev (xem README).
import { BASE, mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

// Cỡ nút: mọi button / link-dạng-nút đang hiện phải cao >= 44px (ô tick/radio không tính: nhãn bao ngoài là vùng bấm). Chuỗi mã, không phải hàm (tsx chèn __name()).
async function report(page: Page) {
  // Ẩn lớp phủ dev của Next / công cụ chú thích; nút × của KinToast dùng chung (có sẵn) cũng loại.
  await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-agentation-root] { display: none !important; }" });
  return page.evaluate(`(() => {
    var vis = function (e) { var r = e.getBoundingClientRect(); var st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
    var small = Array.prototype.slice.call(document.querySelectorAll('button, summary, a[class*="kin-cham-toi-thieu"], a[data-kin-nut]'))
      .filter(function (e) { return vis(e) && !e.closest('[data-kin-toast],nextjs-portal,[data-nextjs-toast],[data-agentation-root]') && !e.disabled && !/^Mở rộng thanh bên/.test(e.getAttribute('aria-label') || e.textContent || '') && e.getBoundingClientRect().height < 43.5; })
      .map(function (e) { return e.tagName + ":" + (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30) + ":" + Math.round(e.getBoundingClientRect().height); });
    return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1, small: small };
  })()`) as Promise<{ overflow: boolean; small: string[] }>;
}

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const EXE = Buffer.from("MZ\x90\x00\x03\x00\x00\x00");

const seen: Page[] = [];
(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác");
  const S = await mkUser({ name: "Em Mai" });
  const PEND = await mkUser({ name: "Người nộp đơn" });
  await prisma.user.update({ where: { id: PEND.id }, data: { tutorAppliedAt: new Date() } });

  const A = await mkCourse(T.id, { name: "Toán 9 Giáo trình" });
  const B = await mkCourse(T.id, { name: "Lớp trống chưa có bài" });
  const C = await mkCourse(T2.id, { name: "Lớp riêng của cô khác" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const sec = await prisma.section.create({ data: { id: "gt-s", title: "Phần Đại số", order: 1, courseId: A.id } });
  const ch = await prisma.chapter.create({ data: { id: "gt-c", title: "Chương Hàm số", order: 1, sectionId: sec.id } });
  const les = (id: string, title: string, order: number, o: Record<string, unknown>) => prisma.lesson.create({ data: { id, code: id, title, type: "record", order, chapterId: ch.id, ...o } as any });
  await les("gt-l1", "Hàm số bậc nhất", 1, {
    videoUrl: "https://youtu.be/abcdefghijk", zoomUrl: "https://us02web.zoom.us/j/81234567890?pwd=AbC", azotaUrl: "https://azota.vn/de-thi/abc123",
    documents: JSON.stringify([{ name: "Đề cương chương 1.pdf", url: "https://files.example/de-cuong.pdf", type: "pdf" }]), duration: "45 phút", isLocked: false,
  });
  await les("gt-l2", "Phương trình bậc hai", 2, {});
  const secC = await prisma.section.create({ data: { id: "gt-sc", title: "Phần của cô khác", order: 1, courseId: C.id } });
  const chC = await prisma.chapter.create({ data: { id: "gt-cc", title: "Chương riêng", order: 1, sectionId: secC.id } });
  await prisma.lesson.create({ data: { id: "gt-lc", code: "gt-lc", title: "Bài bí mật của lớp khác", type: "record", order: 1, chapterId: chC.id } as any });

  await launch();
  const errors: string[] = [];
  // 'Encountered a script tag': <script> chủ đề trong src/app/layout.tsx (có sẵn trên main, lỗi React 19, không thuộc BU-02) — nợ riêng, lọc có chủ đích.
  const watch = (p: Page) => { seen.push(p); p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|Encountered a script tag/i.test(m.text())) errors.push(m.text()); }); };
  const G = (id: string) => `${BASE}/lop-cua-toi/quan-lop/${id}/giao-trinh`;
  const g1 = "**/api/tutor/lop/*/giao-trinh";
  /** Đổi cờ video trong câu trả lời G1 (cờ thật nằm ở biến môi trường máy chủ; bài này kiểm cả hai nhánh giao diện). */
  async function forceVideo(p: Page, enabled: boolean) {
    await p.route(g1, async route => {
      const res = await route.fetch(); const j = await res.json();
      j.config.video.enabled = enabled; j.config.video.reason = enabled ? null : "Tải video lên chưa được bật.";
      await route.fulfill({ response: res, json: j });
    });
  }

  // ───────── 1280px
  section("Giáo trình — máy tính 1280px");
  const dctx = await ctxFor(T, { width: 1280, height: 900 });
  const progress: string[] = []; dctx.on("request", r => { if (/\/api\/(progress|lesson-notes)/.test(r.url())) progress.push(r.url()); });
  const pg = await dctx.newPage(); watch(pg);
  const initCalls: string[] = []; pg.on("request", r => { if (/\/api\/media\/(document|video)\/init/.test(r.url())) initCalls.push(r.url()); });
  await pg.goto(G(A.id), { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Giáo trình", level: 1 }).waitFor({ timeout: 90000 });
  await pg.locator("[data-gt-cay]").waitFor({ timeout: 60000 });
  check("một h1; cây có đủ hai bài, bài đầu đang mở", await pg.getByRole("heading", { level: 1 }).count() === 1 && await pg.locator("[data-gt-cay]").getByText("Hàm số bậc nhất").isVisible() && await pg.locator("[data-gt-cay]").getByText("Phương trình bậc hai").isVisible()
    && (await pg.locator("[data-gt-cay] button[aria-current]").innerText()).includes("Hàm số bậc nhất"));
  const lim = await pg.locator("[data-gt-gioi-han]").innerText();
  check("giới hạn hiện TRƯỚC khi chọn: tối đa 25 MB mỗi tệp, còn ... trong kho, video là link", /tối đa 25 MB mỗi tệp/.test(lim) && /còn .* trong kho của bạn/.test(lim) && /Video/.test(lim), lim);
  const groups = (await pg.locator("#gt-muc").locator("xpath=ancestor::section").innerText()).replace(/\s+/g, " ");
  check("mục của bài đang mở gom theo kiểu: Video 1 · Tài liệu 1 · Bài tập/Azota 1 · Buổi live 1", /Video · 1/.test(groups) && /Tài liệu · 1/.test(groups) && /Bài tập\/Azota · 1/.test(groups) && /Buổi live · 1/.test(groups), groups);
  const r0 = await report(pg);
  check("không tràn ngang; nút trong cây và hàng mục >= 44px", !r0.overflow && r0.small.length === 0, r0);
  await shot(pg, "giao-trinh-1280");

  section("Dán link: nhận diện ngay, link độc báo lỗi tại chỗ");
  await pg.locator("#gt-link").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  check("chip 'Nhận diện: YouTube · sẽ thêm vào Video' hiện ngay, chưa gửi gì", await pg.locator("[data-gt-nhan-dien]").getByText(/Nhận diện: YouTube · sẽ thêm vào Video/).isVisible());
  await pg.locator("#gt-link").fill("javascript:alert(1)");
  check("javascript: → lỗi đỏ role=alert, nút Thêm link khoá", await pg.locator("[data-gt-nhan-dien] [role=alert]").isVisible() && await pg.getByRole("button", { name: "Thêm link" }).isDisabled());
  await pg.locator("#gt-link").fill("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ");
  check("youtube.com.evil.example không được nhận diện là YouTube", !(await pg.locator("[data-gt-nhan-dien]").innerText()).includes("Nhận diện: YouTube"));
  await pg.locator("#gt-link").fill("https://meet.google.com/abc-defg-hij");
  check("Google Meet → chip 'Buổi live'", await pg.locator("[data-gt-nhan-dien]").getByText(/sẽ thêm vào Buổi live/).isVisible());
  await pg.locator("#gt-link").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await pg.getByRole("button", { name: "Thêm link" }).click();
  await pg.locator("[data-gt-da-them]").getByText(/Đã thêm .* vào Hàm số bậc nhất/).waitFor({ timeout: 30000 });
  await eventually("DB: videoUrl của bài có thêm link mới", async () => ((await prisma.lesson.findUnique({ where: { id: "gt-l1" } }))?.videoUrl ?? "").includes("dQw4w9WgXcQ"));
  check("ô nhập được xoá sau khi thêm", (await pg.locator("#gt-link").inputValue()) === "");

  section("Hoàn tác = gỡ qua G3");
  await pg.getByRole("button", { name: "Hoàn tác" }).click();
  await eventually("hoàn tác: DB không còn link vừa thêm", async () => !((await prisma.lesson.findUnique({ where: { id: "gt-l1" } }))?.videoUrl ?? "").includes("dQw4w9WgXcQ"));

  section("Thả tệp: cam kết bản quyền, .exe, PDF thật");
  const fileInput = pg.locator('input[type=file]');
  const before = initCalls.length;
  await fileInput.setInputFiles({ name: "de-cuong.pdf", mimeType: "application/pdf", buffer: PDF });
  check("chưa tích cam kết bản quyền → báo lỗi tại chỗ, không có yêu cầu init", await pg.locator("[data-gt-loi]").getByText(/cam kết bản quyền/).isVisible() && initCalls.length === before);
  await pg.getByLabel(/Tôi là người tạo ra nội dung này/).check();
  await fileInput.setInputFiles({ name: "virus.exe", mimeType: "application/x-msdownload", buffer: EXE });
  check(".exe → lỗi ngay tại chỗ trong hàng đợi và KHÔNG có yêu cầu mạng", await pg.locator('[data-gt-tep="err"]').getByText(/không nhận loại tệp này/).isVisible() && initCalls.length === before, initCalls);
  await pg.locator('[data-gt-tep="err"]').getByRole("button", { name: "Đóng" }).click();
  await fileInput.setInputFiles({ name: "bai-tap-tuan-1.pdf", mimeType: "application/pdf", buffer: PDF });
  await pg.locator("[data-gt-da-them]").getByText(/Đã thêm .*bai-tap-tuan-1.* vào Hàm số bậc nhất/).waitFor({ timeout: 60000 });
  const asset = await prisma.fileAsset.findFirst({ where: { ownerId: T.id, kind: "document", originalName: "bai-tap-tuan-1.pdf" } });
  check("DB: FileAsset document ready, gắn vào bài", asset?.status === "ready" && asset.lessonId === "gt-l1" && (asset.bytes ?? 0) === PDF.length, asset);
  check("Lesson.documents trỏ /api/media/<mã>/file (không phải địa chỉ công khai)", ((await prisma.lesson.findUnique({ where: { id: "gt-l1" } }))?.documents ?? "").includes(`/api/media/${asset?.id}/file`));
  await pg.reload({ waitUntil: "networkidle" });
  await pg.locator("[data-gt-muc]", { hasText: "bai-tap-tuan-1" }).waitFor({ timeout: 60000 });
  check("F5: mục tệp vẫn còn, ghi 'Tệp trên KiN (riêng tư)'", (await pg.locator("[data-gt-muc]", { hasText: "bai-tap-tuan-1" }).innerText()).includes("Tệp trên KiN"));
  await shot(pg, "giao-trinh-1280-sau-tai");

  section("Gỡ mục có hộp xác nhận KiN (không window.confirm)");
  let nativeDialog = false; pg.on("dialog", d => { nativeDialog = true; void d.dismiss(); });
  await pg.locator("[data-gt-muc]", { hasText: "bai-tap-tuan-1" }).getByRole("button", { name: /^Gỡ/ }).click();
  await pg.getByRole("dialog").getByRole("button", { name: "Gỡ khỏi bài" }).click();
  await eventually("DB: tài liệu đã bị gỡ khỏi bài, FileAsset vẫn còn (có thể dùng ở lớp khác)", async () => !((await prisma.lesson.findUnique({ where: { id: "gt-l1" } }))?.documents ?? "").includes(`/api/media/${asset?.id}/file`) && !!(await prisma.fileAsset.findUnique({ where: { id: asset!.id } })));
  check("không dùng hộp thoại gốc của trình duyệt", !nativeDialog);

  section("Cờ video");
  const off = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(off);
  await forceVideo(off, false);
  const offInit: string[] = []; off.on("request", r => { if (/\/api\/media\/video\/init/.test(r.url())) offInit.push(r.url()); });
  await off.goto(G(A.id), { waitUntil: "networkidle", timeout: 120000 });
  await off.locator("[data-gt-o-tai]").waitFor({ timeout: 60000 });
  await off.getByLabel(/Tôi là người tạo ra nội dung này/).check();
  await off.locator("input[type=file]").setInputFiles({ name: "bai-giang.mp4", mimeType: "video/mp4", buffer: Buffer.from("0000ftypmp42") });
  check("cờ TẮT: thả .mp4 → báo lỗi 'Tải video lên chưa bật', không có yêu cầu video/init", await off.locator('[data-gt-tep="err"]').getByText(/Tải video lên chưa bật/).isVisible() && offInit.length === 0);
  check("cờ TẮT: không có ô xác nhận video", await off.locator("[data-gt-video-xac-nhan]").count() === 0);
  const on = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(on);
  await forceVideo(on, true);
  await on.goto(G(A.id), { waitUntil: "networkidle", timeout: 120000 });
  await on.locator("[data-gt-o-tai]").waitFor({ timeout: 60000 });
  check("cờ BẬT: có ô xác nhận video (chữ xác nhận không có hình hay giọng học sinh)", await on.locator("[data-gt-video-xac-nhan]").getByText(/không có hình hay giọng học sinh/).isVisible());
  await on.getByLabel(/Tôi là người tạo ra nội dung này/).check();
  await on.locator("input[type=file]").setInputFiles({ name: "bai-giang.mp4", mimeType: "video/mp4", buffer: Buffer.from("0000ftypmp42") });
  check("cờ BẬT nhưng chưa tích xác nhận video → báo lỗi tại chỗ", await on.locator('[data-gt-tep="err"]').getByText(/xác nhận video/).isVisible());

  section("Xem như học sinh: hai góc nhìn, không ghi tiến độ");
  progress.length = 0;
  await pg.getByRole("link", { name: "Xem như học sinh" }).first().click();
  await pg.waitForURL(/\/giao-trinh\/xem\/gt-l1/, { timeout: 60000 });
  await pg.getByText("Đây là bản xem thử. Không ghi tiến độ.").waitFor({ timeout: 60000 });
  check("góc nhìn 'đã vào lớp': thấy video, nút Zoom và Azota, tài liệu", await pg.locator("[data-xem-video]").count() >= 1 && await pg.getByRole("link", { name: "Vào phòng học trực tuyến" }).isVisible() && await pg.getByRole("link", { name: "Mở bài tập" }).isVisible() && await pg.getByText("Đề cương chương 1.pdf").isVisible());
  await pg.getByRole("button", { name: "Người chưa vào lớp" }).click();
  check("góc nhìn 'chưa vào lớp': link ẩn, không video/Zoom/Azota/tài liệu", await pg.getByText("Người chưa vào lớp không thấy nội dung bài này").isVisible() && await pg.locator("[data-xem-video]").count() === 0 && await pg.getByRole("link", { name: "Vào phòng học trực tuyến" }).count() === 0 && await pg.getByText("Đề cương chương 1.pdf").count() === 0);
  await shot(pg, "xem-nhu-hoc-sinh-1280");
  check("KHÔNG có yêu cầu tới /api/progress hay /api/lesson-notes", progress.length === 0, progress);
  await pg.getByRole("link", { name: "← Giáo trình" }).click();
  await pg.waitForURL(/\/giao-trinh$/, { timeout: 60000 });
  const xemBad = await dctx.newPage(); watch(xemBad);
  await xemBad.goto(`${G(B.id)}/xem/gt-l1`, { waitUntil: "networkidle", timeout: 120000 });
  check("mở bài của lớp khác qua đường dẫn lạ → 'Không tìm thấy bài này trong lớp của bạn'", await xemBad.getByText("Không tìm thấy bài này trong lớp của bạn").isVisible());

  section("Lớp rỗng: ô tải phóng lớn, thêm link đầu tiên tự tạo Phần 1 › Chương 1");
  const emp = await dctx.newPage(); watch(emp);
  await emp.goto(G(B.id), { waitUntil: "networkidle", timeout: 120000 });
  await emp.getByText("Lớp chưa có bài nào").waitFor({ timeout: 60000 });
  check("trạng thái rỗng có lời giải thích + ô tải", await emp.getByText(/tự tạo Phần 1 › Chương 1/).first().isVisible());
  await shot(emp, "giao-trinh-rong-1280");
  await emp.locator("#gt-link").fill("https://www.youtube.com/watch?v=aaaaaaaaaaa");
  await emp.getByRole("button", { name: "Thêm link" }).click();
  await emp.locator("[data-gt-da-them], [data-gt-thong-bao]").first().waitFor({ timeout: 60000 });
  await eventually("DB: lớp rỗng có đúng 1 Phần, 1 Chương, 1 Bài chứa link", async () => {
    const secs = await prisma.section.findMany({ where: { courseId: B.id }, include: { chapters: { include: { lessons: true } } } });
    return secs.length === 1 && secs[0].chapters.length === 1 && secs[0].chapters[0].lessons.length === 1 && (secs[0].chapters[0].lessons[0].videoUrl ?? "").includes("aaaaaaaaaaa");
  });

  section("Ba trạng thái trang: đang tải / lỗi / thử lại");
  const st = await dctx.newPage(); watch(st);
  await st.route(g1, async r => { await new Promise(res => setTimeout(res, 2500)); await r.continue(); });
  await st.goto(G(A.id), { waitUntil: "commit", timeout: 120000 });
  check("đang tải: khung xương có aria-busy và nhãn 'Đang tải giáo trình'", await st.locator('[aria-busy="true"][aria-label="Đang tải giáo trình"]').waitFor({ timeout: 15000 }).then(() => true).catch(() => false));
  await st.locator("[data-gt-cay]").waitFor({ timeout: 60000 });
  await st.unroute(g1);
  await st.route(g1, r => r.fulfill({ status: 500, json: { error: "x" } }));
  await st.reload({ waitUntil: "networkidle" });
  await st.getByRole("alert").getByText("Chưa tải được giáo trình").first().waitFor({ timeout: 60000 }).catch(() => undefined);
  check("lỗi 500: thẻ lỗi có nút Thử lại và lối về danh sách lớp, không trắng trang", await st.getByRole("button", { name: "Thử lại" }).isVisible() && await st.getByRole("link", { name: "Về danh sách lớp" }).isVisible());
  await st.unroute(g1);
  await st.getByRole("button", { name: "Thử lại" }).click();
  check("bấm Thử lại → giáo trình hiện", await st.locator("[data-gt-cay]").waitFor({ timeout: 60000 }).then(() => true).catch(() => false));

  section("Quyền và cổng gia sư");
  const other = await (await ctxFor(T2, { width: 1280, height: 900 })).newPage(); watch(other);
  await other.goto(G(A.id), { waitUntil: "networkidle", timeout: 120000 });
  await other.getByText("Bạn không có quyền với lớp này.").waitFor({ timeout: 60000 });
  const otherBody = await other.locator("body").innerText();
  check("gia sư lớp khác: thấy 'Bạn không có quyền với lớp này.' và KHÔNG có tên bài hay link của lớp", !otherBody.includes("Hàm số bậc nhất") && !otherBody.includes("Toán 9 Giáo trình") && !otherBody.includes("youtu"));
  await other.goto(G("khong-co-lop-nay"), { waitUntil: "networkidle", timeout: 120000 });
  check("lớp không có → 'Không tìm thấy lớp này.' (HTTP 404 của G1)", await other.getByText("Không tìm thấy lớp này.").isVisible());
  const pend = await (await ctxFor(PEND, { width: 1280, height: 900 })).newPage(); watch(pend);
  await pend.goto(G(A.id), { timeout: 120000 });
  await pend.waitForURL(/\/lop-cua-toi\/cho-duyet/, { timeout: 60000 });
  check("gia sư chờ duyệt → /lop-cua-toi/cho-duyet", /cho-duyet/.test(pend.url()), pend.url());
  const stu = await (await ctxFor(S, { width: 1280, height: 900 })).newPage(); watch(stu);
  await stu.goto(G(A.id), { timeout: 120000 });
  await stu.waitForURL(u => !u.pathname.includes("giao-trinh"), { timeout: 60000 });
  check("học sinh không vào được Giáo trình", !stu.url().includes("giao-trinh"), stu.url());
  const g = await (await ctxFor(null, { width: 1280, height: 900 })).newPage(); watch(g);
  await g.goto(G(A.id), { timeout: 120000 });
  await g.waitForURL(/dang-nhap/, { timeout: 60000 });
  check("khách → đăng nhập", /dang-nhap/.test(g.url()));

  section("Nút 'Giáo trình' ở trang lớp");
  const lop = await dctx.newPage(); watch(lop);
  await lop.goto(`${BASE}/lop-cua-toi/${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
  const btn = lop.getByRole("link", { name: "Giáo trình", exact: true });
  await btn.first().waitFor({ timeout: 60000 });
  check("nút Giáo trình trỏ đúng đường gia sư", (await btn.first().getAttribute("href"))?.endsWith(`/lop-cua-toi/quan-lop/${A.id}/giao-trinh`) === true, await btn.first().getAttribute("href"));
  await btn.first().click();
  await lop.waitForURL(/\/giao-trinh$/, { timeout: 60000 });
  check("bấm nút → vào Giáo trình", await lop.getByRole("heading", { name: "Giáo trình", level: 1 }).waitFor({ timeout: 60000 }).then(() => true).catch(() => false));

  // ───────── 390px
  section("Điện thoại 390px: một cột, hai nút lớn, không tràn ngang, nút >= 44px");
  const mctx = await ctxFor(T, { width: 390, height: 844 });
  const mp = await mctx.newPage(); watch(mp);
  await mp.goto(G(A.id), { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("heading", { name: "Giáo trình", level: 1 }).waitFor({ timeout: 90000 });
  check("có nút 'Chọn bài' (cây nằm trong tờ mở ra), 'Chọn tệp từ máy' và 'Dán link' to", await mp.getByRole("button", { name: /^Chọn bài/ }).isVisible() && await mp.getByRole("button", { name: "Chọn tệp từ máy" }).isVisible() && await mp.getByRole("button", { name: "Dán link", exact: true }).isVisible());
  check("cây bài ẩn khi chưa bấm Chọn bài", !(await mp.locator("[data-gt-cay]").isVisible()));
  await mp.getByRole("button", { name: /^Chọn bài/ }).click();
  check("bấm Chọn bài → cây hiện, có ▲▼ 44px", await mp.locator("[data-gt-cay]").isVisible());
  const r1 = await report(mp);
  check("390 giáo trình: không tràn ngang, nút >= 44px", !r1.overflow && r1.small.length === 0, r1);
  await shot(mp, "giao-trinh-390");
  await mp.getByRole("button", { name: /^Đóng danh sách bài/ }).click({ force: true, timeout: 10000 }).catch(() => undefined);
  const mxem = await mctx.newPage(); watch(mxem);
  await mxem.goto(`${G(A.id)}/xem/gt-l1`, { waitUntil: "networkidle", timeout: 120000 });
  await mxem.getByText("Đây là bản xem thử. Không ghi tiến độ.").waitFor({ timeout: 60000 });
  const r2 = await report(mxem);
  check("390 xem như học sinh: không tràn ngang, nút >= 44px", !r2.overflow && r2.small.length === 0, r2);
  await shot(mxem, "xem-nhu-hoc-sinh-390");
  const memp = await mctx.newPage(); watch(memp);
  await memp.goto(G(C.id), { waitUntil: "networkidle", timeout: 120000 });
  const r3 = await report(memp);
  check("390 thẻ từ chối quyền: không tràn ngang, nút >= 44px", !r3.overflow && r3.small.length === 0, r3);

  check("không có lỗi console/pageerror (đã lọc lỗi chủ đề có sẵn)", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(async (e) => {
  // Báo rõ bước nào hết giờ (dòng đầu của lỗi Playwright có selector/hành động) thay vì chỉ "TimeoutError".
  for (const p of seen.slice(-2)) {
    try { console.log("  · trang cuối:", p.url(), "| h1:", JSON.stringify(await p.locator("h1").allInnerTexts()), "| thân:", (await p.locator("body").innerText({ timeout: 3000 })).replace(/\s+/g, " ").slice(0, 400)); } catch { /* trang đã đóng */ }
  }
  console.log("  ✗ DỪNG GIỮA CHỪNG:", String((e && e.message) || e).split("\n").slice(0, 8).join(" | "));
  await closeAll().catch(() => undefined);
  process.exit(1);
});
