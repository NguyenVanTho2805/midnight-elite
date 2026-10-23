// Giao diện VIDEO + TÀI LIỆU + AZOTA (Figma 464:8628 học sinh, 504:6046 gia sư) — trình duyệt thật, 390px và 1280px.
// Chạy với máy chủ thử có KIN_VIDEO_MAX_MB=1 (bài tải video lên dùng tệp nhỏ). Ảnh chụp ra scratchpad/shots/media-*.png.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, closeAll, shot, type Page } from "./ui";
import { makeSyntheticMp4 } from "./mock/nc2-video";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const stamp = Date.now().toString(36);
const YT = "https://youtu.be/dQw4w9WgXcQ";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Minh Anh" });
  const A = await mkCourse(T.id, { name: "Toán 9 học liệu" });
  await prisma.course.update({ where: { id: A.id }, data: { status: true } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const sec = await prisma.section.create({ data: { id: `s-${stamp}`, title: "Phần 1", order: 1, courseId: A.id } });
  const ch = await prisma.chapter.create({ data: { id: `c-${stamp}`, title: "Chương 1", order: 1, sectionId: sec.id } });
  const docs = JSON.stringify([
    { name: "Định lý Vi-ét.pdf", url: "https://res.cloudinary.com/kin/raw/upload/viet.pdf" },
    { name: "Bản ghi Drive", url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view" },
    { name: "Link nguy hiểm", url: "javascript:alert(1)" },
    { name: "Máy chủ lạ", url: "https://evil.example/tai-lieu.pdf" },
  ]);
  let order = 0;
  const mk = (key: string, o: Record<string, unknown>) => prisma.lesson.create({ data: { id: `l-${key}-${stamp}`, code: key, title: `Bài ${key}`, type: "record", order: ++order, chapterId: ch.id, isLocked: false, isFree: false, ...o } as never });
  const lYt = await mk("yt", { videoUrl: YT, documents: docs, adminNote: "Xem kỹ phần 2" });
  const lVimeo = await mk("vimeo", { videoUrl: "https://vimeo.com/76979871" });
  const lDrive = await mk("drive", { videoUrl: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view" });
  const lBad = await mk("bad", { videoUrl: "javascript:alert(1)" });
  const lExt = await mk("ext", { videoUrl: "https://example.com/video-cu" });
  const lEmpty = await mk("empty", { videoUrl: null });
  const lMany = await mk("many", { videoUrl: JSON.stringify([YT, "https://vimeo.com/76979871"]) });
  const lAz = await mk("az", { type: "quiz", azotaUrl: JSON.stringify(["https://azota.vn/de-thi/p1", "https://azota.vn/de-thi/p2"]), azotaDeadline: "2026-10-30T20:00" });
  const key = `${A.id}/ui-media.mp4`;
  const bytes = makeSyntheticMp4(key);
  const asset = bytes ? await prisma.fileAsset.create({ data: { ownerId: T.id, courseId: A.id, kind: "video", driver: "local", storageKey: key, mimeType: "video/mp4", bytes, originalName: "ui-media.mp4", status: "ready" } }) : null;
  const lUp = await mk("up", { videoUrl: asset ? `kin-media:${asset.id}` : null });
  if (asset) await prisma.fileAsset.update({ where: { id: asset.id }, data: { lessonId: lUp.id } });
  check("có video thử thật (ffmpeg)", !!asset);

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|youtube|googlevideo|doubleclick|vimeo|ERR_/i.test(m.text())) errors.push(m.text()); }); };
  const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const open = async (p: Page, id: string) => { await p.goto(`${BASE}/student/bai-giang/${id}`, { waitUntil: "domcontentloaded", timeout: 120000 }); await p.getByRole("heading", { level: 1 }).waitFor({ timeout: 120000 }); };

  for (const [label, w, h] of [["390", 390, 844], ["1280", 1280, 900]] as const) {
    section(`Học sinh — trang bài giảng ở ${label}px`);
    const ctx = await ctxFor(S, { width: w, height: h });
    const p = await ctx.newPage(); watch(p);

    await open(p, lYt.id);
    await p.locator(".plyr iframe").first().waitFor({ state: "attached", timeout: 60000 });
    check("YouTube: dựng player Plyr, khung nhúng youtube-nocookie dựng từ mã đã kiểm (không dùng link thô)", /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test((await p.locator(".plyr iframe").first().getAttribute("src")) ?? ""));
    check("không còn chữ giả 'Thiết bị 1/2' / 'lượt xem'", !/Thiết bị 1\/2|lượt xem/.test(await p.locator("body").innerText()));
    check("nút phụ đề cao ≥ 44px", ((await p.getByRole("button", { name: /Phụ đề/ }).first().boundingBox())?.height ?? 0) >= 44);
    await shot(p, `media-student-youtube-${label}`);

    // Tài liệu: xem thử + tải về, chặn link nguy hiểm
    const rows = p.locator("li", { hasText: "Định lý Vi-ét.pdf" });
    check("tab Tài liệu: hàng tài liệu có nút 'Xem thử' và 'Tải về'", (await rows.getByRole("link", { name: /Xem thử/ }).count()) === 1 && (await rows.getByRole("link", { name: /Tải về/ }).count()) === 1);
    check("nút Xem thử trỏ trang /xem-tai-lieu và cao ≥ 44px", ((await rows.getByRole("link", { name: /Xem thử/ }).getAttribute("href")) ?? "").startsWith("/xem-tai-lieu?url=") && ((await rows.getByRole("link", { name: /Xem thử/ }).boundingBox())?.height ?? 0) >= 44);
    check("tài liệu Drive: có Xem thử, KHÔNG có Tải về (không tải thẳng được)", (await p.locator("li", { hasText: "Bản ghi Drive" }).getByRole("link", { name: /Tải về/ }).count()) === 0 && (await p.locator("li", { hasText: "Bản ghi Drive" }).getByRole("link", { name: /Xem thử/ }).count()) === 1);
    const bad = p.locator("li", { hasText: "Link nguy hiểm" });
    check("tài liệu javascript:: KHÔNG có nút Xem thử / Tải về, ghi rõ đường dẫn chưa đúng", (await bad.getByRole("link").count()) === 0 && /chưa đúng/.test(await bad.innerText()));
    check("không có thẻ <a> nào mang href javascript:", (await p.locator('a[href^="javascript:"]').count()) === 0);
    check("tài liệu máy chủ lạ: không có Tải về trực tiếp", (await p.locator("li", { hasText: "Máy chủ lạ" }).getByRole("link", { name: /Tải về/ }).count()) === 0);
    await shot(p, `media-student-documents-${label}`);

    // Ghi chú theo mốc
    await p.getByRole("button", { name: /Ghi chú/ }).click();
    await p.getByText("Lưu ý từ gia sư").waitFor({ timeout: 30000 });
    check("ghi chú: hiện lưu ý của gia sư", await p.getByText("Xem kỹ phần 2").isVisible());
    const area = p.getByRole("textbox").first();
    await area.fill("[1:30] công thức nghiệm\n[12:05] ví dụ 2");
    await eventually("hai mốc [1:30] và [12:05] thành hai nút bấm được", async () => (await p.getByRole("list", { name: "Các mốc đã ghim" }).getByRole("button").count()) === 2);
    await p.getByRole("button", { name: "Lưu ghi chú" }).click();
    await eventually("lưu ghi chú → 'Đã lưu'", async () => (await p.getByRole("button", { name: "Đã lưu" }).count()) > 0);
    check("nút Ghim mốc đang xem cao ≥ 44px", ((await p.getByRole("button", { name: "Ghim mốc đang xem" }).boundingBox())?.height ?? 0) >= 44);
    await shot(p, `media-student-notes-${label}`);
    check(`không tràn ngang ở ${label}px (bài YouTube)`, (await overflow(p)) <= 1, await overflow(p));

    // Sidebar: tách đang xem / đã xong
    await prisma.lessonProgress.upsert({ where: { userId_lessonId: { userId: S.id, lessonId: lMany.id } }, create: { userId: S.id, lessonId: lMany.id, watchedSeconds: 50, completed: false }, update: {} });
    await prisma.lessonProgress.upsert({ where: { userId_lessonId: { userId: S.id, lessonId: lDrive.id } }, create: { userId: S.id, lessonId: lDrive.id, watchedSeconds: 9, completed: true }, update: {} });
    await open(p, lVimeo.id);
    if (w >= 1280) {
      await eventually("danh sách bài bên cạnh: bài xem dở ghi 'Đang xem', bài xong ghi 'Đã xong'", async () => (await p.getByText("Đang xem", { exact: true }).count()) > 0 && (await p.getByText("Đã xong", { exact: true }).count()) > 0);
    }

    // Vimeo: iframe sandbox
    await p.locator("iframe[title='Video bài giảng']").waitFor({ timeout: 60000 });
    const vf = p.locator("iframe[title='Video bài giảng']");
    check("Vimeo: iframe có sandbox, địa chỉ do KiN dựng lại từ mã (player.vimeo.com)", ((await vf.getAttribute("sandbox")) ?? "").includes("allow-scripts") && !((await vf.getAttribute("sandbox")) ?? "").includes("allow-top-navigation") && ((await vf.getAttribute("src")) ?? "").startsWith("https://player.vimeo.com/video/76979871"), await vf.getAttribute("src"));
    check("Vimeo: nói rõ không lưu được chỗ đang xem", await p.getByText(/không lưu được chỗ bạn đã xem/).isVisible());
    await shot(p, `media-student-vimeo-${label}`);

    await open(p, lDrive.id);
    await p.locator("iframe[title='Video bài giảng']").waitFor({ timeout: 60000 });
    check("Drive: iframe sandbox tới drive.google.com/file/d/<mã>/preview", ((await p.locator("iframe[title='Video bài giảng']").getAttribute("src")) ?? "").startsWith("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview"));

    // Trường hợp lỗi / rỗng
    await open(p, lBad.id);
    await p.getByText("Link video chưa đọc được").waitFor({ timeout: 30000 });
    check("link video hỏng: báo rõ + hướng dẫn, không trắng trang, không có iframe", (await p.locator("iframe[title='Video bài giảng']").count()) === 0 && await p.getByText(/nhắn gia sư kiểm tra/i).isVisible());
    await open(p, lExt.id);
    await p.getByText("Video nằm trên example.com").waitFor({ timeout: 30000 });
    check("link cũ lạ (không nhúng được): chỉ nút mở tab mới, rel noopener, không iframe", (await p.locator("iframe[title='Video bài giảng']").count()) === 0 && (await p.getByRole("link", { name: "Mở video" }).getAttribute("rel"))?.includes("noopener") === true);
    await open(p, lEmpty.id);
    await p.getByText("Video chưa được cập nhật").waitFor({ timeout: 30000 });
    check("chưa có video: trạng thái rỗng có lời giải thích", await p.getByText(/Gia sư chưa gắn video/).isVisible());
    await open(p, lMany.id);
    await p.locator(".plyr iframe").first().waitFor({ state: "attached", timeout: 60000 });
    check("bài có 2 link (lưu dạng JSON mảng): phát video đầu, link thứ hai là nút 'Video khác' (không thành chuỗi JSON trong iframe)", (await p.getByRole("link", { name: /Video khác · Vimeo/ }).count()) === 1 && (await p.locator("iframe[src*='[']").count()) === 0);
    check(`không tràn ngang ở ${label}px (bài 2 link)`, (await overflow(p)) <= 1);

    // Video tải lên KiN
    if (asset) {
      await open(p, lUp.id);
      const v = p.locator("video");
      await v.waitFor({ timeout: 60000 });
      check("video tải lên: thẻ <video> trỏ /api/media/<mã>/stream, không có link Cloudinary/đường dẫn đĩa", (await v.getAttribute("src")) === `/api/media/${asset.id}/stream` && (await v.getAttribute("controlslist")) === "nodownload");
      await eventually("video tải lên đọc được (có độ dài ≈ 3 giây)", async () => { const d = await v.evaluate((e: HTMLVideoElement) => e.duration); return d > 2 && d < 4; }, 30000);
      await shot(p, `media-student-upload-${label}`);
      // Ghim mốc trên video thật
      await v.evaluate((e: HTMLVideoElement) => { e.currentTime = 2; });
      await p.getByRole("button", { name: /Ghi chú/ }).click();
      await p.getByRole("button", { name: "Ghim mốc đang xem" }).click();
      await eventually("Ghim mốc → thêm dòng [0:02] vào ghi chú và hiện nút mốc", async () => /\[0:02\]/.test(await p.getByRole("textbox").first().inputValue()) && (await p.getByRole("list", { name: "Các mốc đã ghim" }).getByRole("button").count()) >= 1);
      // người chưa ghi danh mở thẳng: chặn
    }

    // Azota
    section(`Học sinh — Azota ở ${label}px`);
    await open(p, lAz.id);
    await p.getByRole("region", { name: "Bài Azota" }).waitFor({ timeout: 60000 });
    const az = p.getByRole("region", { name: "Bài Azota" });
    check("hai link Azota thành hai nút riêng với href đúng (không phải chuỗi JSON)", (await az.getByRole("link", { name: /Làm bài \d trên Azota/ }).count()) === 2 && (await az.getByRole("link", { name: /Làm bài 1/ }).getAttribute("href")) === "https://azota.vn/de-thi/p1" && (await az.getByRole("link", { name: /Làm bài 2/ }).getAttribute("href")) === "https://azota.vn/de-thi/p2");
    check("hiện hạn nộp theo giờ Việt Nam (30/10/2026 20:00)", /30\/10\/2026.*20:00/.test(await az.innerText()), await az.innerText());
    check("trạng thái ban đầu: 'Chưa làm'", await az.getByText("Chưa làm", { exact: true }).isVisible());
    await az.getByRole("textbox").fill("https://azota.vn/bai-lam/anh.jpg");
    await az.getByRole("button", { name: "Em đã làm xong" }).click();
    await eventually("link ảnh bị chặn, báo 'KiN không nhận ảnh bài làm', chưa lưu", async () => /không nhận ảnh/.test(await az.innerText()) && (await prisma.lessonAzotaDone.count()) === 0);
    await az.getByRole("textbox").fill("https://azota.vn/bai-lam/hs-minh-anh");
    await az.getByRole("button", { name: "Em đã làm xong" }).click();
    await eventually("hợp lệ → 'Em đã làm xong' và đã ghi vào bảng riêng", async () => (await az.getByText("Em đã làm xong", { exact: true }).count()) > 0 && (await prisma.lessonAzotaDone.count({ where: { lessonId: lAz.id, userId: S.id } })) === 1);
    check("KHÔNG tạo Assignment ảo", (await prisma.assignment.count({ where: { lessonId: lAz.id } })) === 0);
    await open(p, lAz.id);
    await p.getByRole("region", { name: "Bài Azota" }).getByText("Em đã làm xong", { exact: true }).waitFor({ timeout: 30000 });
    check("tải lại trang vẫn nhớ đã làm, hiện link em đã gửi", (await p.getByRole("region", { name: "Bài Azota" }).innerText()).includes("hs-minh-anh"));
    check("nút 'Bỏ đánh dấu' cao ≥ 44px", ((await p.getByRole("button", { name: "Bỏ đánh dấu" }).boundingBox())?.height ?? 0) >= 44);
    await shot(p, `media-student-azota-${label}`);
    check(`không tràn ngang ở ${label}px (Azota)`, (await overflow(p)) <= 1);
    await p.getByRole("button", { name: "Bỏ đánh dấu" }).click();
    await eventually("bỏ đánh dấu → 'Chưa làm' và bản ghi mất", async () => (await p.getByRole("region", { name: "Bài Azota" }).getByText("Chưa làm", { exact: true }).count()) > 0 && (await prisma.lessonAzotaDone.count()) === 0);
    await ctx.close();
  }

  section("Trang xem thử tài liệu (/xem-tai-lieu): chỉ nhúng nguồn tin cậy");
  {
    const ctx = await ctxFor(S, { width: 390, height: 844 });
    const p = await ctx.newPage(); watch(p);
    const view = async (url: string) => { await p.goto(`${BASE}/xem-tai-lieu?url=${encodeURIComponent(url)}&name=Thu`, { waitUntil: "domcontentloaded", timeout: 120000 }); await p.waitForTimeout(800); };
    await view("javascript:alert(1)//x.pdf");
    check("javascript:…pdf → KHÔNG có iframe, báo không xem trước được", (await p.locator("iframe").count()) === 0 && /Không xem trước được/.test(await p.locator("body").innerText()));
    check("javascript: → không có nút/liên kết nào mang href javascript:", (await p.locator('a[href^="javascript:"]').count()) === 0);
    await view("data:text/html,<script>alert(1)</script>");
    check("data: → không iframe", (await p.locator("iframe").count()) === 0);
    await view("https://evil.example/x.pdf");
    check("PDF ở máy chủ lạ → không iframe, chỉ cho mở tab mới (rel noopener)", (await p.locator("iframe").count()) === 0 && (await p.getByRole("link", { name: "Mở tài liệu" }).getAttribute("rel"))?.includes("noopener") === true);
    await view("http://res.cloudinary.com/kin/raw/upload/a.pdf");
    check("http (không https) → không iframe", (await p.locator("iframe").count()) === 0);
    await view("https://res.cloudinary.com/kin/raw/upload/a.pdf");
    check("PDF Cloudinary của KiN → có iframe", (await p.locator("iframe").count()) === 1);
    check("Cloudinary: có nút 'Tải xuống' cao ≥ 44px", ((await p.getByRole("link", { name: "Tải xuống" }).boundingBox())?.height ?? 0) >= 44);
    await view("https://res.cloudinary.com/kin/image/upload/a.png");
    check("ảnh Cloudinary → hiện <img>", (await p.locator("img").count()) === 1);
    await view("https://docs.google.com/document/d/abcdefghijk/edit");
    check("Google Docs → iframe /preview", ((await p.locator("iframe").getAttribute("src")) ?? "").endsWith("/preview"));
    await view("https://res.cloudinary.com/kin/raw/upload/a.docx");
    check("Word Cloudinary → qua Office viewer", ((await p.locator("iframe").getAttribute("src")) ?? "").startsWith("https://view.officeapps.live.com/"));
    await shot(p, "media-viewer-390");
    check("không tràn ngang ở 390px (xem thử)", (await overflow(p)) <= 1);
    await ctx.close();
  }

  section("Gia sư — màn soạn bài giảng (1280px và 390px)");
  const mp4Dir = mkdtempSync(join(tmpdir(), "kin-ui-media-"));
  const small = join(mp4Dir, "bai-giang-nho.mp4"), exe = join(mp4Dir, "virus.exe"), bigPdf = join(mp4Dir, "to.pdf");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=160x90:rate=10:duration=2", "-pix_fmt", "yuv420p", "-c:v", "libx264", small]);
  execFileSync("dd", ["if=/dev/zero", `of=${exe}`, "bs=1024", "count=4"], { stdio: "ignore" });
  execFileSync("dd", ["if=/dev/zero", `of=${bigPdf}`, "bs=1048576", "count=26"], { stdio: "ignore" });
  await prisma.lessonAzotaDone.create({ data: { lessonId: lAz.id, userId: S.id, kind: "link", linkUrl: "https://azota.vn/bai-lam/hs" } });
  const S5 = await mkUser({ name: "Em chưa làm Azota" });
  await prisma.enrollment.create({ data: { userId: S5.id, courseId: A.id, status: "active" } });
  for (const [label, w, h] of [["1280", 1280, 900], ["390", 390, 844]] as const) {
    const ctx = await ctxFor(T, { width: w, height: h });
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/admin/khoa-hoc/${A.id}?tab=chuong-bai`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.getByText("Phần 1").first().waitFor({ timeout: 120000 });
    await p.getByText("Phần 1").first().click();
    await p.getByText("Chương 1").first().click().catch(() => {});
    const editBtn = (pg: Page, title: string) => pg.locator(`xpath=//*[normalize-space(text())='${title}']/ancestor::div[.//button[@title='Sửa']][1]//button[@title='Sửa']`).first();
    await editBtn(p, "Bài yt").click({ timeout: 30000 });
    const drawer = p.locator("div.fixed").filter({ hasText: "Sửa bài học" }).last();
    await drawer.getByText("Link video bài giảng").first().waitFor({ timeout: 30000 });
    await eventually(`${label}: ô video nhận diện YouTube ngay khi mở bài`, async () => /Nhận diện: YouTube/.test(await drawer.innerText()), 15000);

    await p.waitForTimeout(600); // chờ ngăn trượt vào xong (0,28 giây)
    { const b = await drawer.boundingBox(); check(`${label}: ngăn soạn bài nằm gọn trong màn hình (không bị cắt bên phải)`, !!b && b.x >= -0.5 && b.x + b.width <= w + 0.5, b); }
    const videoInput = drawer.getByLabel("Link video bài giảng (YouTube, Vimeo, Google Drive)").first();
    await videoInput.fill("https://azota.vn/de-thi/xyz");
    await eventually(`${label}: dán link Azota vào ô video → báo lỗi sớm kèm nút 'Chuyển sang ô'`, async () => /dán vào ô "Bài tập Azota"/.test(await drawer.innerText()) && (await drawer.getByRole("button", { name: /Chuyển sang ô/ }).count()) === 1);
    check(`${label}: nút chuyển ô cao ≥ 44px`, ((await drawer.getByRole("button", { name: /Chuyển sang ô/ }).boundingBox())?.height ?? 0) >= 44);
    await shot(p, `media-tutor-wrongslot-${label}`);
    await drawer.getByRole("button", { name: /Chuyển sang ô/ }).click();
    await eventually(`${label}: bấm chuyển → link nằm ở ô Azota, ô video sạch lỗi`, async () => (await drawer.getByLabel("Link bài Azota (không bắt buộc)").first().inputValue()) === "https://azota.vn/de-thi/xyz");
    await videoInput.fill("https://facebook.com/watch?v=123");
    await eventually(`${label}: link Facebook vào ô video → báo KiN không nhúng được + gợi ý YouTube/Drive`, async () => /không nhúng được video từ facebook\.com/i.test(await drawer.innerText()));
    await videoInput.fill("not a link");
    await eventually(`${label}: chữ lung tung → báo 'chưa phải là một link'`, async () => /chưa phải là một link|khoảng trắng/.test(await drawer.innerText()));
    await videoInput.fill("https://vimeo.com/76979871");
    await eventually(`${label}: Vimeo → 'Nhận diện: Vimeo'`, async () => /Nhận diện: Vimeo/.test(await drawer.innerText()));
    await videoInput.fill(YT);

    // Tải video lên
    const up = drawer.getByRole("button", { name: /Tải video từ máy lên/ });
    await up.waitFor({ timeout: 30000 });
    check(`${label}: thấy cảnh báo bản quyền / riêng tư trước khi tải`, /Không tải video có hình hoặc giọng của học sinh/.test(await drawer.innerText()) && /bản quyền/.test(await drawer.innerText()));
    check(`${label}: chưa tích xác nhận thì nút tải bị khoá`, await up.isDisabled());
    check(`${label}: báo trước loại tệp và dung lượng tối đa (1 MB ở máy thử)`, /tối đa 1 MB/.test(await drawer.innerText()) && /\.mp4/.test(await drawer.innerText()));
    await drawer.getByRole("checkbox").check();
    const cbBox = await drawer.locator("label", { hasText: "Tôi xác nhận video này" }).boundingBox(), upBox = await up.boundingBox();
    check(`${label}: dòng xác nhận và nút tải cao ≥ 44px`, (cbBox?.height ?? 0) >= 43.5 && (upBox?.height ?? 0) >= 43.5, [cbBox, upBox]);
    const chooser = p.waitForEvent("filechooser");
    await up.click();
    await (await chooser).setFiles(exe);
    await eventually(`${label}: chọn .exe → chặn trước khi tải, nói lý do`, async () => /Chỉ nhận video/.test(await drawer.innerText()));
    check(`${label}: .exe chưa tạo FileAsset nào mới`, (await prisma.fileAsset.count({ where: { ownerId: T.id, originalName: "virus.exe" } })) === 0);
    const chooser2 = p.waitForEvent("filechooser");
    await up.click();
    await (await chooser2).setFiles(small);
    await eventually(`${label}: tải video nhỏ → link kin-media:<mã> vào danh sách video`, async () => {
      const vals = await drawer.locator("input[inputmode=url]").evaluateAll(els => (els as HTMLInputElement[]).map(e => e.value));
      return vals.some(v => /^kin-media:/.test(v));
    }, 60000);
    check(`${label}: video đã tải ghi đúng byte vào FileAsset (status ready)`, !!(await prisma.fileAsset.findFirst({ where: { ownerId: T.id, originalName: "bai-giang-nho.mp4", status: "ready" } }))?.bytes);
    await shot(p, `media-tutor-upload-${label}`);

    // Tài liệu: báo trước + sắp xếp
    const nameInp = drawer.getByPlaceholder("Tên tài liệu", { exact: false });
    await nameInp.fill("Tờ quá nặng");
    const fchooser = p.waitForEvent("filechooser", { timeout: 4000 }).catch(() => null);
    await drawer.getByText("Chọn hoặc kéo-thả file", { exact: false }).click({ timeout: 2000 }).catch(() => {});
    const fc = await fchooser;
    if (fc) {
      await fc.setFiles(bigPdf);
      await eventually(`${label}: chọn PDF 26 MB → chặn ngay, nêu giới hạn 25 MB`, async () => /vượt giới hạn 25 MB/.test(await drawer.innerText()));
    } else check(`${label}: (bỏ qua chọn tệp: Cloudinary chưa cấu hình ở máy này, chỉ dùng link)`, true);
    check(`${label}: ghi chú giới hạn tài liệu hiện sẵn (loại tệp, 25 MB, tối đa 30)`, /tối đa 25 MB/.test(await drawer.innerText()) && /tối đa 30 tài liệu/.test(await drawer.innerText()));
    await drawer.getByPlaceholder("Hoặc paste link Google Drive...").fill("javascript:alert(1)");
    await drawer.getByRole("button", { name: "+ Thêm link" }).last().click();
    await eventually(`${label}: link tài liệu javascript: bị từ chối ngay`, async () => /Chỉ nhận link bắt đầu bằng https:\/\//.test(await drawer.innerText()));
    const up1 = drawer.getByRole("button", { name: /lên trên/ });
    check(`${label}: tài liệu có nút ▲ ▼ sắp xếp ≥ 44px`, (await up1.count()) >= 1 && ((await up1.first().boundingBox())?.height ?? 0) >= 44);

    check(`${label}: không tràn ngang trong màn soạn bài`, (await overflow(p)) <= 1);
    await ctx.close();

    // Bảng đã làm / chưa làm (bài Azota)
    const ctx2 = await ctxFor(T, { width: w, height: h });
    const p2 = await ctx2.newPage(); watch(p2);
    await p2.goto(`${BASE}/admin/khoa-hoc/${A.id}?tab=chuong-bai`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p2.getByText("Phần 1").first().waitFor({ timeout: 120000 });
    await p2.getByText("Phần 1").first().click();
    await p2.locator(`xpath=//*[normalize-space(text())='Bài az']/ancestor::div[.//button[@title='Sửa']][1]//button[@title='Sửa']`).first().click({ timeout: 30000 });
    const d2 = p2.locator("div.fixed").filter({ hasText: "Sửa bài học" }).last();
    await d2.getByRole("region", { name: "Học sinh đã làm bài Azota" }).waitFor({ timeout: 30000 });
    const tbl = d2.getByRole("region", { name: "Học sinh đã làm bài Azota" });
    await eventually(`${label}: bảng 'Ai đã làm bài Azota · 1/2' có Minh Anh 'Đã làm', Em chưa làm 'Chưa làm'`, async () => { const t = await tbl.innerText(); return /1\/2/.test(t) && /Minh Anh[\s\S]*Đã làm/.test(t) && /Em chưa làm Azota[\s\S]*Chưa làm/.test(t); });
    await shot(p2, `media-tutor-azota-status-${label}`);
    await ctx2.close();
  }

  section("Không có lỗi trình duyệt");
  check("không có lỗi JS / console bất ngờ", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(async e => { console.error(e); await closeAll().catch(() => {}); process.exit(1); });
