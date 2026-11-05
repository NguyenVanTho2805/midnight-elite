// BU-02-PHẲNG: đích "Dùng ở lớp khác" = lớp ▸ MỤC MỚI (mặc định, Nháp, không chương) hoặc mục có sẵn (chip trạng thái); hồi quy phần còn lại.
// BU-02 — "Thư viện của tôi" (/thu-vien, nhánh gia sư), trình duyệt thật, 1280 + 390, có chụp ảnh. Figma: chưa đối chiếu (504:6046 / 299:113561).
// Kiểm: rỗng / có dữ liệu / lỗi khi thêm (giả lập 500 ở G2), tìm + lọc loại, "Dùng ở lớp khác" (mục xuất hiện ở bài đích, số 'đang dùng ở' tăng), nhóm "Chưa gắn vào bài"
// (gắn / xoá có hộp xác nhận KiN), nhóm "Đề gốc" chỉ xem, học sinh vẫn thấy thư viện học sinh (D2) và thấy tài liệu tải lên KiN (D4), 390px không tràn ngang, nút >= 44px.
// Cần Postgres + Next dev (xem README).
import { BASE, mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

async function report(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-agentation-root] { display: none !important; }" });
  return page.evaluate(`(() => {
    var vis = function (e) { var r = e.getBoundingClientRect(); var st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
    var small = Array.prototype.slice.call(document.querySelectorAll('button, summary, a[class*="kin-cham-toi-thieu"], a[data-kin-nut]'))
      .filter(function (e) { return vis(e) && !e.closest('[data-kin-toast],nextjs-portal,[data-nextjs-toast],[data-agentation-root]') && !e.disabled && !/^Mở rộng thanh bên/.test(e.getAttribute('aria-label') || e.textContent || '') && e.getBoundingClientRect().height < 43.5; })
      .map(function (e) { return e.tagName + ":" + (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30) + ":" + Math.round(e.getBoundingClientRect().height); });
    return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1, small: small };
  })()`) as Promise<{ overflow: boolean; small: string[] }>;
}

const seen: Page[] = [];
(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), EMPTY = await mkTutor("Cô Mới");
  const S = await mkUser({ name: "Em Mai" });
  const A = await mkCourse(T.id, { name: "Toán 9" }), B = await mkCourse(T.id, { name: "Văn 8" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const mk = async (c: { id: string }, tag: string, lessonId: string, docs: unknown[]) => {
    const sec = await prisma.section.create({ data: { id: `tv-s-${tag}`, title: `Phần ${tag}`, order: 1, courseId: c.id } });
    const ch = await prisma.chapter.create({ data: { id: `tv-c-${tag}`, title: `Chương ${tag}`, order: 1, sectionId: sec.id } });
    await prisma.lesson.create({ data: { id: lessonId, code: lessonId, title: `Bài ${tag}`, type: "record", order: 1, chapterId: ch.id, documents: JSON.stringify(docs) } as any });
  };
  const kin = await prisma.fileAsset.create({ data: { ownerId: T.id, courseId: A.id, lessonId: "tv-la", kind: "document", driver: "local", storageKey: "tv-kin.pdf", mimeType: "application/pdf", bytes: 4096, originalName: "Phiếu KiN.pdf", status: "ready" } });
  const loose = await prisma.fileAsset.create({ data: { ownerId: T.id, courseId: A.id, kind: "document", driver: "local", storageKey: "tv-loose.pdf", mimeType: "application/pdf", bytes: 2048, originalName: "phieu-chua-gan.pdf", status: "ready" } });
  const loose2 = await prisma.fileAsset.create({ data: { ownerId: T.id, courseId: A.id, kind: "document", driver: "local", storageKey: "tv-loose2.pdf", mimeType: "application/pdf", bytes: 1024, originalName: "xoa-di.pdf", status: "ready" } });
  const shared = { name: "Đề cương.pdf", url: "https://files.example/de-cuong.pdf", type: "pdf" };
  await mk(A, "A", "tv-la", [shared, { name: "Bảng công thức", url: "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit", type: "doc" }, { name: "Phiếu KiN.pdf", url: `/api/media/${kin.id}/file`, type: "pdf" }]);
  await mk(B, "B", "tv-lb", [shared]);
  await prisma.examFile.create({ data: { fileName: "De-goc-toan9.pdf", fileUrl: "https://files.example/dg.pdf", fileType: "application/pdf", ownerId: T.id } });

  await launch();
  const errors: string[] = [];
  // 'Encountered a script tag': <script> chủ đề trong src/app/layout.tsx (có sẵn trên main, lỗi React 19, không thuộc BU-02) — nợ riêng, lọc có chủ đích.
  const watch = (p: Page) => { seen.push(p); p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|Encountered a script tag/i.test(m.text())) errors.push(m.text()); }); };
  const rows = (p: Page) => p.locator("[data-tv-muc]");

  section("Rỗng — gia sư mới chưa có tài liệu");
  const ep = await (await ctxFor(EMPTY, { width: 1280, height: 900 })).newPage(); watch(ep);
  await ep.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await ep.getByRole("heading", { name: "Thư viện", level: 1 }).waitFor({ timeout: 90000 });
  check("trạng thái rỗng: 'Chưa có tài liệu' + lối đi tiếp (Thêm ở Giáo trình)", await ep.getByText("Chưa có tài liệu", { exact: true }).isVisible() && await ep.getByRole("link", { name: "Thêm ở Giáo trình" }).isVisible());

  section("Có dữ liệu — 1280px");
  const ctx = await ctxFor(T, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);
  await pg.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Thư viện", level: 1 }).waitFor({ timeout: 90000 });
  await rows(pg).first().waitFor({ timeout: 60000 });
  check("3 tài liệu trong bài (gộp trùng URL): Đề cương, Bảng công thức, Phiếu KiN", await rows(pg).count() === 3, await rows(pg).allInnerTexts());
  const dc = rows(pg).filter({ hasText: "Đề cương.pdf" });
  check("Đề cương.pdf dùng ở 2 lớp (Toán 9, Văn 8)", /2 lớp/.test(await dc.locator("[data-tv-dung-o]").innerText()) && (await dc.innerText()).includes("Toán 9") && (await dc.innerText()).includes("Văn 8"));
  check("nhãn lưu trữ: Phiếu KiN là 'Tệp trên KiN (riêng tư)'", (await rows(pg).filter({ hasText: "Phiếu KiN.pdf" }).innerText()).includes("Tệp trên KiN"));
  check("nhóm 'Chưa gắn vào bài' hiện 2 tệp chưa dùng", await pg.locator("[data-tv-chua-gan] li").count() === 2);
  check("không tràn ngang; nút >= 44px", await (async () => { const r = await report(pg); return !r.overflow && r.small.length === 0; })());
  await shot(pg, "thu-vien-gia-su-1280");

  section("Tìm và lọc");
  await pg.getByLabel("Tìm tài liệu").fill("công thức");
  check("tìm 'công thức' → 1 tài liệu", await rows(pg).count() === 1);
  await pg.getByLabel("Tìm tài liệu").fill("");
  await pg.getByLabel("Loại").selectOption({ label: "PDF" });
  check("lọc PDF → chỉ PDF (Đề cương, Phiếu KiN)", await rows(pg).count() === 2);
  await pg.getByLabel("Loại").selectOption({ label: "Tất cả loại" });
  await pg.getByRole("button", { name: /^Văn 8/ }).click();
  check("nhóm theo lớp Văn 8 → 1 tài liệu", await rows(pg).count() === 1);
  await pg.getByRole("button", { name: /^Tất cả/ }).click();

  section("Dùng ở lớp khác");
  await pg.route("**/api/tutor/lop/*/giao-trinh/muc", r => (r.request().method() === "POST" ? r.fulfill({ status: 500, json: { error: "Thêm mục thất bại, hãy thử lại." } }) : r.continue()));
  const cf = rows(pg).filter({ hasText: "Bảng công thức" });
  await cf.getByRole("button", { name: "Dùng ở lớp khác" }).click();
  await cf.getByLabel("Lớp").selectOption({ label: "Văn 8" });
  check("đích mặc định là 'Mục mới (Nháp)' và có dòng nói mục mới chỉ bạn thấy", (await cf.getByLabel("Mục", { exact: true }).inputValue()) === "new" && await cf.getByText(/Mục mới ở dạng Nháp, chỉ bạn thấy/).isVisible() && await cf.getByLabel("Mục", { exact: true }).locator("option", { hasText: "Mục mới (Nháp)" }).count() === 1);
  await cf.getByRole("button", { name: "Thêm vào lớp này" }).click();
  await cf.getByRole("alert").getByText("Thêm mục thất bại").waitFor({ timeout: 15000 }).catch(() => undefined);
  check("lỗi máy chủ → báo tại chỗ (role=alert), không mất khung chọn", await cf.getByRole("alert").getByText("Thêm mục thất bại").isVisible());
  await pg.unroute("**/api/tutor/lop/*/giao-trinh/muc");
  await cf.getByRole("button", { name: "Thêm vào lớp này" }).click();
  await pg.locator("[data-tv-thong-bao]").getByText(/Đã thêm .*Bảng công thức.* vào lớp Văn 8 thành mục mới ở dạng Nháp/).waitFor({ timeout: 60000 });
  await eventually("DB: lớp Văn 8 có thêm MỘT mục mới 'Bảng công thức' ở dạng NHÁP (không cần chọn chương) và số 'đang dùng ở' tăng", async () => {
    const lessons = await prisma.lesson.findMany({ where: { chapter: { section: { courseId: B.id } } } });
    const added = lessons.filter(l => (l.documents ?? "").includes("docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345"));
    return added.length === 1 && added[0].status === "draft";
  });
  await eventually("sau khi làm mới: 'Bảng công thức' dùng ở 2 lớp", async () => /2 lớp/.test(await rows(pg).filter({ hasText: "Bảng công thức" }).locator("[data-tv-dung-o]").innerText()));
  await eventually("chip trạng thái: mục vừa thêm ở Văn 8 là 'Nháp', bài cũ ở Toán 9 là 'Đã đăng'", async () => {
    const r = rows(pg).filter({ hasText: "Bảng công thức" });
    return (await r.locator("li", { hasText: "Văn 8 · " }).locator('[data-gt-chip-trang-thai="draft"]').count()) === 1 && (await r.locator("li", { hasText: "Toán 9 · " }).locator('[data-gt-chip-trang-thai="published"]').count()) === 1;
  });

  section("Gỡ khỏi bài này (G3) — hộp xác nhận KiN");
  let nativeDialog = false; pg.on("dialog", d => { nativeDialog = true; void d.dismiss(); });
  await rows(pg).filter({ hasText: "Bảng công thức" }).locator("li", { hasText: "Văn 8 · " }).getByRole("button", { name: "Gỡ khỏi bài này" }).click(); // bài vừa thêm ở lớp Văn 8 (thứ tự usedIn không cố định)
  await pg.getByRole("dialog").getByRole("button", { name: "Gỡ khỏi bài" }).click();
  await eventually("DB: bản vừa thêm ở lớp Văn 8 bị gỡ", async () => !(await prisma.lesson.findMany({ where: { chapter: { section: { courseId: B.id } } } })).some(l => (l.documents ?? "").includes("docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345")));
  check("không dùng hộp thoại gốc", !nativeDialog);

  section("Chưa gắn vào bài: gắn và xoá");
  await pg.getByRole("button", { name: /^Chưa gắn vào bài/ }).click();
  const lo = pg.locator("[data-tv-chua-gan] li", { hasText: "phieu-chua-gan.pdf" });
  await lo.getByRole("button", { name: "Gắn vào bài" }).click();
  await lo.getByLabel("Lớp").selectOption({ label: "Toán 9" });
  await lo.getByLabel("Mục", { exact: true }).selectOption({ label: "Bài A · Đã đăng" });
  await lo.getByRole("button", { name: "Thêm vào lớp này" }).click();
  await pg.locator("[data-tv-thong-bao]").getByText(/Đã thêm .*phieu-chua-gan.* vào mục có sẵn/).waitFor({ timeout: 60000 });
  await eventually("DB: tài liệu chưa gắn đã nằm trong mục có sẵn của Toán 9 (trạng thái mục không đổi)", async () => ((await prisma.lesson.findUnique({ where: { id: "tv-la" } }))?.documents ?? "").includes(`/api/media/${loose.id}/file`));
  const xd = pg.locator("[data-tv-chua-gan] li", { hasText: "xoa-di.pdf" });
  await xd.getByRole("button", { name: "Xoá tệp" }).click();
  await pg.getByRole("dialog").getByRole("button", { name: "Xoá tệp" }).click();
  await eventually("DB: FileAsset chưa gắn bị xoá", async () => (await prisma.fileAsset.findUnique({ where: { id: loose2.id } })) === null);

  section("Đề gốc: chỉ xem");
  await pg.getByRole("button", { name: /^Đề gốc/ }).click();
  check("hiện De-goc-toan9.pdf, không có nút Xoá/Gắn/Dùng ở lớp khác", await pg.getByText("De-goc-toan9.pdf").isVisible() && await pg.getByRole("button", { name: /Xoá|Gắn vào bài|Dùng ở lớp khác/ }).count() === 0);
  check("có lối sang Ngân hàng đề của gia sư (không /admin)", (await pg.getByRole("link", { name: /Ngân hàng đề/ }).getAttribute("href")) === "/lop-cua-toi/de-thi/ngan-hang-de-thi");

  section("Học sinh vẫn thấy thư viện của học sinh (D2) và tài liệu KiN (D4)");
  const sp = await (await ctxFor(S, { width: 1280, height: 900 })).newPage(); watch(sp);
  await sp.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await sp.getByRole("heading", { name: "Thư viện", level: 1 }).waitFor({ timeout: 90000 });
  const sBody = await sp.locator("body").innerText();
  check("học sinh không thấy công cụ của gia sư", !sBody.includes("Dùng ở lớp khác") && !sBody.includes("Chưa gắn vào bài"));
  check("học sinh thấy 'Đề cương.pdf' của lớp mình đang học", sBody.includes("Đề cương.pdf"));
  check("D4: học sinh thấy tài liệu tải lên KiN 'Phiếu KiN.pdf' trong thư viện", sBody.includes("Phiếu KiN.pdf"), sBody.slice(0, 300));

  // ───────── 390px
  section("Điện thoại 390px");
  const mctx = await ctxFor(T, { width: 390, height: 844 });
  const mp = await mctx.newPage(); watch(mp);
  await mp.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("heading", { name: "Thư viện", level: 1 }).waitFor({ timeout: 90000 });
  await mp.locator("[data-tv-muc]").first().waitFor({ timeout: 60000 });
  const r1 = await report(mp);
  check("390 thư viện: một cột, không tràn ngang, nút >= 44px", !r1.overflow && r1.small.length === 0, r1);
  await mp.locator("[data-tv-muc]").first().getByRole("button", { name: "Dùng ở lớp khác" }).click();
  const r2 = await report(mp);
  check("390 khi mở khung 'Dùng ở lớp khác': không tràn ngang, nút >= 44px", !r2.overflow && r2.small.length === 0, r2);
  await shot(mp, "thu-vien-gia-su-390");
  const me = await (await ctxFor(EMPTY, { width: 390, height: 844 })).newPage(); watch(me);
  await me.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await me.getByText("Chưa có tài liệu", { exact: true }).waitFor({ timeout: 60000 });
  const r3 = await report(me);
  check("390 trạng thái rỗng: không tràn ngang, nút >= 44px", !r3.overflow && r3.small.length === 0, r3);

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
