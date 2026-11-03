// BU-06b — form hồ sơ gia sư: ảnh bìa + video giới thiệu (src/app/lop-cua-toi/(tutor)/ho-so/TutorProfileForm.tsx).
// Kiểm trên trình duyệt thật, 1440 và 390: dòng nhắc "Không đăng ảnh/video có học sinh", link xấu bị chặn NGAY tại ô (không lưu nửa vời), tải ảnh thật
// (cắt 16:9, vừa ≤ 250 000 ký tự), lưu → tải lại còn nguyên, gỡ bìa / video, ảnh quá nặng không bao giờ lọt vào DB, hồ sơ công khai /mentor/[id] hiện bìa + video nhúng nocookie.
// Cần máy chủ Next ở BASE + DB RIÊNG (wipe() ở đầu bài). Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-ho-so-bia-video.ts
import { BASE, mkTutor, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { COVER_MAX_CHARS } from "@/lib/tutorSearchMedia";

const YT = "https://youtu.be/dQw4w9WgXcQ?si=abc&t=9";
const YT_CANON = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

/** Bấm "Lưu hồ sơ" cho tới khi `sel` hiện ra: ở lần mở đầu của trang mới biên dịch React có thể chưa gắn xong sự kiện, bấm sớm không có tác dụng (không phải lỗi mã). */
const clickSaveUntil = async (p: Page, sel: string) => {
  for (let i = 0; i < 6; i++) {
    await p.getByRole("button", { name: "Lưu hồ sơ" }).click();
    try { await p.locator(sel).waitFor({ timeout: 6000 }); return; } catch { /* thử lại */ }
  }
  await p.locator(sel).waitFor({ timeout: 5000 });
};

/** Đặt một tệp ảnh do chính trang vẽ ra (canvas) vào ô chọn ảnh bìa rồi bắn sự kiện change. `noise` = ảnh nhiễu (gần như không nén được). */
async function pickCover(p: Page, kind: "dep" | "nhieu") {
  await p.evaluate(async (k) => {
    const c = document.createElement("canvas"); c.width = 2400; c.height = 1400;
    const x = c.getContext("2d")!;
    if (k === "dep") { for (let i = 0; i < 60; i++) { x.fillStyle = `hsl(${(i * 37) % 360} 70% 50%)`; x.fillRect((i * 97) % 2400, (i * 53) % 1400, 500, 300); } }
    else { const d = x.createImageData(c.width, c.height); for (let i = 0; i < d.data.length; i += 4) { d.data[i] = Math.random() * 255; d.data[i + 1] = Math.random() * 255; d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); }
    const blob: Blob = await new Promise(r => c.toBlob(b => r(b!), "image/png"));
    const dt = new DataTransfer(); dt.items.add(new File([blob], "bia.png", { type: "image/png" }));
    const input = document.getElementById("cover-file") as HTMLInputElement;
    input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
  }, kind);
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  await prisma.user.update({ where: { id: T.id }, data: { subjects: ["Toán"] } });
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]\d\d|negative time stamp|youtube/i.test(m.text())) errors.push(m.text()); });
  };
  const noOverflow = (p: Page) => p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`) as Promise<boolean>;
  const row = () => prisma.user.findUnique({ where: { id: T.id }, select: { coverUrl: true, introVideoUrl: true } });
  /** Chờ DB đạt trạng thái mong đợi (thông báo "Đã lưu" của lần trước có thể còn trên màn → không tin riêng nó). Hết hạn thì trả trạng thái hiện có. */
  const waitRow = async (pred: (r: { coverUrl: string | null; introVideoUrl: string | null } | null) => boolean, ms = 25000) => {
    const t0 = Date.now(); let r = await row();
    while (!pred(r) && Date.now() - t0 < ms) { await new Promise(res => setTimeout(res, 300)); r = await row(); }
    return r;
  };
  const save = (p: Page) => p.getByRole("button", { name: "Lưu hồ sơ" });
  const open = async (p: Page) => { await p.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "domcontentloaded", timeout: 120000 }); await p.getByRole("heading", { name: "Ảnh bìa và video giới thiệu" }).waitFor({ timeout: 90000 }); };

  for (const [w, h, tag] of [[1440, 900, "1440"], [390, 844, "390"]] as const) {
    await prisma.user.update({ where: { id: T.id }, data: { coverUrl: null, introVideoUrl: null } });
    const tc = await ctxFor(T, { width: w, height: h });
    await tc.route(/fonts\.(googleapis|gstatic)\.com|youtube/, r => r.abort());
    const p = await tc.newPage(); watch(p);

    section(`[${tag}] Khu 'Ảnh bìa và video giới thiệu': nhắc không đăng ảnh/video có học sinh`);
    await open(p);
    const sec = p.locator('section[aria-labelledby="h-bia"]');
    check("có dòng 'Không đăng ảnh/video có học sinh.' (trẻ em) trong khu này", (await sec.getByTestId("luu-y-hoc-sinh").innerText()).trim() === "Không đăng ảnh/video có học sinh.");
    check("ghi rõ KiN không kiểm nội dung (tự khai)", (await sec.innerText()).includes("KiN không kiểm nội dung"));
    check("chưa có bìa: hiện khung trống chứ không ảnh giả", (await sec.getByTestId("anh-bia-xem-truoc").count()) === 0 && (await sec.innerText()).includes("Chưa có ảnh bìa"));
    check("không tràn ngang", await noOverflow(p));
    const small = await sec.locator("button").evaluateAll(els => els.filter(e => (e as HTMLElement).offsetHeight > 0 && (e as HTMLElement).getBoundingClientRect().height < 44).map(e => (e.textContent ?? "").trim()));
    check("nút trong khu này cao ≥ 44px", small.length === 0, small);
    if (tag === "390") await shot(p, "ho-so-bia-video-390");

    section(`[${tag}] Link video xấu bị chặn ngay tại ô, không lưu gì`);
    await p.locator("#video-url").fill("https://vimeo.com/123");
    await clickSaveUntil(p, "#video-err");
    check("báo 'Chỉ nhận link video YouTube' dưới ô, aria-invalid, tiêu điểm vào ô", (await p.locator("#video-err").innerText()).includes("Chỉ nhận link video YouTube") && (await p.locator("#video-url").getAttribute("aria-invalid")) === "true" && (await p.locator("#video-url").evaluate(el => el === document.activeElement)));
    check("câu báo KHÔNG chứa chữ vừa gõ", !(await p.locator("#video-err").innerText()).includes("vimeo"));
    check("DB không đổi (bìa + video vẫn null)", JSON.stringify(await row()) === JSON.stringify({ coverUrl: null, introVideoUrl: null }), await row());
    await p.locator("#video-url").fill("javascript:alert(1)");
    await p.locator("#video-err").waitFor({ state: "detached", timeout: 5000 }).catch(() => {}); // lỗi cũ biến mất khi gõ lại
    await clickSaveUntil(p, "#video-err");
    check("javascript: cũng bị chặn, DB vẫn null", (await row())?.introVideoUrl === null);

    section(`[${tag}] Chọn ảnh thật → cắt 16:9, vừa 250 KB → lưu`);
    await pickCover(p, "dep");
    const prev = sec.getByTestId("anh-bia-xem-truoc");
    await prev.waitFor({ timeout: 60000 });
    const info = await prev.evaluate(async (img: HTMLImageElement) => { await img.decode(); return { w: img.naturalWidth, h: img.naturalHeight, len: img.src.length, jpeg: img.src.startsWith("data:image/jpeg;base64,") }; });
    check("ảnh xem trước là JPEG 960×540 (16:9), ≤ 250 000 ký tự", info.jpeg && info.w === 960 && info.h === 540 && info.len <= COVER_MAX_CHARS, info);
    check("chưa bấm Lưu thì DB chưa đổi", (await row())?.coverUrl === null);
    await p.locator("#video-url").fill(YT);
    await save(p).click();
    const r1 = await waitRow(r => !!r?.coverUrl && !!r.introVideoUrl);
    check("DB: bìa là data URL JPEG ≤ 250 000 ký tự", !!r1?.coverUrl && r1.coverUrl.startsWith("data:image/jpeg;base64,") && r1.coverUrl.length <= COVER_MAX_CHARS, r1?.coverUrl?.length);
    check("DB: video lưu dạng CHUẨN (không '?si=', không chữ gõ)", r1?.introVideoUrl === YT_CANON, r1?.introVideoUrl);
    check("ô video hiện lại link chuẩn sau khi lưu", (await p.locator("#video-url").inputValue()) === YT_CANON);

    section(`[${tag}] Tải lại: còn nguyên; hồ sơ công khai hiện bìa + video`);
    await open(p);
    check("tải lại: xem trước bìa + ô video điền sẵn", (await sec.getByTestId("anh-bia-xem-truoc").count()) === 1 && (await p.locator("#video-url").inputValue()) === YT_CANON);
    const pubCtx = await ctxFor(null, { width: w, height: h });
    await pubCtx.route(/fonts\.(googleapis|gstatic)\.com|youtube/, r => r.abort());
    const pub = await pubCtx.newPage(); watch(pub);
    await pub.goto(`${BASE}/mentor/${T.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await pub.locator("[data-cover]").waitFor({ timeout: 90000 });
    check("khách mở /mentor/[id]: có ảnh bìa (img data:image/jpeg)", (await pub.locator("[data-cover] img").getAttribute("src"))?.startsWith("data:image/jpeg;base64,") === true);
    const vid = pub.locator("[data-intro-video]");
    await vid.waitFor({ timeout: 60000 });
    check("trước khi bấm phát: KHÔNG có iframe trong DOM (không gọi YouTube khi chỉ mở trang)", (await vid.locator("iframe").count()) === 0);
    check("có liên kết 'Xem trên YouTube' trỏ đúng link chuẩn", (await vid.getByRole("link", { name: "Xem trên YouTube" }).getAttribute("href")) === YT_CANON);
    await vid.getByRole("button", { name: /Phát video giới thiệu/ }).click();
    const frame = await vid.locator("iframe").first().getAttribute("src").catch(() => null);
    check("bấm phát: nhúng youtube-nocookie, đúng mã", !!frame && frame.startsWith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"), frame);
    check("nguồn trang công khai không chứa '?si=' hay chữ gõ thô", !(await pub.content()).includes("si=abc"));
    await pubCtx.close();

    section(`[${tag}] Ảnh nhiễu (gần như không nén được): hoặc vừa giới hạn, hoặc báo lỗi — không bao giờ vượt 250 KB trong DB`);
    await pickCover(p, "nhieu");
    await p.waitForTimeout(6000);
    const nz = await sec.getByTestId("anh-bia-xem-truoc").evaluate((img: HTMLImageElement) => img.src.length).catch(() => 0);
    const errShown = await p.getByText("Ảnh này nặng quá").count();
    check("ảnh nhiễu: xem trước luôn còn và ≤ 250 000 ký tự (ảnh mới vừa giới hạn, hoặc báo 'nặng quá' và giữ ảnh cũ)", nz > 0 && nz <= COVER_MAX_CHARS, { nz, errShown });
    await save(p).click();
    await p.getByText("Đã lưu hồ sơ.").first().waitFor({ timeout: 30000 });
    await new Promise(res => setTimeout(res, 1500));
    const r2 = await row();
    check("sau khi lưu: DB không bao giờ có bìa > 250 000 ký tự", (r2?.coverUrl?.length ?? 0) <= COVER_MAX_CHARS, r2?.coverUrl?.length);

    section(`[${tag}] Gỡ bìa + gỡ video`);
    await sec.getByRole("button", { name: "Gỡ ảnh bìa" }).click();
    await p.locator("#video-url").fill("");
    await save(p).click();
    const r3 = await waitRow(r => r?.coverUrl === null && r?.introVideoUrl === null);
    check("gỡ: DB bìa = null, video = null", JSON.stringify(r3) === JSON.stringify({ coverUrl: null, introVideoUrl: null }), r3);
    check("gỡ: khung 'Chưa có ảnh bìa' quay lại", (await sec.getByTestId("anh-bia-xem-truoc").count()) === 0);
    check("không tràn ngang sau các thao tác", await noOverflow(p));
    await tc.close();
  }
  check("không có lỗi console / pageerror", errors.length === 0, errors.slice(0, 4));
  await closeAll(); done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
