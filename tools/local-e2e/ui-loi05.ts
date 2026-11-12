// LOI-05 mục 5 — Tìm gia sư (/giang-vien) và hồ sơ (/mentor/<id>) làm lại, trình duyệt thật, 1600×900 và 390×844. Ảnh: scratchpad/shots/loi05-*.png.
// Đọc cờ bằng featureOn("TIM_GIA_SU") — PHẢI đặt cùng NEXT_PUBLIC_KIN_MO_TIM_GIA_SU cho máy chủ dev và cho bài này:
//   BẬT: lưới 3 cột (1600) / 1 cột (390), tên dài hiện ĐỦ (chữ = tên, không tràn, không ellipsis/line-clamp/nowrap), ảnh / chữ cái đầu, giá "tự khai" chỉ ở người có giá,
//        không ★ / "đã xác minh", không tràn ngang, nút/link ≥ 44px, lọc Môn / Khu vực / Online đổi kết quả + URL, ô tìm tự áp sau 400 ms, tham số cũ bị bỏ qua,
//        tờ lọc 390 (dialog aria-modal, khoá cuộn, Esc, trả tiêu điểm, Tab vòng trong hộp), rỗng có lọc + Xóa lọc, rỗng không lọc, lỗi + Thử lại, khung chờ, Xem thêm.
//   TẮT: /giang-vien 307; hồ sơ vẫn mở, không "Quay lại danh sách", lối đi tiếp "Xem lớp đang mở".
//   Cả hai: hồ sơ 390 + 1600 — tên dài đủ, Gửi yêu cầu, giá "tự khai", thứ tự khối ở 390, cột phải ở 1600, không tab (?tab= cũ bỏ qua), id sai / ẩn / khoá ⇒ "Không tìm thấy gia sư này".
// Dữ liệu tự tạo (wipe() trên DB riêng của worktree): tên rất dài, người không ảnh, người không giá. Ảnh là PNG tự sinh bằng mã (không ra mạng); ảnh nhỏ YouTube bị chặn route trả PNG.
// Lọc có chủ đích: console.error React 19 về <script> chủ đề ở src/app/layout.tsx ("Encountered a script tag") — có sẵn trên main.
import { mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { BASE, mkUser, mkTutor, mkCourse, mkAttendanceSession, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot as rawShot, closeAll, kinSelect, kinSelectValue, type Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { featureOn } from "@/lib/features";
import { vnDateKeyOf } from "@/lib/classSessions";

const SAN = featureOn("TIM_GIA_SU");
mkdirSync(process.env.SHOTS ?? "scratchpad/shots", { recursive: true });

// ── PNG tự sinh (RGB, dải màu ngang) để mỗi gia sư một ảnh, không tải mạng ──
function crc32(buf: Buffer) { let c = 0xffffffff; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Buffer) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "ascii"), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w: number, h: number, a: [number, number, number], b: [number, number, number]) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const t = (x + y) / (w + h); const o = y * (w * 3 + 1) + 1 + x * 3; for (let i = 0; i < 3; i++) raw[o + i] = Math.round(a[i] * (1 - t) + b[i] * t); }
  const bytes = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}
const PNG_THUMB = Buffer.from(png(16, 9, [40, 40, 60], [90, 90, 120]).split(",")[1], "base64");

const LONG = "Nguyễn Trần Hoàng Bảo Ngọc Phương Thảo Uyên Nhi Khánh Linh Tôn Nữ Minh Châu";
const NOIMG = "Trần Văn Bình";        // không ảnh, online, không giá, bio trống
const NOPRICE = "Lê Thu Hà";          // có ảnh, dạy trực tiếp, Đà Nẵng, không giá
const PRICED = "Phạm Minh Quân";      // đủ: ảnh, bìa, video, Zalo, giá, lớp miễn phí + lớp có học phí, số buổi đã dạy
const NOAREA = "Đỗ Khải";             // không ảnh, chưa khai khu vực / hình thức
const ALL = [LONG, NOIMG, NOPRICE, PRICED, NOAREA];
const VIDEO_ID = "dQw4w9WgXcQ";

// Chụp sau khi hiệu ứng vào trang (.page-enter mờ dần) chạy xong — không thì ảnh bị nhạt.
async function shot(page: Page, name: string) {
  await page.waitForFunction(`document.getAnimations().every(function (a) { return a.playState !== "running"; })`, undefined, { timeout: 10000 }).catch(() => undefined);
  await rawShot(page, name);
}
const params = (u: string) => new URL(u).searchParams;
const NOT_OVERFLOW = `document.documentElement.scrollWidth <= window.innerWidth + 1`;

// Chuỗi mã (không phải hàm có tên): tsx/esbuild chèn __name() vào hàm có tên mà trình duyệt không có.
async function measure(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-agentation-root] { display: none !important; }" });
  return page.evaluate(`(() => {
    var root = document.querySelector("[data-san-gia-su],[data-ho-so],[data-ho-so-khong-thay]") || document.body;
    var vis = function (e) { var r = e.getBoundingClientRect(); var st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
    var small = Array.prototype.slice.call(root.querySelectorAll('a,button,select,input:not([type=hidden])'))
      .filter(function (e) { return vis(e) && !e.closest('[data-kin-toast],nextjs-portal') && !e.disabled && e.getBoundingClientRect().height < 43.5; })
      .map(function (e) { return e.tagName + ":" + (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30) + ":" + Math.round(e.getBoundingClientRect().height); });
    var txt = root.textContent || "";
    return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1, small: small, stars: txt.indexOf("\\u2605") >= 0 || /\\d[.,]\\d\\s*\\/\\s*5\\b|đánh giá|đã xác minh|Đã duyệt hồ sơ|uy tín/i.test(txt) };
  })()`) as Promise<{ overflow: boolean; small: string[]; stars: boolean }>;
}

// Tên gia sư: chữ trong DOM = tên, không tràn ngang/dọc, không text-overflow:ellipsis, không -webkit-line-clamp, không nowrap (cả thẻ tên lẫn liên kết bên trong).
type NameBox = { text: string; sw: number; cw: number; sh: number; ch: number; styles: string[]; h: number };
async function names(page: Page) {
  return page.evaluate(`(() => Array.prototype.map.call(document.querySelectorAll("[data-ten-gia-su]"), function (h) {
    var els = [h].concat(Array.prototype.slice.call(h.querySelectorAll("*")));
    return { text: (h.textContent || "").replace(/\\s+/g, " ").trim(), sw: h.scrollWidth, cw: h.clientWidth, sh: h.scrollHeight, ch: h.clientHeight, h: h.getBoundingClientRect().height,
      styles: els.map(function (e) { var s = getComputedStyle(e); return [s.textOverflow, s.webkitLineClamp || s.getPropertyValue("-webkit-line-clamp") || "none", s.whiteSpace].join("|"); }) };
  }))()`) as Promise<NameBox[]>;
}
const nameOk = (b: NameBox) => b.sw <= b.cw + 1 && b.sh <= b.ch + 1 && b.styles.every(s => !/ellipsis/.test(s) && /^[^|]*\|(none|)\|/.test(s) && !/nowrap/.test(s));

async function gridColumns(page: Page) {
  return page.evaluate(`(() => {
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-the-gia-su]"));
    if (!cards.length) return { cols: 0, minW: 0 };
    var top = cards[0].getBoundingClientRect().top, lefts = {}, minW = 1e9;
    cards.forEach(function (c) { var r = c.getBoundingClientRect(); minW = Math.min(minW, r.width); if (Math.abs(r.top - top) < 4) lefts[Math.round(r.left)] = 1; });
    return { cols: Object.keys(lefts).length, minW: Math.round(minW) };
  })()`) as Promise<{ cols: number; minW: number }>;
}
const cardNames = async (page: Page) => (await page.locator("[data-the-gia-su] [data-ten-gia-su]").allInnerTexts()).map(t => t.replace(/\s+/g, " ").trim()).sort();
const same = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

(async () => {
  await wipe();
  const mk = async (name: string, data: Parameters<typeof prisma.user.update>[0]["data"]) => { const u = await mkTutor(name); await prisma.user.update({ where: { id: u.id }, data }); return u; };
  const T_LONG = await mk(LONG, {
    avatarBase64: png(128, 128, [30, 80, 160], [120, 190, 230]),
    subjects: ["Toán 9", "Vật lý 12", "Hoá học 10", "Ngữ văn 8", "Tiếng Anh lớp 5", "Sinh học 11"], city: "Hà Nội",
    bio: "Mình dạy Toán và Vật lý cho học sinh THCS, THPT.\nLớp nhỏ, theo sát từng em, có bài tập về nhà mỗi buổi và nhắn phụ huynh tình hình sau mỗi tháng. Ưu tiên các em mất gốc cần lấy lại nền tảng trước kỳ thi vào lớp 10.",
    preferences: { teaching: { district: "Cầu Giấy", mode: "both", price: 200000, showPrice: true, credential: "Đại học Sư phạm Hà Nội, cử nhân Sư phạm Toán" } },
  });
  const T_NOIMG = await mk(NOIMG, { subjects: ["Vật lý 12"], city: "TP. Hồ Chí Minh", bio: null, preferences: { teaching: { district: "Quận 3", mode: "online" } } });
  const T_NOPRICE = await mk(NOPRICE, { avatarBase64: png(128, 128, [170, 60, 90], [240, 170, 120]), subjects: ["Tiếng Anh lớp 5"], city: "Đà Nẵng", bio: "Dạy tiếng Anh tiểu học, phát âm và giao tiếp.", preferences: { teaching: { mode: "offline", price: 180000 } } });
  const T_PRICED = await mk(PRICED, {
    avatarBase64: png(128, 128, [40, 120, 80], [180, 220, 140]), coverUrl: png(320, 120, [20, 40, 90], [90, 160, 200]), introVideoUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    subjects: ["Toán 9"], city: "Hà Nội", phone: "0901234567", bio: "Gia sư Toán 9, ôn thi vào 10.",
    preferences: { teaching: { district: "Đống Đa", mode: "offline", price: 150000, showPrice: true }, connections: { showZalo: true } },
  });
  await mk(NOAREA, { subjects: ["Hoá học 10"], bio: "Hoá học lớp 10 cơ bản." });
  const LOCKED = await mk("Cô Bị Khoá Hồ Sơ", { subjects: ["Toán 9"], profileLockedAt: new Date() });
  const HIDDEN = await mk("Cô Ẩn Hồ Sơ", { subjects: ["Toán 9"], preferences: { profile: { hidden: true } } });
  const S = await mkUser({ name: "Em Học Sinh Kín Tên" });

  const cFree = await mkCourse(T_PRICED.id, { name: "Toán 9 miễn phí buổi tối" });
  await prisma.course.update({ where: { id: cFree.id }, data: { joinPolicy: "open", tag: "Miễn phí" } });
  const cPaid = await mkCourse(T_PRICED.id, { name: "Toán 9 ôn thi vào 10" });
  await prisma.course.update({ where: { id: cPaid.id }, data: { joinPolicy: "approve", price: 500000 } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: cPaid.id, status: "active" } });
  await prisma.courseReview.create({ data: { userId: S.id, courseId: cPaid.id, rating: 5, comment: "tốt", status: "approved" } }); // API có rating ⇒ giao diện vẫn không được vẽ
  await mkAttendanceSession(cPaid.id, T_PRICED.id, new Date(`${vnDateKeyOf(new Date(Date.now() - 86_400_000))}T00:00:00Z`));
  const cLong = await mkCourse(T_LONG.id, { name: "Vật lý 12 luyện đề" });
  await prisma.course.update({ where: { id: cLong.id }, data: { joinPolicy: "open", tag: "Miễn phí" } });

  await launch();
  const errors: string[] = [];
  const newPage = async (w: number, h: number, u: Parameters<typeof ctxFor>[0] = null) => {
    const ctx = await ctxFor(u, { width: w, height: h });
    await ctx.route("https://i.ytimg.com/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG_THUMB }));
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|Encountered a script tag/i.test(m.text())) errors.push(m.text()); });
    return { ctx, page: p };
  };
  // Next dev truyền trang theo luồng: nội dung nằm trong <div hidden id="S:n"> rồi mới được tráo vào — chờ hết mẫu ẩn trước khi đo/đếm.
  const settle = (p: Page) => p.waitForFunction(`!document.querySelector('div[hidden][id^="S:"]')`, undefined, { timeout: 60000 }).catch(() => undefined);
  const goto = async (p: Page, url: string, ready: string) => { await p.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 120000 }); await p.locator(ready).first().waitFor({ timeout: 90000 }); await settle(p); };
  const listReady = async (p: Page, url = "/giang-vien") => { await goto(p, url, "[data-the-gia-su],[data-kin-empty]"); await p.locator("[data-luoi-cho]").waitFor({ state: "detached", timeout: 60000 }).catch(() => undefined); };

  // ═════════════════════════ Danh sách — cờ BẬT
  if (SAN) {
    for (const [label, w, h] of [["1600", 1600, 900], ["390", 390, 844]] as const) {
      section(`Tìm gia sư — ${label}px (cờ bật)`);
      const { ctx, page } = await newPage(w, h);
      await listReady(page);
      check("H1 'Tìm gia sư' + câu 'Hồ sơ do gia sư tự khai. Xem miễn phí, không cần tài khoản.'", await page.getByRole("heading", { level: 1, name: "Tìm gia sư" }).isVisible() && await page.getByText("Hồ sơ do gia sư tự khai. Xem miễn phí, không cần tài khoản.").isVisible());
      await eventually("dòng đếm role=status: '5 gia sư'", async () => (await page.locator("[data-san-gia-su-client] > p[role=status]").innerText()).trim() === "5 gia sư");
      check("chỉ gia sư công khai: đúng 5 thẻ, không thấy người bị khoá / ẩn", same(await cardNames(page), ALL), await cardNames(page));
      const g = await gridColumns(page);
      check(`lưới ${w === 1600 ? 3 : 1} cột thật (đo vị trí thẻ)`, g.cols === (w === 1600 ? 3 : 1), g);
      check(`thẻ không hẹp hơn 320px (hẹp nhất ${g.minW}px)`, g.minW >= 320, g);

      const nb = await names(page);
      const longBox = nb.find(b => b.text === LONG);
      check("tên rất dài: chữ trong DOM = TÊN ĐẦY ĐỦ", !!longBox, nb.map(b => b.text));
      check("mọi tên: không tràn, không ellipsis, không line-clamp, không nowrap", nb.length === 5 && nb.every(nameOk), nb.filter(b => !nameOk(b)));
      check("tên rất dài xuống dòng tự nhiên (cao hơn một dòng)", !!longBox && longBox.h > 40, longBox?.h);

      const card = (n: string) => page.locator("[data-the-gia-su]").filter({ has: page.locator("[data-ten-gia-su]", { hasText: n }) });
      const img = card(LONG).locator('[data-anh-gia-su="anh"] img');
      const ib = await img.boundingBox();
      check(`ảnh tròn hiện thật (${w === 1600 ? 96 : 88}px)`, !!ib && Math.round(ib.width) === (w === 1600 ? 96 : 88) && await img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0), ib);
      check("người không ảnh: khối chữ cái đầu 'TB'", (await card(NOIMG).locator('[data-anh-gia-su="chu"]').innerText()).trim() === "TB");
      const tLong = await card(LONG).innerText(), tPriced = await card(PRICED).innerText();
      check("có giá: '200.000đ / buổi · giá tham khảo, tự khai' và '150.000đ …'", tLong.includes("200.000đ / buổi · giá tham khảo, tự khai") && tPriced.includes("150.000đ / buổi · giá tham khảo, tự khai"), [tLong, tPriced]);
      const noPrice = [await card(NOIMG).innerText(), await card(NOPRICE).innerText(), await card(NOAREA).innerText()];
      check("không giá (kể cả lưu giá mà TẮT hiện): không 'tự khai', không 'đ / buổi', không 'Liên hệ'", noPrice.every(t => !/tự khai|đ \/ buổi|Liên hệ/.test(t)), noPrice);
      check("thẻ đủ chữ: cấp lớp 'Lớp 5, 8–12', khu vực 'Hà Nội · Cầu Giấy', hình thức, '+2 môn', giới thiệu", /Lớp 5, 8–12/.test(tLong) && tLong.includes("Hà Nội · Cầu Giấy") && tLong.includes("Online + dạy trực tiếp") && tLong.includes("+2 môn") && (await card(LONG).locator("[data-gioi-thieu]").count()) === 1, tLong);
      check("người chưa khai khu vực: không dòng Khu vực / Hình thức (không in 'chưa khai')", !/Khu vực|Hình thức|chưa khai/.test(await card(NOAREA).innerText()));
      const xem = page.getByRole("link", { name: `Xem hồ sơ ${PRICED}` });
      check("nút 'Xem hồ sơ' (aria-label có tên) → /mentor/<id>, tên cũng là liên kết cùng đích", (await xem.getAttribute("href")) === `/mentor/${T_PRICED.id}` && (await card(PRICED).locator("[data-ten-gia-su] a").getAttribute("href")) === `/mentor/${T_PRICED.id}`);
      const xb = await xem.boundingBox(), cb = await card(PRICED).boundingBox();
      check("'Xem hồ sơ' full bề ngang thẻ, ≥ 44px", !!xb && !!cb && xb.height >= 44 && xb.width >= cb.width - 42, { xb, cb });
      if (w === 1600) {
        const bottoms = await page.evaluate(`(() => { var cs = Array.prototype.slice.call(document.querySelectorAll("[data-the-gia-su]")).slice(0, 3); return cs.map(function (c) { return Math.round(c.getBoundingClientRect().bottom); }); })()`) as number[];
        check("thẻ cùng hàng cao bằng nhau (đáy trùng nhau)", new Set(bottoms).size === 1, bottoms);
        check("không cột lọc trái: hàng lọc nằm TRÊN lưới", ((await page.locator("[data-hang-loc]").boundingBox())?.y ?? 1e9) < ((await page.locator("[data-luoi-gia-su]").boundingBox())?.y ?? 0));
      }

      const m = await measure(page);
      check(`nút/ô bấm trong trang ≥ 44px (${label})`, m.small.length === 0, m.small);
      check(`không tràn ngang (${label})`, !m.overflow);
      check("không ★ / điểm / 'đã xác minh' / 'Đã duyệt hồ sơ' / 'uy tín'", !m.stars);
      await shot(page, `loi05-danh-sach-${label}`);

      if (w === 1600) {
        section("1600 — hàng lọc ngang: Môn · Khu vực · Online · ô tìm · Xóa lọc");
        check("không có nút 'Lọc (n)' ở 1600; 'Xóa lọc' chưa hiện khi chưa lọc", !(await page.getByRole("button", { name: /^Lọc \(/ }).isVisible()) && !(await page.getByRole("button", { name: "Xóa lọc" }).isVisible()));
        await kinSelect(page.getByRole("combobox", { name: "Môn" }).first(), { label: "Vật lý 12" });
        await page.waitForURL(u => u.searchParams.get("subject") === "Vật lý 12", { timeout: 30000 });
        await eventually("Môn 'Vật lý 12': còn đúng 2 gia sư dạy môn đó", async () => same(await cardNames(page), [LONG, NOIMG]));
        const clear = page.getByRole("button", { name: "Xóa lọc" });
        await clear.click();
        await page.waitForURL(u => u.search === "", { timeout: 30000 });
        await eventually("Xóa lọc: URL sạch, đủ 5 thẻ", async () => (await cardNames(page)).length === 5);

        await kinSelect(page.getByRole("combobox", { name: "Khu vực" }).first(), { label: "Đà Nẵng" });
        await page.waitForURL(u => u.searchParams.get("city") === "Đà Nẵng", { timeout: 30000 });
        await eventually("Khu vực 'Đà Nẵng': chỉ Lê Thu Hà", async () => same(await cardNames(page), [NOPRICE]));
        await clear.click();
        await page.waitForURL(u => u.search === "", { timeout: 30000 });

        const online = page.getByRole("button", { name: "Online", exact: true });
        await online.click();
        await page.waitForURL(u => u.searchParams.get("mode") === "online", { timeout: 30000 });
        await eventually("Hình thức Online: người dạy online + cả hai (không người dạy trực tiếp / chưa khai)", async () => same(await cardNames(page), [LONG, NOIMG]));
        check("nút Online aria-pressed=true, 'Tất cả' = false", (await online.getAttribute("aria-pressed")) === "true" && (await page.getByRole("button", { name: "Tất cả", exact: true }).getAttribute("aria-pressed")) === "false");
        await page.getByRole("button", { name: "Tất cả", exact: true }).click();
        await page.waitForURL(u => !u.searchParams.has("mode"), { timeout: 30000 });

        const box = page.getByRole("searchbox", { name: /Tìm gia sư/ });
        await box.fill("Phạm Minh");
        await page.waitForURL(u => u.searchParams.get("q") === "Phạm Minh", { timeout: 30000 });
        await eventually("ô tìm tự áp sau khi dừng gõ (không bấm Enter): chỉ Phạm Minh Quân", async () => same(await cardNames(page), [PRICED]));
        await box.fill("zzzkhongcoai");
        await box.press("Enter");
        await page.locator("[data-kin-empty]").waitFor({ timeout: 30000 });
        const empty = await page.locator("[data-kin-empty]").innerText();
        check("rỗng có lọc: nêu 'từ khóa \"zzzkhongcoai\"' + nút Xóa lọc", empty.includes('từ khóa "zzzkhongcoai"') && await page.locator("[data-kin-empty]").getByRole("button", { name: "Xóa lọc" }).isVisible(), empty);
        await page.locator("[data-kin-empty]").getByRole("button", { name: "Xóa lọc" }).click();
        await page.waitForURL(u => u.search === "", { timeout: 30000 });
        await eventually("Xóa lọc từ trạng thái rỗng: đủ 5 thẻ, ô tìm trống lại", async () => (await cardNames(page)).length === 5 && (await box.inputValue()) === "");

        await listReady(page, "/giang-vien?grade=9&district=Qu%E1%BA%ADn%203&priceMin=999999&active=1&sort=price_asc&mode=%3Cscript%3E");
        await eventually("tham số cũ (grade, district, priceMin, active, sort) và mode rác bị bỏ qua: đủ 5 thẻ", async () => (await cardNames(page)).length === 5);
        await listReady(page, "/giang-vien?subject=V%E1%BA%ADt%20l%C3%BD%2012");
        await eventually("F5 / mở link có lọc: kết quả theo URL", async () => same(await cardNames(page), [LONG, NOIMG]));
        check("ô chọn Môn hiện đúng giá trị trên URL", (await page.getByRole("combobox", { name: "Môn", exact: true }).inputValue()) === "Vật lý 12");
      } else {
        section("390 — nút 'Lọc (n)' + tờ trượt");
        check("390: không có hàng ô chọn (Môn / Khu vực ẩn), có nút 'Lọc (0)'", !(await page.getByRole("combobox", { name: "Môn", exact: true }).isVisible()) && await page.getByRole("button", { name: "Lọc (0)" }).isVisible());
        const opener = page.getByRole("button", { name: /^Lọc \(\d+\)$/ });
        await opener.click();
        const dlg = page.getByRole("dialog", { name: "Lọc gia sư" });
        await dlg.waitFor({ timeout: 15000 });
        check("tờ lọc là dialog aria-modal, khoá cuộn nền", (await dlg.getAttribute("aria-modal")) === "true" && (await page.evaluate("document.body.style.overflow")) === "hidden");
        check("tờ lọc có Môn, Khu vực, Hình thức, 'Xem kết quả', 'Xóa lọc', 'Đóng'", await dlg.getByRole("combobox", { name: "Môn" }).isVisible() && await dlg.getByRole("combobox", { name: "Khu vực" }).isVisible() && await dlg.getByRole("button", { name: "Dạy trực tiếp" }).isVisible() && await dlg.getByRole("button", { name: "Xem kết quả" }).isVisible() && await dlg.getByRole("button", { name: "Xóa lọc" }).isVisible() && await dlg.getByRole("button", { name: "Đóng" }).isVisible());
        for (let i = 0; i < 10; i++) await page.keyboard.press("Tab");
        check("Tab vòng trong hộp (10 lần Tab vẫn ở trong tờ lọc)", await page.evaluate(`!!(document.activeElement && document.activeElement.closest("[data-to-loc]"))`) as boolean);
        const md = await measure(page);
        check("tờ lọc: nút ≥ 44px, không tràn ngang", md.small.length === 0 && !md.overflow, md);
        await page.screenshot({ path: `${process.env.SHOTS ?? "scratchpad/shots"}/loi05-to-loc-390.png` }); // tờ trượt cố định theo khung nhìn: chụp khung nhìn, không fullPage
        await page.keyboard.press("Escape");
        await dlg.waitFor({ state: "detached", timeout: 15000 });
        await eventually("Esc đóng, mở lại cuộn nền, trả tiêu điểm về nút 'Lọc (0)'", async () => (await page.evaluate("document.body.style.overflow")) !== "hidden" && (await page.evaluate(`document.activeElement && document.activeElement.textContent`)) === "Lọc (0)", 3000);
        await opener.click();
        await dlg.waitFor({ timeout: 15000 });
        await kinSelect(dlg.getByRole("combobox", { name: "Môn" }).first(), { label: "Tiếng Anh lớp 5" });
        check("đổi trong tờ lọc chưa ghi URL (bản nháp)", !params(page.url()).has("subject"));
        await dlg.getByRole("button", { name: "Xem kết quả" }).click();
        await dlg.waitFor({ state: "detached", timeout: 15000 });
        await page.waitForURL(u => u.searchParams.get("subject") === "Tiếng Anh lớp 5", { timeout: 30000 });
        await eventually("'Xem kết quả': URL có subject, chỉ người dạy Tiếng Anh lớp 5, nút thành 'Lọc (1)'", async () => same(await cardNames(page), [LONG, NOPRICE]) && await page.getByRole("button", { name: "Lọc (1)" }).isVisible());
        await page.getByRole("button", { name: "Lọc (1)" }).click();
        await dlg.waitFor({ timeout: 15000 });
        await dlg.getByRole("button", { name: "Online" }).click();
        await dlg.getByRole("button", { name: "Xóa lọc" }).click();
        check("'Xóa lọc' trong tờ: Môn về 'Tất cả môn', Hình thức về 'Tất cả'", (await kinSelectValue(dlg.getByRole("combobox", { name: "Môn" }).first())) === "" && (await dlg.getByRole("button", { name: "Tất cả" }).getAttribute("aria-pressed")) === "true");
        await dlg.getByRole("button", { name: "Xem kết quả" }).click();
        await page.waitForURL(u => u.search === "", { timeout: 30000 });
        await eventually("áp lọc rỗng: đủ 5 thẻ, 'Lọc (0)'", async () => (await cardNames(page)).length === 5 && await page.getByRole("button", { name: "Lọc (0)" }).isVisible());
        await page.getByRole("button", { name: "Lọc (0)" }).click();
        await dlg.waitFor({ timeout: 15000 });
        await dlg.getByRole("button", { name: "Đóng" }).click();
        await dlg.waitFor({ state: "detached", timeout: 15000 });
        check("nút 'Đóng' đóng tờ lọc", (await dlg.count()) === 0);
      }
      await ctx.close();
    }

    section("Ba trạng thái + Xem thêm (390)");
    {
      const { ctx, page } = await newPage(390, 844);
      let fail = true;
      await page.route("**/api/tutors?**", r => (fail ? r.abort() : r.continue()));
      await page.goto(`${BASE}/giang-vien?city=H%C3%A0%20N%E1%BB%99i`, { waitUntil: "domcontentloaded", timeout: 120000 });
      const alert = page.getByRole("alert").filter({ hasText: "Chưa tải được danh sách gia sư" });
      await alert.waitFor({ timeout: 60000 });
      check("lỗi: KinStateCard role=alert + nút 'Thử lại', bộ lọc vẫn trên URL", await alert.getByRole("button", { name: "Thử lại" }).isVisible() && params(page.url()).get("city") === "Hà Nội");
      fail = false;
      await alert.getByRole("button", { name: "Thử lại" }).click();
      await eventually("Thử lại ⇒ có dữ liệu theo bộ lọc giữ nguyên (Hà Nội: 2 người)", async () => same(await cardNames(page), [LONG, PRICED]));
      await page.unroute("**/api/tutors?**");

      await page.route("**/api/tutors?**", async r => { await new Promise(res => setTimeout(res, 2500)); await r.continue(); });
      await page.goto(`${BASE}/giang-vien`, { waitUntil: "domcontentloaded" });
      check("đang tải: 6 khung chờ cùng dáng thẻ + 'Đang tải…'", await page.locator("[data-the-gia-su-cho]").first().waitFor({ timeout: 30000 }).then(async () => (await page.locator("[data-the-gia-su-cho]").count()) === 6, () => false));
      await page.unroute("**/api/tutors?**");

      await page.route("**/api/tutors?**", r => r.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 24, hasMore: false, facets: { subjects: [], cities: [], modes: { online: 0, offline: 0 } } } }));
      await page.goto(`${BASE}/giang-vien`, { waitUntil: "domcontentloaded" });
      const e0 = page.locator("[data-kin-empty]", { hasText: "Chưa có gia sư nào mở hồ sơ công khai." });
      await e0.waitFor({ timeout: 60000 });
      check("rỗng không lọc: 'Chưa có gia sư nào mở hồ sơ công khai.' + liên kết 'Xem lớp đang mở' → /khoa-hoc", (await e0.getByRole("link", { name: "Xem lớp đang mở" }).getAttribute("href")) === "/khoa-hoc");
      await page.unroute("**/api/tutors?**");

      for (let i = 1; i <= 22; i++) await mk(`Gia sư thêm ${String(i).padStart(2, "0")}`, { subjects: [i % 2 ? "Toán 9" : "Ngữ văn 8"] });
      await listReady(page);
      await eventually("27 gia sư: trang 1 có 24 thẻ + 'Xem thêm gia sư'", async () => (await page.locator("[data-the-gia-su]").count()) === 24 && await page.getByRole("button", { name: "Xem thêm gia sư" }).isVisible());
      await page.getByRole("button", { name: "Xem thêm gia sư" }).click();
      await eventually("Xem thêm nối (không thay): 27 thẻ, không trùng, hết nút Xem thêm", async () => {
        const ids = await page.locator("[data-the-gia-su]").evaluateAll((es: Element[]) => es.map(e => e.getAttribute("data-the-gia-su")));
        return ids.length === 27 && new Set(ids).size === 27 && !(await page.getByRole("button", { name: "Xem thêm gia sư" }).isVisible());
      }, 20000);
      check("390 sau Xem thêm: không tràn ngang", await page.evaluate(NOT_OVERFLOW) as boolean);
      await ctx.close();
    }
  } else {
    section("Cờ TẮT — sàn /giang-vien bị chặn");
    for (const path of ["/giang-vien", "/giang-vien?subject=To%C3%A1n%209"]) {
      const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
      check(`${path} → 307 (không 200, không 308)`, r.status === 307, [r.status, r.headers.get("location")]);
    }
  }

  // ═════════════════════════ Hồ sơ (cả hai nhánh cờ)
  for (const [label, w, h] of [["1600", 1600, 900], ["390", 390, 844]] as const) {
    section(`Hồ sơ — ${label}px (khách, cờ ${SAN ? "bật" : "tắt"})`);
    const { ctx, page } = await newPage(w, h);
    const res = await page.goto(`${BASE}/mentor/${T_PRICED.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.locator("[data-ho-so-dau]").first().waitFor({ timeout: 90000 }); await settle(page);
    check("hồ sơ 200, có tên trong H1 (không còn 'Chưa mở được hồ sơ')", res?.status() === 200 && (await page.locator("[data-ho-so] h1[data-ten-gia-su]").innerText()).trim() === PRICED && (await page.locator("[data-ho-so-loi]").count()) === 0);
    check("ảnh bìa + ảnh tròn hiện", await page.locator("[data-cover] img").isVisible() && await page.locator('[data-ho-so-dau] [data-anh-gia-su="anh"] img').isVisible());
    const html = (await page.content()).replace(/zalo\.me\/\+?\d+/g, "zalo.me/·");
    check("HTML không nhúng số điện thoại / email / tên học sinh / preferences thô", !/0901234567|901234567|@test\.local|Em Học Sinh Kín Tên|"preferences"|introVideoUrl/.test(html));
    const req = page.getByRole("link", { name: "Gửi yêu cầu" }).filter({ visible: true });
    check("đúng một nút 'Gửi yêu cầu' nhìn thấy → /mentor/<id>/yeu-cau", (await req.count()) === 1 && (await req.getAttribute("href")) === `/mentor/${T_PRICED.id}/yeu-cau`);
    check("'Nhắn Zalo' (gia sư bật) là liên kết zalo.me", /zalo\.me\//.test((await page.getByRole("link", { name: "Nhắn Zalo" }).getAttribute("href")) ?? ""));
    const gia = page.locator("[data-gia-tham-khao]");
    check("giá: đúng một khối, '150.000đ / buổi' + 'tự khai' + 'KiN không thu hộ'", (await gia.count()) === 1 && /150\.000đ \/ buổi/.test(await gia.innerText()) && /tự khai/.test(await gia.innerText()) && /KiN không thu hộ/.test(await gia.innerText()));
    check("không in giá lớp (500.000)", !(await page.locator("[data-ho-so]").innerText()).includes("500.000"));
    check("một trang cuộn: không có tab; có 'Giới thiệu', 'Lớp đang mở', video", (await page.getByRole("tab").count()) === 0 && await page.getByRole("heading", { name: "Giới thiệu" }).isVisible() && await page.getByRole("heading", { name: "Lớp đang mở" }).isVisible() && await page.locator("[data-intro-video]").isVisible());
    check("Lớp đang mở: lớp miễn phí + lớp có học phí", (await page.locator("[data-class-row]").count()) === 2);
    check("dòng số đếm: '1 buổi đã dạy · 1 học sinh đang học — theo sổ lớp do gia sư ghi.'", ((await page.locator("[data-so-dem-so-lop]").innerText()).trim()) === "1 buổi đã dạy · 1 học sinh đang học — theo sổ lớp do gia sư ghi.");
    check("khối Lớp miễn phí có nút 'Vào lớp miễn phí' (khách)", await page.locator("[data-free-class-block]").getByRole("button", { name: /Vào lớp miễn phí/ }).isVisible());
    check(SAN ? "cờ bật: có 'Quay lại danh sách' → /giang-vien" : "cờ tắt: KHÔNG có 'Quay lại danh sách', có 'Xem lớp đang mở' → /khoa-hoc",
      SAN ? (await page.getByRole("link", { name: "Quay lại danh sách" }).getAttribute("href")) === "/giang-vien"
        : (await page.getByText("Quay lại danh sách").count()) === 0 && (await page.locator("#kin-profile-end").getByRole("link", { name: "Xem lớp đang mở" }).getAttribute("href")) === "/khoa-hoc");
    check("khách thấy 'Tạo hồ sơ của bạn' và có #kin-profile-end", (await page.locator("#kin-profile-end").count()) === 1 && await page.getByRole("link", { name: "Tạo hồ sơ của bạn" }).isVisible());

    const y = async (sel: string) => (await page.locator(sel).first().boundingBox())?.y ?? -1;
    const x = async (sel: string) => (await page.locator(sel).first().boundingBox())?.x ?? -1;
    if (w === 390) {
      const order = [await y("[data-ho-so-dau]"), (await req.boundingBox())?.y ?? -1, await y("[data-gia-tham-khao]"), await y("[data-gioi-thieu-ho-so]"), await y("[data-intro-video]"), await y("[data-lop-dang-mo]"), await y("[data-free-class-block]"), await y("[data-nhac-an-toan]")];
      check("390 một cột, đúng thứ tự: đầu hồ sơ → liên hệ → giá → giới thiệu → video → lớp đang mở → lớp miễn phí → nhắc an toàn", order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), order);
    } else {
      const left = await x("[data-ho-so-dau]"), right = await x("[data-gia-tham-khao]");
      check("1600: giá / liên hệ ở cột phải (cách cột trái > 600px), giá TRÊN 'Gửi yêu cầu'", right - left > 600 && (await y("[data-gia-tham-khao]")) < ((await req.boundingBox())?.y ?? 0), { left, right });
      const wRight = (await page.locator("[data-nhac-an-toan]").boundingBox())?.width ?? 0;
      check("1600: cột phải rộng 360px", Math.round(wRight) === 360, wRight);
      check("1600: khung hồ sơ ≤ 1200px", ((await page.locator("[data-ho-so]").boundingBox())?.width ?? 9999) <= 1200);
    }
    const m = await measure(page);
    check(`hồ sơ: nút ≥ 44px (${label})`, m.small.length === 0, m.small);
    check(`hồ sơ: không tràn ngang (${label})`, !m.overflow);
    check("hồ sơ: không ★ / điểm / 'Đã duyệt hồ sơ' / 'đã xác minh' (API có rating 5 vẫn không vẽ)", !m.stars);
    await shot(page, `loi05-ho-so-${label}`);

    section(`Hồ sơ tên rất dài — ${label}px`);
    await goto(page, `/mentor/${T_LONG.id}`, "[data-ho-so-dau]");
    const nb = await names(page);
    check("H1 = tên đầy đủ, không tràn / ellipsis / line-clamp / nowrap", nb.length === 1 && nb[0].text === LONG && nameOk(nb[0]), nb);
    check("không ảnh bìa ⇒ không khối giả", (await page.locator("[data-cover],[data-cover-empty]").count()) === 0);
    check("nhãn–giá trị: Cấp lớp · Khu vực · Hình thức · Trường / bằng cấp (tự khai)", await (async () => { const t = await page.locator("[data-tutor-area-detail]").innerText(); return /Lớp 5, 8–12/.test(t) && t.includes("Hà Nội · Cầu Giấy") && t.includes("Online + dạy trực tiếp") && t.includes("Trường / bằng cấp (tự khai)"); })());
    check("giới thiệu đầy đủ, giữ xuống dòng", (await page.locator("[data-gioi-thieu-ho-so] p").innerText()).includes("kỳ thi vào lớp 10") && (await page.locator("[data-gioi-thieu-ho-so] p").evaluate((e: Element) => getComputedStyle(e).whiteSpace)) === "pre-line");
    check("không có số đếm sổ lớp (0 buổi, 0 học sinh ⇒ không in)", (await page.locator("[data-so-dem-so-lop]").count()) === 0);
    const ml = await measure(page);
    check(`tên dài: nút ≥ 44px, không tràn ngang (${label})`, ml.small.length === 0 && !ml.overflow, ml);
    await shot(page, `loi05-ho-so-ten-dai-${label}`);
    await ctx.close();
  }

  section("Hồ sơ thiếu nhiều trường (390): không ảnh, không giá, không bio, không lớp");
  {
    const { ctx, page } = await newPage(390, 844);
    await goto(page, `/mentor/${T_NOIMG.id}?tab=lop`, "[data-ho-so-dau]");
    check("?tab= cũ được bỏ qua: trang hồ sơ mở bình thường, không tab", (await page.locator("[data-ho-so]").count()) === 1 && (await page.getByRole("tab").count()) === 0);
    check("chữ cái đầu 'TB' thay ảnh", (await page.locator('[data-ho-so-dau] [data-anh-gia-su="chu"]').innerText()).trim() === "TB");
    check("'Gia sư chưa viết phần giới thiệu.' + 'Gia sư chưa mở lớp nhận thêm học sinh. Bạn có thể gửi yêu cầu để hỏi lịch.'", await page.getByText("Gia sư chưa viết phần giới thiệu.").isVisible() && await page.getByText("Gia sư chưa mở lớp nhận thêm học sinh. Bạn có thể gửi yêu cầu để hỏi lịch.").isVisible());
    check("không giá ⇒ không khối giá; không Zalo; 'Gửi yêu cầu' vẫn có", (await page.locator("[data-gia-tham-khao]").count()) === 0 && (await page.getByRole("link", { name: "Nhắn Zalo" }).count()) === 0 && (await page.getByRole("link", { name: "Gửi yêu cầu" }).count()) === 1);
    await goto(page, `/mentor/${T_NOPRICE.id}`, "[data-ho-so-dau]");
    check("lưu giá mà TẮT hiện ⇒ không khối giá, không '180.000'", (await page.locator("[data-gia-tham-khao]").count()) === 0 && !(await page.content()).includes("180.000"));
    await ctx.close();
  }

  section("Hồ sơ không tìm thấy: id sai / 65 ký tự / ẩn / khoá — cùng một khối");
  {
    const { ctx, page } = await newPage(390, 844);
    const texts: string[] = [];
    for (const id of ["khong-ton-tai-xyz", "a".repeat(65), HIDDEN.id, LOCKED.id]) {
      await goto(page, `/mentor/${id}`, "[data-ho-so-khong-thay]");
      texts.push((await page.locator("[data-ho-so-khong-thay]").innerText()).trim());
    }
    check("bốn nguyên nhân, đúng một nội dung, không lộ lý do", texts.every(t => t === texts[0]) && texts[0].includes("Không tìm thấy gia sư này"), texts);
    await goto(page, "/mentor/khong-ton-tai-xyz", "[data-ho-so-khong-thay]");
    check("H1 'Không tìm thấy gia sư này' + 'Đường dẫn có thể sai, hoặc gia sư đã ẩn hồ sơ.'", (await page.locator("[data-ho-so-khong-thay] h1").innerText()).trim() === "Không tìm thấy gia sư này" && await page.getByText("Đường dẫn có thể sai, hoặc gia sư đã ẩn hồ sơ.").isVisible());
    check(SAN ? "cờ bật: nút 'Xem danh sách gia sư' → /giang-vien" : "cờ tắt: nút 'Xem lớp đang mở' → /khoa-hoc, không 'Quay lại danh sách'",
      SAN ? (await page.getByRole("link", { name: "Xem danh sách gia sư" }).getAttribute("href")) === "/giang-vien"
        : (await page.getByRole("link", { name: "Xem lớp đang mở" }).getAttribute("href")) === "/khoa-hoc" && (await page.getByText("Quay lại danh sách").count()) === 0);
    check("có 'Về trang chủ' → /", (await page.getByRole("link", { name: "Về trang chủ" }).getAttribute("href")) === "/");
    check("không phải khối lỗi tạm thời", (await page.locator("[data-ho-so-loi]").count()) === 0);
    const m = await measure(page);
    check("không tìm thấy: nút ≥ 44px, không tràn ngang", m.small.length === 0 && !m.overflow, m);
    await shot(page, "loi05-khong-thay-390");
    await ctx.close();
  }

  section("Hồ sơ — học sinh đăng nhập (vỏ học sinh) 390");
  {
    const { ctx, page } = await newPage(390, 844, S);
    await goto(page, `/mentor/${T_PRICED.id}`, "[data-ho-so-dau]");
    check("học sinh: hồ sơ mở, có nút 'Vào lớp miễn phí', không 'Tạo hồ sơ của bạn'", await page.locator("[data-free-class-block]").getByRole("button", { name: /Vào lớp miễn phí/ }).isVisible() && (await page.getByRole("link", { name: "Tạo hồ sơ của bạn" }).count()) === 0);
    check("học sinh 390: không tràn ngang", await page.evaluate(NOT_OVERFLOW) as boolean);
    await ctx.close();
  }

  check("không lỗi trang / console", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
