// SCL-D (21/11/2026) — trình duyệt thật, máy chủ + DB riêng:
//   A. Gia sư 1280: ngăn "Thêm bài học" là hộp thoại thật (role=dialog, Escape đóng), CHỈ còn 3 phần (Tên · Link video YouTube · Tài liệu) + mục gập "Tuỳ chọn khác";
//      không có Khoá bài / Học thử / ô Azota / ô Drive; dán link YouTube ⇒ "Nhận diện: YouTube" + câu lưu ý link không công khai; kéo-thả MỘT PDF ⇒ hàng tài liệu; Lưu ⇒ DB đúng.
//   B. Gia sư: tab "Video" của lớp gộp video bài giảng + form dán bản ghi; dán bản ghi ⇒ 303 về lại tab Video. Công tắc (Toggle) có role=switch, aria-checked, tên, ≥44px.
//   C. Học sinh 390: trang bài phát video qua youtube-nocookie, KHÔNG có lời dặn "Riêng tư"; tải được tài liệu (200, %PDF); danh sách bài là hộp thoại (Escape đóng);
//      tab Video của lớp (SCL-G-HS: nay là màn Tất cả bài học #ban-ghi, link ?tab=video cũ chuyển tới đó): bản ghi YouTube "Xem" ⇒ iframe youtube-nocookie; không tràn ngang.
//   D. Học sinh 390: chọn 2 ảnh ⇒ "Gộp 2 ảnh thành PDF" ⇒ MỘT tệp .pdf tải lên (ảnh gốc không gửi), Nộp bài ⇒ tệp đã nộp có /Count 2.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-scl-d.ts
import { BASE, mkTutor, mkUser, mkSuper, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

const PDF = [..."%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"].map(c => c.charCodeAt(0));
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Em An" });
  const C = await mkCourse(T.id, { name: "Toán 9 SCL-D" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  await prisma.section.create({ data: { id: "sec-d", title: "PHẦN 1", order: 0, courseId: C.id } });
  await prisma.chapter.create({ data: { id: "ch-d", title: "Chương 1", order: 0, sectionId: "sec-d" } });
  await prisma.lesson.create({ data: { id: "l-cu-d", code: "cu", title: "Bài cũ có Azota", type: "quiz", order: 0, chapterId: "ch-d", status: "published", isLocked: true, azotaUrl: "https://azota.vn/de/abc", documents: "[]" } });
  await prisma.classRecording.create({ data: { courseId: C.id, title: "Bản ghi buổi 1", url: "https://youtu.be/dQw4w9WgXcQ", kind: "youtube", createdBy: T.id } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => errors.push(String(e)));
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|hydrat|youtube|ytimg|google/i.test(m.text())) errors.push(m.text()); });
  };
  const noOverflow = (pg: any) => pg.evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`);

  // ── A ────────────────────────────────────────────────────────────────────
  // SCL-G-GS: từ 1024px ngăn là cột "Sửa bài" LUÔN MỞ (không phải hộp thoại — kiểm ở ui-scl-g-gs.ts); hộp thoại thật chỉ còn dưới 1024px ⇒ ca này chạy ở 900px.
  section("A. Gia sư 900: ngăn bài học 3 phần, dán YouTube, kéo-thả một PDF");
  const ct = await ctxFor(T, { width: 900, height: 900, rail: "mac-dinh" });
  const pt = await ct.newPage(); watch(pt);
  await pt.goto(`${BASE}/lop-cua-toi/quan-lop/${C.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pt.getByRole("button", { name: "+ Thêm bài", exact: true }).first().click({ timeout: 120000 });
  await pt.locator('[data-sua-nhanh="them"] input').first().fill("Buổi 1: Hàm số");
  await pt.locator('[data-sua-nhanh="them"]').getByRole("button", { name: "Chi tiết…" }).click();
  const dlg = pt.getByRole("dialog", { name: "Thêm bài học" });
  await dlg.waitFor({ timeout: 60000 });
  await pt.waitForTimeout(500);
  check("ngăn là hộp thoại thật: role=dialog, aria-modal, tên = tiêu đề", (await dlg.getAttribute("aria-modal")) === "true");
  const vis = async (sel: string) => pt.locator(sel).first().isVisible().catch(() => false);
  check("hiện đủ 3 phần: Tên bài · Link video YouTube · Tài liệu", await vis("#ls-ten") && await vis("[data-video-bai]") && await vis("[data-tai-lieu]"));
  const dtext = await dlg.innerText();
  check("KHÔNG có Khoá bài / Học thử / ô Azota / ô Drive / Deadline Azota", !/Khoá bài|Học thử|Link bài Azota|Deadline Azota|Google Drive\)/.test(dtext) && (await pt.locator('[role="switch"]').count()) === 0, dtext.slice(0, 600));
  check("Ngày học / Trạng thái / Bài tập / Ghi chú nằm trong mục gập (đang gập)", (await pt.locator("[data-tuy-chon] [aria-expanded]").first().getAttribute("aria-expanded")) === "false" && (await pt.locator("#ls-tuy-chon").getAttribute("inert")) !== null && (await pt.locator("#ls-tuy-chon #ls-ghi-chu").count()) === 1);
  await pt.getByLabel("Link YouTube").fill(YT);
  await pt.getByText("Nhận diện: YouTube").waitFor({ timeout: 10000 });
  check("dán link YouTube ⇒ 'Nhận diện: YouTube'; có câu lưu ý link không công khai chia ra ngoài được", /chia link ra ngoài/.test(await pt.locator("[data-youtube-luu-y]").first().innerText()));
  check("chữ dưới ô tải tệp nói đúng: tệp LƯU trên kho KiN, riêng tư (không còn 'chỉ lưu link, không lưu tệp')", /lưu trên kho của KiN/.test(dtext) && !/không lưu tệp/.test(dtext));
  await pt.locator("[data-tai-lieu-cam-ket]").check();
  const dt = await pt.evaluateHandle((b: number[]) => { const d = new DataTransfer(); d.items.add(new File([new Uint8Array(b)], "de-cuong.pdf", { type: "application/pdf" })); return d; }, PDF);
  await pt.locator("[data-o-tha]").first().dispatchEvent("drop", { dataTransfer: dt });
  await pt.locator("[data-tai-lieu-hang]").first().waitFor({ timeout: 60000 });
  check("kéo-thả một PDF ⇒ thành hàng tài liệu 'Tệp tải lên KiN'", /de-cuong\.pdf/.test(await pt.locator("[data-tai-lieu-hang]").first().innerText()) && /Tệp tải lên KiN/.test(await pt.locator("[data-tai-lieu-hang]").first().innerText()));
  // Tab xoay vòng trong hộp: Shift+Tab từ phần tử đầu không ra ngoài.
  await pt.locator('[role="dialog"] button[aria-label="Đóng"]').focus();
  await pt.keyboard.press("Shift+Tab");
  check("Tab không lọt ra ngoài hộp thoại", await pt.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
  await dlg.getByRole("button", { name: "Lưu", exact: true }).click();
  await dlg.waitFor({ state: "hidden", timeout: 60000 });
  const saved = await prisma.lesson.findFirst({ where: { title: "Buổi 1: Hàm số" } });
  check("DB: bài mới có videoUrl YouTube + 1 tài liệu /api/media/<mã>/file, không Khoá thêm / Học thử", !!saved && (saved.videoUrl ?? "").includes("dQw4w9WgXcQ") && /\/api\/media\/[A-Za-z0-9_-]+\/file/.test(saved.documents ?? "") && saved.isFree === false, saved);
  // Escape đóng hộp (mở lại bài vừa lưu)
  await pt.getByRole("button", { name: "Chi tiết bài Buổi 1: Hàm số" }).click();
  await pt.getByRole("dialog", { name: "Sửa bài học" }).waitFor({ timeout: 30000 });
  await pt.waitForTimeout(400);
  await pt.keyboard.press("Escape");
  await pt.getByRole("dialog", { name: "Sửa bài học" }).waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  check("Escape đóng ngăn Sửa bài học", !(await pt.getByRole("dialog", { name: "Sửa bài học" }).isVisible().catch(() => false)));

  // ── B ────────────────────────────────────────────────────────────────────
  section("B. Gia sư: tab Video gộp video bài giảng + bản ghi; công tắc có tên");
  await pt.goto(`${BASE}/lop-cua-toi/quan-lop/${C.id}/video`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pt.locator("[data-video-bai-giang]").last().waitFor({ timeout: 120000 });
  check("dải tab có 'Video' đang sáng", (await pt.locator('nav[aria-label^="Trang của"] a[aria-current="page"]').first().innerText()).trim() === "Video");
  check("mục Video bài giảng liệt kê bài vừa gắn YouTube", /Buổi 1: Hàm số/.test(await pt.locator("[data-video-bai-giang]").last().innerText()));
  check("cùng trang có bản ghi buổi học + form dán bản ghi", /Bản ghi buổi 1/.test(await pt.locator("[data-tab-video]").last().innerText()) && (await pt.locator("#rec-url").count()) === 1);
  await pt.locator("#rec-title").fill("Bản ghi buổi 2");
  await pt.locator("#rec-url").fill("https://youtu.be/dQw4w9WgXcQ");
  await pt.locator('input[name="pledge"]').check();
  await Promise.all([pt.waitForURL(/\/quan-lop\/[^/]+\/video\?ok=1/, { timeout: 60000 }), pt.getByRole("button", { name: "Lưu bản ghi" }).click()]);
  check("dán bản ghi ⇒ 303 về lại tab Video (?ok=1), bản ghi mới hiện", /Bản ghi buổi 2/.test(await pt.locator("[data-tab-video]").last().innerText()));
  await pt.goto(`${BASE}/lop-cua-toi/quan-lop/${C.id}?tab=cai-dat`, { waitUntil: "domcontentloaded", timeout: 180000 });
  // SCL-F2 (P2-25): gia sư không còn công tắc hiện/ẩn — máy chủ suy từ cách vào lớp, trang chỉ ghi chữ trạng thái.
  const hien = pt.locator("[data-cai-dat-hien]:visible");
  await hien.waitFor({ timeout: 120000 });
  check("gia sư: Cài đặt ghi chữ hiện/ẩn, KHÔNG có công tắc", /công khai/.test(await hien.innerText()) && (await pt.getByRole("switch").locator("visible=true").count()) === 0);
  check("Cài đặt không còn mục 'Bản ghi' (đã sang tab Video)", !(await pt.locator('[aria-label="Mục của Cài đặt"]').innerText().catch(() => "")).includes("Bản ghi"));
  // Công tắc chỉ còn với Chủ nhiệm (quản trị trung tâm) mở cùng lớp trong vỏ gia sư.
  const pa = await (await ctxFor(await mkSuper("Chủ nhiệm SCL-D"), { width: 1280, height: 900 })).newPage(); watch(pa);
  await pa.goto(`${BASE}/lop-cua-toi/quan-lop/${C.id}?tab=cai-dat`, { waitUntil: "domcontentloaded", timeout: 180000 });
  const sw = pa.getByRole("switch", { name: /trang (Khoá học )?công khai/ }).locator("visible=true");
  await sw.waitFor({ timeout: 120000 });
  const box = await sw.boundingBox();
  check("Toggle (Chủ nhiệm): role=switch, aria-checked, có tên, vùng bấm ≥ 44px", ["true", "false"].includes((await sw.getAttribute("aria-checked")) ?? "") && (box?.height ?? 0) >= 43.5 && (box?.width ?? 0) >= 43.5, box);
  await pa.close();

  // ── C ────────────────────────────────────────────────────────────────────
  section("C. Học sinh 390: video nocookie, tải tài liệu, danh sách bài là hộp thoại, tab Video");
  await prisma.assignment.create({ data: { lessonId: saved!.id, title: "BT nộp ảnh", mode: "file", ownerId: T.id, dueDate: new Date(Date.now() + 7 * 86_400_000) } });
  const cs = await ctxFor(S, { width: 390, height: 844 });
  const ps = await cs.newPage(); watch(ps);
  await ps.goto(`${BASE}/student/bai-giang/${saved!.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await ps.locator('[data-plyr-provider="youtube"], iframe[src*="youtube"]').first().waitFor({ timeout: 120000 });
  const ytSrc = await ps.waitForFunction(() => document.querySelector<HTMLIFrameElement>('iframe[src*="youtube"]')?.src ?? null, undefined, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => null) as string | null;
  check("video phát bằng youtube-nocookie.com (không youtube.com thường)", !!ytSrc && /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test(ytSrc), ytSrc ?? "(chưa dựng iframe — mạng tới YouTube?)");
  const sText = await ps.locator("main").innerText();
  check("màn học sinh KHÔNG có lời dặn 'Không công khai / Riêng tư' của gia sư", !/Riêng tư|Không công khai/.test(sText));
  const fileId = /\/api\/media\/([A-Za-z0-9_-]+)\/file/.exec(saved!.documents ?? "")?.[1];
  check("trang bài có lối mở tài liệu của bài", (await ps.locator(`a[href*="${fileId}"]`).count()) > 0);
  const dl = await ps.request.get(`${BASE}/api/media/${fileId}/file?dl=1`);
  check("học sinh của lớp tải tài liệu → 200, đúng %PDF", dl.status() === 200 && (await dl.text()).startsWith("%PDF-"), dl.status());
  await ps.getByRole("button", { name: "Danh sách bài học" }).click();
  const od = ps.getByRole("dialog", { name: "Nội dung khóa học" });
  await od.waitFor({ timeout: 10000 });
  await ps.waitForTimeout(300);
  check("danh sách bài là hộp thoại, tiêu điểm nằm trong hộp", (await od.getAttribute("aria-modal")) === "true" && await ps.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
  await ps.keyboard.press("Escape");
  await od.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  check("Escape đóng danh sách bài", !(await od.isVisible().catch(() => false)));
  check("390: trang bài không tràn ngang", await noOverflow(ps));

  // SCL-G-HS: tab Video đã bỏ — link cũ ?tab=video chuyển tới màn "Tất cả bài học" (#ban-ghi): bài có video và bản ghi buổi học ở cùng một màn.
  await ps.goto(`${BASE}/student/hoc-tap?course=${C.id}&tab=video`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await ps.waitForURL(u => u.searchParams.get("xem") === "bai-hoc" && u.hash === "#ban-ghi", { timeout: 120000 });
  await ps.locator("[data-ban-ghi]:visible").waitFor({ timeout: 120000 });
  await eventually("Tất cả bài học: bài 'Buổi 1: Hàm số' có video + bản ghi buổi ở một chỗ", async () => (await ps.locator("[data-co-video]:visible").filter({ hasText: "Buổi 1: Hàm số" }).count()) >= 1 && /Bản ghi buổi 1/.test(await ps.locator("[data-ban-ghi]:visible").innerText()), 30000);
  await ps.getByRole("button", { name: "Xem bản ghi Bản ghi buổi 2" }).click();
  const rsrc = await ps.locator("iframe[data-ban-ghi-video]").getAttribute("src");
  check("bản ghi YouTube xem ngay qua youtube-nocookie", /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test(rsrc ?? ""), rsrc);
  check("390: màn Tất cả bài học (bản ghi) không tràn ngang", await noOverflow(ps));

  // ── D ────────────────────────────────────────────────────────────────────
  section("D. Học sinh 390: nộp 2 ảnh ⇒ một PDF");
  await ps.goto(`${BASE}/student/bai-giang/${saved!.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  const BOX = '[data-nop-tep="student"]';
  await ps.locator(`${BOX}:not([data-trang-thai="dang-tai"])`).waitFor({ timeout: 120000 });
  const zoneH = (await ps.locator(`${BOX} [data-nop-tep-vung-tha]`).boundingBox())?.height ?? 999;
  check("390: ô kéo-thả gọn (< 1/4 màn hình), không chiếm nửa màn", zoneH < 844 / 4, zoneH);
  const chup = ps.locator(`${BOX} [data-nop-anh-chup]`);
  check("có ô chụp ảnh: accept=image/*, multiple, capture", (await chup.getAttribute("accept")) === "image/*" && (await chup.getAttribute("multiple")) !== null && (await chup.getAttribute("capture")) !== null);
  const imgs = await ps.evaluate(() => [1, 2].map(n => { const c = document.createElement("canvas"); c.width = 3000; c.height = 4000; const x = c.getContext("2d")!; x.fillStyle = n === 1 ? "#ffffff" : "#eeeeee"; x.fillRect(0, 0, 3000, 4000); x.fillStyle = "#000000"; x.font = "200px sans-serif"; x.fillText(`Trang ${n}`, 200, 400); return c.toDataURL("image/png").split(",")[1]; }));
  const sent: { url: string; type: string }[] = [];
  ps.on("request", (r: any) => { if (/\/api\/media\/nop-bai\//.test(r.url())) sent.push({ url: r.url(), type: r.headers()["content-type"] ?? "" }); });
  await ps.locator(`${BOX} [data-nop-anh-input]`).setInputFiles(imgs.map((b, i) => ({ name: `anh-${i + 1}.png`, mimeType: "image/png", buffer: Buffer.from(b, "base64") })));
  await ps.locator(`${BOX} [data-nop-anh-dem]`).waitFor({ timeout: 10000 });
  check("chọn 2 ảnh ⇒ '2 ảnh đã chọn', chưa gọi mạng nộp bài, Nộp bài khoá", /2 ảnh đã chọn/.test(await ps.locator(`${BOX} [data-nop-anh-dem]`).innerText()) && sent.length === 0 && await ps.locator(`${BOX} [data-nop-tep-nop]`).isDisabled());
  await ps.locator(`${BOX} [data-nop-anh-gop]`).click();
  await ps.locator(`${BOX} [data-nop-tep-hang][data-trang-thai="san-sang"]`).first().waitFor({ timeout: 120000 });
  const rowName = await ps.locator(`${BOX} [data-nop-tep-hang]`).first().innerText();
  check("gộp xong ⇒ MỘT tệp .pdf sẵn sàng", (await ps.locator(`${BOX} [data-nop-tep-hang]`).count()) === 1 && /\.pdf/.test(rowName), rowName);
  check("ảnh gốc không gửi lên máy chủ (không yêu cầu nào mang image/*)", !sent.some(s => /^image\//.test(s.type)), sent);
  await Promise.all([ps.waitForURL(/nop=/, { timeout: 60000 }).catch(() => {}), ps.locator(`${BOX} [data-nop-tep-nop]`).click()]);
  await ps.locator(`${BOX} [data-nop-tep-da-nop]`).waitFor({ timeout: 60000 });
  const file = await prisma.submissionFile.findFirst({ where: { studentUserId: S.id, status: "ready" } });
  check("DB: bài nộp có đúng một tệp PDF đã nộp", !!file && file.ext === "pdf" && !!file.submissionId && (await prisma.submissionFile.count({ where: { studentUserId: S.id } })) === 1, file);
  const href = await ps.locator(`${BOX} [data-nop-tep-tai]`).first().getAttribute("href");
  const body = await (await ps.request.get(`${BASE}${href}`)).body();
  const txt = body.toString("latin1");
  check("tệp đã nộp là PDF hai trang (/Count 2), ảnh nhúng JPEG (/DCTDecode), ảnh ≤ 2000px", txt.startsWith("%PDF-") && /\/Count 2 /.test(txt) && (txt.match(/\/DCTDecode/g) ?? []).length === 2 && /\/Width 1500 \/Height 2000/.test(txt), txt.slice(0, 300));
  check("390: khối nộp bài không tràn ngang", await noOverflow(ps));

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(async e => { console.error(e); process.exitCode = 1; await closeAll().catch(() => {}); await done(); });
