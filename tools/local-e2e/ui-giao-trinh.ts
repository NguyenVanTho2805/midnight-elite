// BU-02-PHẲNG — màn Giáo trình của gia sư (/lop-cua-toi/quan-lop/<id>/giao-trinh) + "Xem như học sinh", trên trình duyệt thật (1280 + 390, có chụp ảnh).
// Figma: chưa đọc trực tiếp (606:5, 607:218, 607:491) — bài này kiểm hành vi và số đo theo mục 5/6/8.3 của dac-ta/BU-02-PHANG.md, không kiểm giống bản vẽ.
// Kiểm: ba trạng thái (tải / lỗi giả lập 500 / lớp rỗng), lớp rỗng dán link YouTube ⇒ MỘT mục Nháp và KHÔNG có chữ Phần/Chương, Đăng → Ẩn → Hiện lại → Đưa về Nháp, "Đăng ngay",
// KHÔNG có giao diện tải video (không ô xác nhận video, không đuôi video trong accept; thả .mp4 ⇒ lỗi tại chỗ, không có yêu cầu mạng; Vimeo ⇒ lỗi "chỉ nhận link YouTube"),
// thả 3 PDF ⇒ 3 hàng "Đang tải" rồi 3 mục Nháp và F5 vẫn còn, Thêm chương / chuyển nhóm / Bỏ nhóm (mục không mất), ▲▼ đổi thứ tự (>= 44px, tên truy cập rõ, F5 giữ),
// lọc theo trạng thái, Đăng tất cả mục Nháp, ngăn kéo Sửa (tên / khoá / miễn phí, Esc), Đăng mục miễn phí hỏi xác nhận bằng hộp KiN, mục rỗng không đăng được (có lý do),
// lỗi 409 hiện tại hàng, Nhân bản = bản Nháp, Xoá có hộp KiN, "Xem như học sinh" mục Nháp có băng cam + KHÔNG có yêu cầu /api/progress, gia sư chờ duyệt → /lop-cua-toi/cho-duyet,
// gia sư lớp khác chỉ thấy "Bạn không có quyền với lớp này.", 390px không tràn ngang và nút >= 44px. Cần Postgres + Next dev (xem README).
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
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const seen: Page[] = [];
(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác");
  const S = await mkUser({ name: "Em Mai" });
  const PEND = await mkUser({ name: "Người nộp đơn" });
  await prisma.user.update({ where: { id: PEND.id }, data: { tutorAppliedAt: new Date() } });

  // Lớp A: cây CŨ nhiều tầng (Phần Đại số › Chương Hàm số) với đủ ba trạng thái ⇒ hiện thành MỘT nhóm, không mục nào mất.
  const A = await mkCourse(T.id, { name: "Toán 9 Giáo trình" });
  const B = await mkCourse(T.id, { name: "Lớp trống chưa có mục" });
  const C = await mkCourse(T2.id, { name: "Lớp riêng của cô khác" });
  // Lớp D: cây "chung" (Phần 1 › Chương 1) ⇒ danh sách phẳng, không nhóm.
  const D = await mkCourse(T.id, { name: "Lớp phẳng" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const sec = await prisma.section.create({ data: { id: "gt-s", title: "Phần Đại số", order: 1, courseId: A.id } });
  const ch = await prisma.chapter.create({ data: { id: "gt-c", title: "Chương Hàm số", order: 1, sectionId: sec.id } });
  const les = (cid: string) => (id: string, title: string, order: number, o: Record<string, unknown>) =>
    prisma.lesson.create({ data: { id, code: id, title, type: "record", order, chapterId: cid, ...o } as any });
  const la = les(ch.id);
  const DOC = (name: string) => JSON.stringify([{ name, url: `https://files.example/${encodeURIComponent(name)}.pdf`, type: "pdf" }]);
  await la("gt-l1", "Hàm số bậc nhất", 1, {
    videoUrl: "https://youtu.be/abcdefghijk", zoomUrl: "https://us02web.zoom.us/j/81234567890?pwd=AbC", azotaUrl: "https://azota.vn/de-thi/abc123",
    documents: DOC("Đề cương chương 1"), duration: "45 phút", isLocked: false, status: "published",
  });
  await la("gt-l2", "Phương trình bậc hai", 2, { status: "published" });
  await la("gt-l3", "Bài soạn dở", 3, { status: "draft", videoUrl: "https://youtu.be/draftdraft1" });
  await la("gt-l4", "Bài đã ẩn", 4, { status: "hidden", documents: DOC("Phiếu ẩn") });
  const secD = await prisma.section.create({ data: { id: "d-s", title: "Phần 1", order: 1, courseId: D.id } });
  const chD = await prisma.chapter.create({ data: { id: "d-c", title: "Chương 1", order: 1, sectionId: secD.id } });
  const ld = les(chD.id);
  await ld("d-l1", "Mục một", 1, { status: "published", documents: DOC("Một") });
  await ld("d-l2", "Mục hai", 2, { status: "published", documents: DOC("Hai") });
  await ld("d-l3", "Mục ba nháp", 3, { status: "draft", documents: DOC("Ba") });
  await ld("d-l4", "Mục bốn miễn phí", 4, { status: "draft", isFree: true, documents: DOC("Bốn") });
  await ld("d-l5", "Mục rỗng", 5, { status: "draft", type: "document" });
  const secC = await prisma.section.create({ data: { id: "gt-sc", title: "Phần của cô khác", order: 1, courseId: C.id } });
  const chC = await prisma.chapter.create({ data: { id: "gt-cc", title: "Chương riêng", order: 1, sectionId: secC.id } });
  await prisma.lesson.create({ data: { id: "gt-lc", code: "gt-lc", title: "Bài bí mật của lớp khác", type: "record", order: 1, chapterId: chC.id } as any });

  await launch();
  const errors: string[] = [];
  // 'Encountered a script tag': <script> chủ đề trong src/app/layout.tsx (có sẵn trên main, lỗi React 19, không thuộc BU-02) — nợ riêng, lọc có chủ đích.
  const watch = (p: Page) => { seen.push(p); p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|Encountered a script tag/i.test(m.text())) errors.push(m.text()); }); };
  const G = (id: string) => `${BASE}/lop-cua-toi/quan-lop/${id}/giao-trinh`;
  const g1 = "**/api/tutor/lop/*/giao-trinh";
  const row = (p: Page, id: string) => p.locator(`[data-gt-muc][data-gt-id="${id}"]`);
  const chip = async (p: Page, id: string) => await row(p, id).locator("[data-gt-chip-trang-thai]").getAttribute("data-gt-chip-trang-thai");
  const ids = async (p: Page) => await p.locator("[data-gt-muc]").evaluateAll(els => els.map(e => e.getAttribute("data-gt-id")));
  const statusOf = async (id: string) => (await prisma.lesson.findUnique({ where: { id } }))?.status;
  const open = async (p: Page, courseId: string) => {
    await p.goto(G(courseId), { waitUntil: "networkidle", timeout: 120000 });
    await p.locator('nav[aria-label^="Trang của"] [aria-current="page"]', { hasText: "Giáo trình" }).waitFor({ timeout: 90000 }); // GS-LOP-GON: h1 là TÊN LỚP (đầu lớp một lần); tab Giáo trình sáng thay cho h1 "Giáo trình"
    await p.locator("[data-gt-o-tai]").waitFor({ timeout: 60000 });
  };

  // ───────── 1280px
  section("Giáo trình — máy tính 1280px: lớp cây cũ hiện thành nhóm, đủ ba trạng thái");
  const dctx = await ctxFor(T, { width: 1280, height: 900 });
  const progress: string[] = []; dctx.on("request", r => { if (/\/api\/(progress|lesson-notes)/.test(r.url())) progress.push(r.url()); });
  const pg = await dctx.newPage(); watch(pg);
  const initCalls: string[] = []; pg.on("request", r => { if (/\/api\/media\/(document|video)\/init/.test(r.url())) initCalls.push(r.url()); });
  await open(pg, A.id);
  check("một h1; 4 mục trong một danh sách, KHÔNG có cây ba cột", await pg.getByRole("heading", { level: 1 }).count() === 1 && await pg.locator("[data-gt-muc]").count() === 4 && await pg.locator("[data-gt-cay]").count() === 0);
  check("cây cũ nhiều tầng thành MỘT nhóm, không mục nào mất", await pg.locator("[data-gt-nhom]").count() === 1 && /Hàm số/.test(await pg.locator("[data-gt-nhom]").innerText()) && await pg.locator("[data-gt-nhom] [data-gt-muc]").count() === 4);
  check("chip trạng thái đúng từng mục: Đã đăng · Đã đăng · Nháp · Ẩn", (await chip(pg, "gt-l1")) === "published" && (await chip(pg, "gt-l2")) === "published" && (await chip(pg, "gt-l3")) === "draft" && (await chip(pg, "gt-l4")) === "hidden");
  check("chip kiểu: mục l1 có video ⇒ Video; l4 ⇒ Tài liệu", (await row(pg, "gt-l1").locator("[data-gt-chip-kieu]").innerText()) === "Video" && (await row(pg, "gt-l4").locator("[data-gt-chip-kieu]").innerText()) === "Tài liệu");
  check("chữ trạng thái luôn có (không chỉ chấm màu)", /Đã đăng/.test(await row(pg, "gt-l1").innerText()) && /Nháp/.test(await row(pg, "gt-l3").innerText()) && /Ẩn/.test(await row(pg, "gt-l4").innerText()));
  check("mục đã đăng mà rỗng báo 'đang đăng nhưng chưa có nội dung'", /Mục đang đăng nhưng chưa có nội dung/.test(await row(pg, "gt-l2").innerText()));
  check("dòng nhắc 'Mục Nháp và Ẩn chỉ gia sư thấy'", await pg.locator("[data-gt-nhac-nhap]").getByText(/chỉ gia sư thấy/).isVisible());
  check("dải lọc có số: Nháp 1 · Đã đăng 2 · Ẩn 1", await pg.getByRole("button", { name: "Nháp 1" }).isVisible() && await pg.getByRole("button", { name: "Đã đăng 2" }).isVisible() && await pg.getByRole("button", { name: "Ẩn 1" }).isVisible());
  const lim = await pg.locator("[data-gt-gioi-han]").innerText();
  check("giới hạn hiện TRƯỚC khi chọn: tối đa 25 MB mỗi tệp, còn ... trong kho, video chỉ link YouTube", /tối đa 25 MB mỗi tệp/.test(lim) && /còn .* trong kho của bạn/.test(lim) && /Video: dán link YouTube/.test(lim), lim);
  check("dải nguồn không còn Vimeo", !/Vimeo/.test(await pg.locator("[data-gt-nguon]").innerText()));
  const r0 = await report(pg);
  check("không tràn ngang; mọi nút >= 44px (▲▼, Sửa, Đăng/Ẩn, ⋯)", !r0.overflow && r0.small.length === 0, r0);
  await shot(pg, "giao-trinh-phang-1280");

  section("KHÔNG có giao diện tải video (video chỉ gắn link YouTube)");
  check("không có ô xác nhận video", await pg.locator("[data-gt-video-xac-nhan]").count() === 0);
  const accept = (await pg.locator("input[type=file]").getAttribute("accept")) ?? "";
  check("ô chọn tệp không nhận đuôi video", !/mp4|webm|mov|m4v/i.test(accept), accept);
  const bodyText = await pg.locator("[data-gt-o-tai]").locator("xpath=..").innerText();
  check("không có chữ tải video lên / xác nhận video / 'chưa bật'", !/tải video lên|xác nhận video|chưa bật/i.test(bodyText));

  section("Xem như học sinh: mục Nháp có băng cam, không ghi tiến độ");
  progress.length = 0;
  await row(pg, "gt-l3").getByRole("button", { name: /^Thêm thao tác/ }).click();
  await row(pg, "gt-l3").getByRole("link", { name: "Xem như học sinh" }).click();
  await pg.waitForURL(/\/giao-trinh\/xem\/gt-l3/, { timeout: 60000 });
  await pg.getByText("Đây là bản xem thử. Không ghi tiến độ.").waitFor({ timeout: 60000 });
  check("băng cam: 'Học sinh chưa thấy mục này vì đang ở trạng thái Nháp'", await pg.locator("[data-gt-ban-chua-dang]").getByText(/chưa thấy mục này vì đang ở trạng thái Nháp/).isVisible());
  await pg.getByRole("button", { name: "Người chưa vào lớp" }).click();
  check("góc nhìn 'chưa vào lớp' của mục Nháp: 'Người chưa vào lớp không thấy mục này.' và không có video", await pg.getByText("Người chưa vào lớp không thấy mục này.").isVisible() && await pg.locator("[data-xem-video]").count() === 0);
  await shot(pg, "xem-nhu-hoc-sinh-nhap-1280");
  check("KHÔNG có yêu cầu tới /api/progress hay /api/lesson-notes", progress.length === 0, progress);
  await pg.locator("[data-gt-ban-chua-dang]").getByRole("button", { name: "Đăng mục này" }).click();
  await eventually("nút 'Đăng mục này' trong băng đăng mục (G4): DB published", async () => (await statusOf("gt-l3")) === "published");
  await pg.locator("[data-gt-ban-chua-dang]").waitFor({ state: "detached", timeout: 30000 });
  await pg.getByRole("button", { name: "Học sinh đã vào lớp" }).click();
  check("sau khi đăng: băng cam biến mất; góc nhìn 'đã vào lớp' có video", await pg.locator("[data-xem-video]").count() >= 1);
  await pg.getByRole("link", { name: "← Giáo trình" }).click();
  await pg.waitForURL(/\/giao-trinh$/, { timeout: 60000 });
  const xemBad = await dctx.newPage(); watch(xemBad);
  await xemBad.goto(`${G(B.id)}/xem/gt-l1`, { waitUntil: "networkidle", timeout: 120000 });
  check("mở mục của lớp khác qua đường dẫn lạ → 'Không tìm thấy mục này trong lớp của bạn'", await xemBad.getByText("Không tìm thấy mục này trong lớp của bạn").isVisible());

  section("Lớp rỗng: ô tải phóng lớn, KHÔNG nhắc Phần/Chương");
  const emp = await dctx.newPage(); watch(emp);
  const empInit: string[] = []; emp.on("request", r => { if (/\/api\/media\/(document|video)\/init/.test(r.url())) empInit.push(r.url()); });
  await emp.goto(G(B.id), { waitUntil: "networkidle", timeout: 120000 });
  await emp.getByText("Lớp chưa có mục nào").waitFor({ timeout: 60000 });
  const empBody = await emp.locator("[data-gt-o-tai]").locator("xpath=..").innerText();
  check("trạng thái rỗng có lời giải thích, nói mục mới ở dạng Nháp, không có chữ Phần / Chương", /Mục mới ở dạng Nháp/.test(empBody) && !/Phần|Chương/.test(empBody), empBody);
  await shot(emp, "giao-trinh-phang-rong-1280");

  section("Dán link: nhận diện ngay; video chỉ nhận YouTube");
  await emp.locator("#gt-link").fill("https://www.youtube.com/watch?v=aaaaaaaaaaa");
  check("chip 'Nhận diện: YouTube ✓ · sẽ thêm vào Video' hiện ngay, chưa gửi gì", await emp.locator("[data-gt-nhan-dien]").getByText(/Nhận diện: YouTube ✓ · sẽ thêm vào Video/).isVisible());
  await emp.locator("#gt-link").fill("javascript:alert(1)");
  check("javascript: → lỗi đỏ tại chỗ, nút Thêm link khoá", await emp.locator("[data-gt-nhan-dien-loi]").isVisible() && await emp.getByRole("button", { name: "Thêm link" }).isDisabled());
  await emp.locator("#gt-link").fill("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ");
  check("youtube.com.evil.example không được nhận diện là YouTube", !(await emp.locator("[data-gt-nhan-dien]").innerText()).includes("Nhận diện: YouTube"));
  await emp.locator("#gt-link").fill("https://vimeo.com/123456789");
  check("Vimeo → lỗi 'Video chỉ nhận link YouTube', nút Thêm link khoá", await emp.locator("[data-gt-nhan-dien-loi]").getByText(/Video chỉ nhận link YouTube/).isVisible() && await emp.getByRole("button", { name: "Thêm link" }).isDisabled());
  await emp.locator("#gt-link").fill("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view");
  check("Drive /file/d/ → Tài liệu (không vào Video) kèm cảnh báo", await emp.locator("[data-gt-nhan-dien]").getByText(/sẽ thêm vào Tài liệu/).isVisible());
  await emp.locator("#gt-link").fill("https://www.youtube.com/watch?v=aaaaaaaaaaa");
  await emp.getByRole("button", { name: "Thêm link" }).click();
  await emp.locator("[data-gt-da-them]").getByText(/Đã thêm .* thành mục mới ở dạng Nháp/).waitFor({ timeout: 60000 });
  await eventually("DB: lớp rỗng có đúng MỘT mục, status draft, chứa link", async () => {
    const ls = await prisma.lesson.findMany({ where: { chapter: { section: { courseId: B.id } } } });
    return ls.length === 1 && ls[0].status === "draft" && (ls[0].videoUrl ?? "").includes("aaaaaaaaaaa");
  });
  const b1 = (await prisma.lesson.findMany({ where: { chapter: { section: { courseId: B.id } } } }))[0];
  check("danh sách có 1 hàng Nháp kiểu Video; vùng thêm + danh sách không có chữ Phần/Chương", (await chip(emp, b1.id)) === "draft" && (await row(emp, b1.id).locator("[data-gt-chip-kieu]").innerText()) === "Video"
    && !/Phần|Chương/.test(await emp.locator("#gt-ds").locator("xpath=..").innerText()));
  check("ô nhập được xoá sau khi thêm", (await emp.locator("#gt-link").inputValue()) === "");

  section("Đăng → Ẩn → Hiện lại → Đưa về Nháp (máy trạng thái)");
  await row(emp, b1.id).getByRole("button", { name: /^Đăng mục/ }).click();
  await eventually("Đăng: DB published, chip 'Đã đăng'", async () => (await statusOf(b1.id)) === "published" && (await chip(emp, b1.id)) === "published");
  await row(emp, b1.id).getByRole("button", { name: /^Ẩn mục/ }).click();
  await eventually("Ẩn: DB hidden, chip 'Ẩn', nút đổi thành 'Hiện lại'", async () => (await statusOf(b1.id)) === "hidden" && (await chip(emp, b1.id)) === "hidden" && (await row(emp, b1.id).getByRole("button", { name: /^Hiện lại mục/ }).count()) === 1);
  await row(emp, b1.id).getByRole("button", { name: /^Hiện lại mục/ }).click();
  await eventually("Hiện lại: DB published", async () => (await statusOf(b1.id)) === "published");
  await row(emp, b1.id).getByRole("button", { name: /^Ẩn mục/ }).click();
  await eventually("Ẩn lần hai", async () => (await statusOf(b1.id)) === "hidden");
  await row(emp, b1.id).getByRole("button", { name: /^Thêm thao tác/ }).click();
  await row(emp, b1.id).getByRole("button", { name: "Đưa về Nháp" }).click();
  await eventually("Đưa về Nháp (chỉ từ Ẩn): DB draft", async () => (await statusOf(b1.id)) === "draft" && (await chip(emp, b1.id)) === "draft");

  section("'Đăng ngay' đăng thẳng; lỗi 409 hiện tại hàng");
  check("công tắc 'Đăng ngay cho học sinh' tắt mặc định", !(await emp.locator("[data-gt-dang-ngay]").isChecked()));
  await emp.locator("[data-gt-dang-ngay]").check();
  await emp.locator("#gt-link").fill("https://www.youtube.com/watch?v=bbbbbbbbbbb");
  await emp.getByRole("button", { name: "Thêm link" }).click();
  await emp.locator("[data-gt-da-them]").getByText(/đã đăng cho học sinh/).waitFor({ timeout: 60000 });
  await eventually("DB: mục thứ hai published ngay", async () => (await prisma.lesson.findMany({ where: { chapter: { section: { courseId: B.id } }, videoUrl: { contains: "bbbbbbbbbbb" } } })).every(l => l.status === "published") && (await prisma.lesson.count({ where: { chapter: { section: { courseId: B.id } }, videoUrl: { contains: "bbbbbbbbbbb" } } })) === 1);
  await emp.locator("[data-gt-dang-ngay]").uncheck();
  await emp.route("**/api/tutor/lop/*/giao-trinh/bai/*", r => r.fulfill({ status: 409, json: { error: "Mục chưa có nội dung. Thêm link hoặc tệp rồi đăng." } }));
  await row(emp, b1.id).getByRole("button", { name: /^Đăng mục/ }).click();
  await row(emp, b1.id).locator('[data-gt-ghi-chu-hang="err"]').getByText("Mục chưa có nội dung. Thêm link hoặc tệp rồi đăng.").waitFor({ timeout: 15000 });
  check("409 của G4 hiện nguyên câu máy chủ NGAY tại hàng, mục không đổi", (await statusOf(b1.id)) === "draft");
  await emp.unroute("**/api/tutor/lop/*/giao-trinh/bai/*");

  section("Thả tệp: .mp4 bị từ chối tại chỗ; 3 PDF thành 3 mục Nháp");
  const fileInput = emp.locator("input[type=file]");
  const before = empInit.length;
  await fileInput.setInputFiles({ name: "bai-giang.mp4", mimeType: "video/mp4", buffer: Buffer.from("0000ftypmp42") });
  check("thả .mp4 → lỗi 'KiN không nhận tệp video' ngay trong hàng, KHÔNG có yêu cầu mạng", await emp.locator('[data-gt-tep="err"]').getByText(/KiN không nhận tệp video/).isVisible() && empInit.length === before, empInit);
  await emp.locator('[data-gt-tep="err"]').getByRole("button", { name: /^Đóng/ }).click();
  await fileInput.setInputFiles({ name: "chua-tich.pdf", mimeType: "application/pdf", buffer: PDF });
  check("chưa tích cam kết bản quyền → báo lỗi tại chỗ, không có yêu cầu init", await emp.locator("[data-gt-loi]").getByText(/cam kết bản quyền/).isVisible() && empInit.length === before);
  await emp.getByLabel(/Tôi là người tạo ra nội dung này/).check();
  await fileInput.setInputFiles({ name: "virus.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ\x90\x00\x03\x00\x00\x00") });
  check(".exe → lỗi ngay tại chỗ, KHÔNG có yêu cầu mạng", await emp.locator('[data-gt-tep="err"]').getByText(/không nhận loại tệp này/).isVisible() && empInit.length === before, empInit);
  await emp.locator('[data-gt-tep="err"]').getByRole("button", { name: /^Đóng/ }).click();
  const countBefore = await emp.locator("[data-gt-muc]").count();
  await emp.route("**/api/media/document/init", async r => { await sleep(1500); await r.continue(); });
  await fileInput.setInputFiles([1, 2, 3].map(n => ({ name: `bai-tap-${n}.pdf`, mimeType: "application/pdf", buffer: PDF })));
  await eventually("3 hàng 'Đang tải' hiện cùng lúc (chỉ ở trình duyệt, có nút Huỷ)", async () => (await emp.locator('[data-gt-hang-doi] [data-gt-chip-trang-thai="uploading"]').count()) === 3 && (await emp.getByRole("button", { name: /^Huỷ tải/ }).count()) >= 1, 15000);
  await eventually("DB: thêm đúng 3 mục Nháp, mỗi mục một tài liệu trỏ /api/media/<mã>/file", async () => {
    const ls = await prisma.lesson.findMany({ where: { chapter: { section: { courseId: B.id } }, documents: { contains: "/api/media/" } } });
    return ls.length === 3 && ls.every(l => l.status === "draft");
  }, 60000);
  await emp.unroute("**/api/media/document/init"); // gỡ SAU khi mọi yêu cầu đang trễ đã xong (gỡ sớm ⇒ "Route is already handled")
  await emp.reload({ waitUntil: "networkidle" });
  await emp.locator("[data-gt-muc]").first().waitFor({ timeout: 60000 });
  check("F5: 3 mục mới vẫn còn, ở dạng Nháp", await emp.locator("[data-gt-muc]").count() === countBefore + 3 && await emp.locator('[data-gt-muc][data-gt-trang-thai="draft"]').count() >= 4);
  await shot(emp, "giao-trinh-phang-sau-tai-1280");

  section("Thêm chương = nhóm tuỳ chọn; chuyển nhóm; Bỏ nhóm không mất mục");
  const nB = await prisma.lesson.count({ where: { chapter: { section: { courseId: B.id } } } });
  await emp.getByRole("button", { name: "Thêm chương" }).first().click();
  await emp.locator("#gt-ten-chuong").fill("Hàm số");
  await emp.locator("[data-gt-them-chuong]").getByRole("button", { name: "Thêm chương" }).click();
  await emp.locator("[data-gt-nhom]").waitFor({ timeout: 30000 });
  check("nhóm 'Hàm số' hiện (còn 0 mục); các mục cũ nằm ở 'Chưa nhóm'", /Hàm số/.test(await emp.locator("[data-gt-nhom]").innerText()) && await emp.locator('[data-gt-khoi="chua-nhom"] [data-gt-muc]').count() === nB);
  await row(emp, b1.id).getByRole("button", { name: /^Thêm thao tác/ }).click();
  await row(emp, b1.id).getByLabel("Chuyển nhóm").selectOption({ label: "Hàm số" });
  await eventually("chuyển nhóm: mục nằm trong nhóm Hàm số", async () => (await emp.locator("[data-gt-nhom] [data-gt-muc]").count()) === 1);
  await emp.getByRole("button", { name: "Bỏ nhóm Hàm số" }).click();
  await emp.getByRole("dialog").getByRole("button", { name: "Bỏ nhóm" }).click();
  await eventually("Bỏ nhóm: nhóm biến mất, mục về 'Chưa nhóm', KHÔNG mục nào bị xoá", async () => (await emp.locator("[data-gt-nhom]").count()) === 0 && (await emp.locator("[data-gt-muc]").count()) === nB && (await prisma.lesson.count({ where: { chapter: { section: { courseId: B.id } } } })) === nB);

  // ───────── Lớp phẳng D
  section("Lớp phẳng: ▲▼ đổi thứ tự (>= 44px, tên truy cập rõ, F5 giữ)");
  await open(pg, D.id);
  check("lớp 'chung' (Phần 1 › Chương 1) hiện KHÔNG nhóm và không có tiêu đề nhóm", await pg.locator("[data-gt-nhom]").count() === 0 && await pg.locator("[data-gt-muc]").count() === 5);
  check("mũi tên đầu danh sách khoá ▲, cuối khoá ▼; tên truy cập nói rõ mục nào", await row(pg, "d-l1").getByRole("button", { name: "Đưa mục “Mục một” lên" }).isDisabled() && await row(pg, "d-l5").getByRole("button", { name: "Đưa mục “Mục rỗng” xuống" }).isDisabled());
  await row(pg, "d-l1").getByRole("button", { name: "Đưa mục “Mục một” xuống" }).click();
  await eventually("DB: 'Mục hai' đứng trước 'Mục một'", async () => (await prisma.lesson.findMany({ where: { chapterId: "d-c" }, orderBy: { order: "asc" } })).map(l => l.id).slice(0, 2).join() === "d-l2,d-l1");
  await pg.reload({ waitUntil: "networkidle" });
  await pg.locator("[data-gt-muc]").first().waitFor({ timeout: 60000 });
  check("F5: thứ tự mới được giữ", (await ids(pg)).slice(0, 2).join() === "d-l2,d-l1", await ids(pg));
  const rD = await report(pg);
  check("lớp phẳng: không tràn ngang, nút >= 44px", !rD.overflow && rD.small.length === 0, rD);

  section("Lọc theo trạng thái; Đăng tất cả mục Nháp");
  await pg.getByRole("button", { name: /^Nháp \d/ }).click();
  check("lọc Nháp → chỉ 3 mục Nháp, ▲▼ khoá và có dòng giải thích", await pg.locator("[data-gt-muc]").count() === 3 && await pg.locator('[data-gt-muc]:not([data-gt-trang-thai="draft"])').count() === 0
    && await row(pg, "d-l3").getByRole("button", { name: /Đưa mục .* xuống/ }).isDisabled() && await pg.getByText(/Đang lọc theo trạng thái/).isVisible());
  await pg.getByRole("button", { name: /^Tất cả \d/ }).click();
  check("Tất cả → đủ 5 mục", await pg.locator("[data-gt-muc]").count() === 5);
  check("mục rỗng: nút Đăng khoá kèm lý do (aria-describedby)", await row(pg, "d-l5").getByRole("button", { name: /^Đăng mục/ }).isDisabled() && /Mục chưa có nội dung/.test(await row(pg, "d-l5").locator("[data-gt-ly-do]").innerText()));
  let nativeDialog = false; pg.on("dialog", d => { nativeDialog = true; void d.dismiss(); });
  await row(pg, "d-l4").getByRole("button", { name: /^Đăng mục/ }).click();
  const dlg = pg.getByRole("dialog");
  await dlg.waitFor({ timeout: 15000 });
  check("Đăng mục đang cho học thử miễn phí → hộp xác nhận KiN nhắc người chưa vào lớp cũng sẽ thấy", /học thử miễn phí/.test(await dlg.innerText()));
  await dlg.getByRole("button", { name: "Huỷ" }).click();
  check("Huỷ → mục vẫn Nháp", (await statusOf("d-l4")) === "draft");
  await row(pg, "d-l4").getByRole("button", { name: /^Đăng mục/ }).click();
  await pg.getByRole("dialog").getByRole("button", { name: "Đăng mục này" }).click();
  await eventually("xác nhận → DB published", async () => (await statusOf("d-l4")) === "published");
  const allBtn = pg.getByRole("button", { name: /^Đăng tất cả mục Nháp/ });
  // Đợi giao diện cập nhật số (DB đã published nhưng nút có thể còn hiện số cũ vài trăm ms).
  await eventually("còn 1 mục Nháp đăng được (mục rỗng không tính) ⇒ nút 'Đăng tất cả mục Nháp (1)'", async () => /\(1\)/.test(await allBtn.innerText()), 15000);
  await allBtn.click();
  await eventually("Đăng tất cả: 'Mục ba nháp' published, 'Mục rỗng' vẫn Nháp", async () => (await statusOf("d-l3")) === "published" && (await statusOf("d-l5")) === "draft");
  await allBtn.waitFor({ state: "detached", timeout: 30000 });

  section("Ngăn kéo Sửa: tên / khoá / miễn phí; Esc đóng; Nhân bản = Nháp; Xoá có hộp KiN");
  await row(pg, "d-l2").getByRole("button", { name: "Sửa mục “Mục hai”" }).click();
  const drawer = pg.getByRole("dialog", { name: "Sửa mục" });
  await drawer.waitFor({ timeout: 15000 });
  check("ngăn kéo mở, ô Tên đang giữ tiêu điểm", await drawer.getByLabel("Tên mục").evaluate(el => el === document.activeElement));
  await shot(pg, "giao-trinh-phang-ngan-keo-1280");
  await drawer.getByLabel("Tên mục").fill("Mục hai đã sửa");
  await drawer.getByLabel(/Khoá bài này/).check();
  await drawer.getByLabel(/Cho học thử miễn phí/).check();
  check("chữ 'chỉ có tác dụng khi mục Đã đăng' có trong ngăn kéo", /Chỉ có tác dụng khi mục Đã đăng/.test(await drawer.innerText()));
  await drawer.getByRole("button", { name: "Lưu" }).click();
  await drawer.waitFor({ state: "detached", timeout: 30000 });
  await eventually("DB: tên mới, khoá, miễn phí; trạng thái KHÔNG đổi", async () => { const l = await prisma.lesson.findUnique({ where: { id: "d-l2" } }); return l?.title === "Mục hai đã sửa" && l.isLocked && l.isFree && l.status === "published"; });
  await row(pg, "d-l2").getByRole("button", { name: /^Sửa mục/ }).click();
  await pg.getByRole("dialog", { name: "Sửa mục" }).waitFor({ timeout: 15000 });
  await pg.keyboard.press("Escape");
  check("Esc đóng ngăn kéo", await pg.getByRole("dialog", { name: "Sửa mục" }).count() === 0);
  await row(pg, "d-l1").getByRole("button", { name: /^Thêm thao tác/ }).click();
  await row(pg, "d-l1").getByRole("button", { name: "Nhân bản" }).click();
  await eventually("Nhân bản: có mục '(bản sao)' ở dạng Nháp", async () => (await prisma.lesson.findMany({ where: { chapterId: "d-c", title: { contains: "(bản sao)" } } })).every(l => l.status === "draft") && (await prisma.lesson.count({ where: { chapterId: "d-c", title: { contains: "(bản sao)" } } })) === 1);
  await row(pg, "d-l5").getByRole("button", { name: /^Thêm thao tác/ }).click();
  await row(pg, "d-l5").getByRole("button", { name: "Xoá mục" }).click();
  await pg.getByRole("dialog").getByRole("button", { name: "Xoá mục" }).click();
  await eventually("Xoá: mục biến mất khỏi DB và danh sách", async () => (await prisma.lesson.findUnique({ where: { id: "d-l5" } })) === null && (await row(pg, "d-l5").count()) === 0);
  check("không dùng hộp thoại gốc của trình duyệt", !nativeDialog);

  section("Ba trạng thái trang: đang tải / lỗi / thử lại");
  const st = await dctx.newPage(); watch(st);
  await st.route(g1, async r => { await sleep(2500); await r.continue(); });
  await st.goto(G(D.id), { waitUntil: "commit", timeout: 120000 });
  check("đang tải: khung xương có aria-busy và nhãn 'Đang tải giáo trình'", await st.locator('[aria-busy="true"][aria-label="Đang tải giáo trình"]').waitFor({ timeout: 15000 }).then(() => true).catch(() => false));
  await st.locator("[data-gt-o-tai]").waitFor({ timeout: 60000 });
  await st.unroute(g1);
  await st.route(g1, r => r.fulfill({ status: 500, json: { error: "x" } }));
  await st.reload({ waitUntil: "networkidle" });
  await st.getByText("Chưa tải được giáo trình").first().waitFor({ timeout: 60000 }).catch(() => undefined);
  check("lỗi 500: thẻ lỗi có nút Thử lại và lối về danh sách lớp, không trắng trang", await st.getByRole("button", { name: "Thử lại" }).isVisible() && await st.getByRole("link", { name: "Về danh sách lớp" }).isVisible());
  await st.unroute(g1);
  await st.getByRole("button", { name: "Thử lại" }).click();
  check("bấm Thử lại → danh sách hiện", await st.locator("[data-gt-muc]").first().waitFor({ timeout: 60000 }).then(() => true).catch(() => false));

  section("Quyền và cổng gia sư");
  const other = await (await ctxFor(T2, { width: 1280, height: 900 })).newPage(); watch(other);
  await other.goto(G(A.id), { waitUntil: "networkidle", timeout: 120000 });
  await other.getByText("Bạn không có quyền với lớp này").first().waitFor({ timeout: 60000 });
  const otherBody = await other.locator("body").innerText();
  check("gia sư lớp khác: 'Bạn không có quyền với lớp này' (GS-LOP-GON mục 4.3, bỏ dấu chấm) và KHÔNG có tên mục hay link của lớp", !otherBody.includes("Hàm số bậc nhất") && !otherBody.includes("Toán 9 Giáo trình") && !otherBody.includes("youtu"));
  await other.goto(G("khong-co-lop-nay"), { waitUntil: "networkidle", timeout: 120000 });
  check("lớp không có → màn 'Không tìm thấy lớp' (GS-LOP-GON mục 4.3: 404 tách khỏi 403), KHÔNG lộ tên lớp của người khác", await other.getByText("Không tìm thấy lớp").first().isVisible() && !(await other.locator("body").innerText()).includes("Toán 9 Giáo trình"));
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
  check("bấm nút → vào Giáo trình", await lop.locator('nav[aria-label^="Trang của"] [aria-current="page"]', { hasText: "Giáo trình" }).waitFor({ timeout: 60000 }).then(() => true).catch(() => false));

  // ───────── 390px
  section("Điện thoại 390px: một cột, hai nút lớn, hàng xếp dọc, không tràn ngang, nút >= 44px");
  const mctx = await ctxFor(T, { width: 390, height: 844 });
  const mp = await mctx.newPage(); watch(mp);
  await open(mp, D.id);
  check("có hai nút lớn 'Chọn tệp từ máy' và 'Dán link'; thao tác phụ của trang thu vào ⋯", await mp.getByRole("button", { name: "Chọn tệp từ máy" }).isVisible() && await mp.getByRole("button", { name: "Dán link", exact: true }).isVisible()
    && await mp.getByRole("button", { name: "Thêm thao tác của trang" }).isVisible() && await mp.getByRole("button", { name: "Thêm chương" }).count() === 0);
  await mp.getByRole("button", { name: "Thêm thao tác của trang" }).click();
  check("mở ⋯ của trang → thấy 'Thêm chương' và 'Xem như học sinh'", await mp.getByRole("button", { name: "Thêm chương" }).isVisible() && await mp.getByRole("link", { name: "Xem như học sinh" }).isVisible());
  const r1 = await report(mp);
  check("390 giáo trình: không tràn ngang, ▲▼ và nút >= 44px", !r1.overflow && r1.small.length === 0, r1);
  await shot(mp, "giao-trinh-phang-390");
  await mp.getByRole("button", { name: "Thêm thao tác của trang" }).click();
  await mp.locator("[data-gt-muc]").first().getByRole("button", { name: /^Sửa mục/ }).click();
  const md = mp.getByRole("dialog", { name: "Sửa mục" });
  await md.waitFor({ timeout: 15000 });
  const lu = await md.getByRole("button", { name: "Lưu" }).boundingBox();
  check("390 ngăn kéo là tờ toàn màn hình, nút Lưu / Đóng dính đáy trong khung nhìn", !!lu && lu.y + lu.height <= 845 && await md.getByRole("button", { name: "Đóng" }).isVisible(), lu);
  const r2 = await report(mp);
  check("390 ngăn kéo: không tràn ngang, nút >= 44px", !r2.overflow && r2.small.length === 0, r2);
  await shot(mp, "giao-trinh-phang-ngan-keo-390");
  await md.getByRole("button", { name: "Đóng" }).click();
  const mxem = await mctx.newPage(); watch(mxem);
  await mxem.goto(`${G(A.id)}/xem/gt-l4`, { waitUntil: "networkidle", timeout: 120000 });
  await mxem.getByText("Đây là bản xem thử. Không ghi tiến độ.").waitFor({ timeout: 60000 });
  check("390 xem mục Ẩn: có băng cam", await mxem.locator("[data-gt-ban-chua-dang]").getByText(/trạng thái Ẩn/).isVisible());
  const r3 = await report(mxem);
  check("390 xem như học sinh: không tràn ngang, nút >= 44px", !r3.overflow && r3.small.length === 0, r3);
  await shot(mxem, "xem-nhu-hoc-sinh-390");
  const memp = await mctx.newPage(); watch(memp);
  await memp.goto(G(C.id), { waitUntil: "networkidle", timeout: 120000 });
  const r4 = await report(memp);
  check("390 thẻ từ chối quyền: không tràn ngang, nút >= 44px", !r4.overflow && r4.small.length === 0, r4);
  const mA = await mctx.newPage(); watch(mA);
  await open(mA, A.id);
  const r5 = await report(mA);
  check("390 lớp cây cũ (có nhóm): không tràn ngang, nút >= 44px", !r5.overflow && r5.small.length === 0, r5);

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
