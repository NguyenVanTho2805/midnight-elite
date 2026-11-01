// BU-06 — Tìm gia sư kiểu sàn (/giang-vien) và hồ sơ (/mentor/[id]) trên trình duyệt thật, hai cỡ 1600×900 và 390×844. Có chụp ảnh.
// Cần Postgres + Next dev (xem tools/local-e2e/README.md); bài này KHÔNG tự bật máy chủ. API danh sách/gợi ý do stu-code làm: bài chạy được khi route mới đã có.
// Quy ước đo: nút ≥ 44px trong phạm vi trang (loại lớp phủ dev của Next, KinToast, vỏ trang), không tràn ngang, không pageerror.
// Lọc có chủ đích: console.error của React 19 về <script> chủ đề ở src/app/layout.tsx ("Encountered a script tag") — lỗi có sẵn trên main, không thuộc BU-06.
// Không dùng goto 'networkidle' (trang có kết nối nền): domcontentloaded rồi chờ bộ chọn. So URL bằng pathname+search. Không khẳng định 404 của nhóm (guest) (trả 200).
import { BASE, mkUser, mkTutor, mkCourse, mkAttendanceSession, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

const FREE_TAG = "Miễn phí";
// Ảnh PNG 1×1 (hợp lệ cho isValidCover) và một mã video YouTube giả hợp lệ về định dạng (11 ký tự).
const COVER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const VIDEO_ID = "dQw4w9WgXcQ";

const rel = (u: string) => { const x = new URL(u); return x.pathname + x.search; };
const SHOTS = process.env.SHOTS ?? "scratchpad/shots";
void SHOTS;

// Chuỗi mã (không phải hàm có tên): tsx/esbuild chèn __name() vào hàm có tên mà trình duyệt không có.
async function measure(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-agentation-root] { display: none !important; }" });
  return page.evaluate(`(() => {
    var root = document.querySelector("[data-tim-gia-su],[data-ho-so]") || document.body;
    var vis = function (e) { var r = e.getBoundingClientRect(); var st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
    var sel = 'a,button,select,input:not([type=hidden]),[role=tab],[role=option]';
    var small = Array.prototype.slice.call(root.querySelectorAll(sel))
      .filter(function (e) { return vis(e) && !e.closest('[data-kin-toast],nextjs-portal,[data-nextjs-toast],[data-agentation-root]') && !e.disabled && e.getBoundingClientRect().height < 43.5; })
      .map(function (e) { return e.tagName + ":" + (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30) + ":" + Math.round(e.getBoundingClientRect().height); });
    return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1, small: small, stars: (root.textContent || "").indexOf("\\u2605") >= 0 };
  })()`) as Promise<{ overflow: boolean; small: string[]; stars: boolean }>;
}

// Số cột thật của lưới = số giá trị left khác nhau của các thẻ cùng hàng đầu.
async function gridColumns(page: Page) {
  return page.evaluate(`(() => {
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-tutor-card]"));
    if (!cards.length) return 0;
    var top = cards[0].getBoundingClientRect().top;
    var lefts = {};
    cards.forEach(function (c) { var r = c.getBoundingClientRect(); if (Math.abs(r.top - top) < 4) lefts[Math.round(r.left)] = 1; });
    return Object.keys(lefts).length;
  })()`) as Promise<number>;
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");                // đủ mọi thứ: giá, khu vực, bìa, video, Zalo, lớp miễn phí
  const T2 = await mkTutor("Thầy Khang");           // không khai gì
  const T3 = await mkTutor("Thầy Giá Thấp");       // giá thấp nhất
  const LOCKED = await mkTutor("Cô Bị Khoá");
  const HIDDEN = await mkTutor("Cô Ẩn Hồ Sơ");
  const S = await mkUser({ name: "Em Mai Kín Tên" });
  const S2 = await mkUser({ name: "Em Nam Kín Tên" });
  const teaching = (o: Record<string, string | number | boolean>) => ({ teaching: o });

  await prisma.user.update({ where: { id: T.id }, data: {
    bio: "Gia sư Toán 9 nhiều năm kinh nghiệm, dạy lớp nhỏ và theo sát từng em.", subjects: ["Toán 9", "Toán 10"], city: "Hà Nội", phone: "0901234567",
    tutorVerifiedAt: new Date("2026-09-01T00:00:00Z"), coverUrl: COVER, introVideoUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    preferences: { ...teaching({ district: "Cầu Giấy", mode: "both", price: 150000, showPrice: true, credential: "ĐH Sư phạm Hà Nội" }), connections: { showZalo: true } },
  } });
  await prisma.user.update({ where: { id: T2.id }, data: { subjects: ["Vật lý"], bio: null } });
  await prisma.user.update({ where: { id: T3.id }, data: { subjects: ["Toán 9"], city: "TP. Hồ Chí Minh", preferences: teaching({ district: "Quận 3", mode: "online", price: 80000, showPrice: true }) } });
  await prisma.user.update({ where: { id: LOCKED.id }, data: { subjects: ["Toán 9"], profileLockedAt: new Date() } });
  await prisma.user.update({ where: { id: HIDDEN.id }, data: { subjects: ["Toán 9"], preferences: { profile: { hidden: true } } } });
  // 26 gia sư phụ để qua trang 2 (24/trang): đủ hai hàng ở 4 cột.
  for (let i = 1; i <= 26; i++) {
    const f = await mkTutor(`Gia sư phụ ${String(i).padStart(2, "0")}`);
    await prisma.user.update({ where: { id: f.id }, data: { subjects: [i % 2 ? "Hoá học" : "Tiếng Anh"], city: i % 3 ? "Hà Nội" : "Đà Nẵng", preferences: teaching({ mode: i % 2 ? "online" : "offline", price: 200000 + i * 1000, showPrice: i % 4 === 0 }) } });
  }
  const cFree = await mkCourse(T.id, { name: "Tin học miễn phí" });
  await prisma.course.update({ where: { id: cFree.id }, data: { joinPolicy: "open", tag: FREE_TAG } });
  const cApprove = await mkCourse(T.id, { name: "Văn xin vào lớp" });
  await prisma.course.update({ where: { id: cApprove.id }, data: { joinPolicy: "approve", tag: FREE_TAG } });
  const cPaid = await mkCourse(T.id, { name: "Toán 9 có học phí" });
  await prisma.course.update({ where: { id: cPaid.id }, data: { joinPolicy: "approve", price: 500000 } });
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: cPaid.id, status: "active" } });
  await mkAttendanceSession(cPaid.id, T.id, new Date());

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|Encountered a script tag/i.test(m.text())) errors.push(m.text()); });
  };
  const goto = async (p: Page, url: string, ready: string) => { await p.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 120000 }); await p.locator(ready).first().waitFor({ timeout: 90000 }); };

  // ───────────────────────── Danh sách
  for (const [label, w, h] of [["1600", 1600, 900], ["390", 390, 844]] as const) {
    section(`Tìm gia sư — ${label}px`);
    const ctx = await ctxFor(null, { width: w, height: h });
    const page = await ctx.newPage(); watch(page);
    await goto(page, "/giang-vien", "[data-tutor-card]");
    await page.locator("[data-tutor-grid-loading]").waitFor({ state: "detached", timeout: 60000 }).catch(() => undefined);
    check("tiêu đề Tìm gia sư + dòng kết quả 'gia sư phù hợp'", await page.getByRole("heading", { name: "Tìm gia sư" }).isVisible() && /gia sư phù hợp/.test(await page.getByRole("status").first().innerText().catch(() => "") || await page.locator("[role=status]").allInnerTexts().then(a => a.join(" "))));
    const cols = await gridColumns(page);
    check(`lưới ${w === 1600 ? 4 : 2} cột thật (đo vị trí thẻ)`, cols === (w === 1600 ? 4 : 2), cols);
    const left = page.locator("[data-loc-trai]");
    check(w === 1600 ? "có cột lọc bên trái" : "KHÔNG có cột lọc bên trái ở điện thoại", (await left.isVisible()) === (w === 1600));

    // Thẻ Cô Lan: đủ dòng; gia sư không giá không in dòng giá; không có ★
    const lan = page.locator("[data-tutor-card]", { hasText: "Cô Lan" });
    await lan.first().waitFor({ timeout: 60000 });
    const lanText = await lan.first().innerText();
    check("thẻ có tên, môn, '150.000đ / buổi · giá tham khảo'", lanText.includes("Cô Lan") && lanText.includes("Toán 9") && /150\.000đ \/ buổi/.test(lanText) && lanText.includes("giá tham khảo"), lanText);
    check("thẻ có 'N buổi đã dạy', 'học sinh đang dạy', 'Hoạt động gần đây', khu vực", /1 buổi đã dạy/.test(lanText) && /học sinh đang dạy/.test(lanText) && lanText.includes("Hoạt động gần đây") && lanText.includes("Cầu Giấy"), lanText);
    const khang = page.locator("[data-tutor-card]", { hasText: "Thầy Khang" });
    check("gia sư không khai giá: thẻ không in dòng giá, không in 'Liên hệ'", (await khang.count()) === 1 && (await khang.locator("[data-tutor-price]").count()) === 0 && !/Liên hệ/.test(await khang.innerText()));
    check("khách không thấy gia sư bị khoá / ẩn", (await page.locator("[data-tutor-card]", { hasText: /Cô Bị Khoá|Cô Ẩn Hồ Sơ/ }).count()) === 0);
    check("thẻ là MỘT liên kết aria-label 'Xem hồ sơ …' tới /mentor/<id>", (await page.getByRole("link", { name: "Xem hồ sơ Cô Lan" }).getAttribute("href")) === `/mentor/${T.id}`);

    // Sắp xếp "Giá tăng": thẻ đầu có giá thấp nhất
    const sort = page.getByRole("combobox", { name: "Sắp xếp" }).filter({ visible: true });
    await sort.selectOption("price_asc");
    await page.waitForURL(u => rel(u.toString()).includes("sort=price_asc"), { timeout: 30000 });
    await eventually("Giá tăng: thẻ đầu là Thầy Giá Thấp (80.000đ)", async () => /Thầy Giá Thấp/.test(await page.locator("[data-tutor-card]").first().innerText()));
    check("Giá tăng: gia sư không giá xuống cuối", !(await page.locator("[data-tutor-card]").last().locator("[data-tutor-price]").count()));
    await sort.selectOption("relevant");
    await page.waitForURL(u => !rel(u.toString()).includes("sort="), { timeout: 30000 });

    // Xem thêm: nối trang
    const before = await page.locator("[data-tutor-card]").count();
    const more = page.getByRole("button", { name: "Xem thêm gia sư" });
    await more.waitFor({ timeout: 30000 });
    await more.click();
    await eventually("Xem thêm nối thêm thẻ (không thay)", async () => (await page.locator("[data-tutor-card]").count()) > before);
    check("số thẻ sau khi nối = tổng, không trùng", await page.evaluate(`(() => { var l = Array.prototype.map.call(document.querySelectorAll("[data-tutor-card] a"), function (a) { return a.getAttribute("href"); }); return new Set(l).size === l.length; })()`));

    // Gợi ý + chọn môn ⇒ lưới lọc ⇒ URL
    const box = page.getByRole("combobox", { name: /Tìm gia sư/ });
    await box.fill("hoa");
    const opts = page.getByRole("option");
    await opts.first().waitFor({ timeout: 30000 });
    check("hộp gợi ý hiện, ≤ 8 dòng", (await opts.count()) >= 1 && (await opts.count()) <= 8, await opts.count());
    await page.getByRole("option", { name: /Hoá học/ }).first().click();
    await page.waitForURL(u => /subject=/.test(rel(u.toString())), { timeout: 30000 });
    await eventually("lọc theo môn: mọi thẻ đều Hoá học", async () => { const t = await page.locator("[data-tutor-card]").allInnerTexts(); return t.length > 0 && t.every(x => x.includes("Hoá học")); });

    // F5 giữ bộ lọc
    const urlBefore = rel(page.url());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-tutor-card]").first().waitFor({ timeout: 60000 });
    check("F5 giữ bộ lọc (URL và kết quả)", rel(page.url()) === urlBefore && (await page.locator("[data-tutor-card]").allInnerTexts()).every(x => x.includes("Hoá học")));

    if (w === 390) {
      section("390px — tờ trượt bộ lọc");
      const opener = page.getByRole("button", { name: /^Bộ lọc \(\d+\)/ });
      check("nút 'Bộ lọc (1)' đếm môn đang bật", /\(1\)/.test(await opener.innerText()), await opener.innerText());
      await opener.click();
      const dlg = page.getByRole("dialog", { name: "Bộ lọc gia sư" });
      await dlg.waitFor({ timeout: 15000 });
      check("tờ trượt là dialog aria-modal, khoá cuộn nền", (await dlg.getAttribute("aria-modal")) === "true" && (await page.evaluate("document.body.style.overflow")) === "hidden");
      await shot(page, "tim-gia-su-390-to-loc");
      await page.keyboard.press("Escape");
      await dlg.waitFor({ state: "detached", timeout: 15000 });
      check("Esc đóng và trả tiêu điểm về nút Bộ lọc", await page.evaluate(`document.activeElement && /Bộ lọc/.test(document.activeElement.textContent || "")`) as boolean);
      await opener.click();
      await dlg.waitFor({ timeout: 15000 });
      await dlg.getByRole("button", { name: "Xóa lọc" }).click();
      const apply = dlg.getByRole("button", { name: /^Xem (\d[\d.]*|gia sư)/ });
      await eventually("'Xem N gia sư' hiện tổng", async () => /Xem [\d.]+ gia sư/.test(await apply.innerText()));
      await apply.click();
      await dlg.waitFor({ state: "detached", timeout: 15000 });
      await page.waitForURL(u => !/subject=/.test(rel(u.toString())), { timeout: 30000 });
      check("áp bộ lọc từ tờ trượt đổi URL (đã bỏ môn)", !/subject=/.test(rel(page.url())), rel(page.url()));
    } else {
      // 1600: lọc ở cột trái, lọc giá, nhãn tự khai
      section("1600px — cột lọc trái");
      await page.goto(`${BASE}/giang-vien?priceMin=100000&priceMax=100000000`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-tutor-card]").first().waitFor({ timeout: 60000 });
      check("lọc giá: gia sư không công khai giá bị loại, Thầy Khang không còn", (await page.locator("[data-tutor-card]", { hasText: "Thầy Khang" }).count()) === 0);
      check("nhãn 'tự khai' xuất hiện ở cột lọc", /do gia sư tự khai/.test(await left.innerText()));
    }

    // Ảnh + đo
    await page.goto(`${BASE}/giang-vien`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-tutor-card]").first().waitFor({ timeout: 60000 });
    const m = await measure(page);
    check(`nút/ô bấm trong trang ≥ 44px (${label})`, m.small.length === 0, m.small);
    check(`không tràn ngang (${label})`, !m.overflow);
    check("không có ký tự ★", !m.stars);
    await shot(page, `tim-gia-su-${label}`);
    await ctx.close();
  }

  // ───────────────────────── Ba trạng thái của danh sách
  section("Ba trạng thái: lỗi + Thử lại, rỗng + Xóa bộ lọc, đang tải");
  {
    const ctx = await ctxFor(null, { width: 1600, height: 900 });
    const page = await ctx.newPage(); watch(page);
    let fail = true;
    await page.route("**/api/tutors?**", r => (fail ? r.abort() : r.continue()));
    await page.goto(`${BASE}/giang-vien`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const alert = page.getByRole("alert").filter({ hasText: "Không tải được danh sách gia sư" });
    await alert.waitFor({ timeout: 60000 });
    check("lỗi: role=alert + nút Thử lại", await page.getByRole("button", { name: "Thử lại" }).isVisible());
    fail = false;
    await page.getByRole("button", { name: "Thử lại" }).click();
    await page.locator("[data-tutor-card]").first().waitFor({ timeout: 60000 });
    check("bấm Thử lại thì có dữ liệu", (await page.locator("[data-tutor-card]").count()) > 0);
    await page.unroute("**/api/tutors?**");

    await page.goto(`${BASE}/giang-vien?q=zzzkhongcogiasunaoten`, { waitUntil: "domcontentloaded" });
    await page.getByText("Chưa có gia sư phù hợp").waitFor({ timeout: 60000 });
    check("rỗng: nêu bộ lọc đang bật + nút Xóa bộ lọc", /zzzkhongcogiasunaoten/.test(await page.locator("[data-kin-empty]").innerText()) && await page.getByRole("button", { name: "Xóa bộ lọc" }).filter({ visible: true }).first().isVisible());
    await page.locator("[data-kin-empty]").getByRole("button", { name: "Xóa bộ lọc" }).click();
    await page.locator("[data-tutor-card]").first().waitFor({ timeout: 60000 });
    check("Xóa bộ lọc đưa danh sách về đầy đủ", !/q=/.test(rel(page.url())));

    // đang tải: làm chậm API
    await page.route("**/api/tutors?**", async r => { await new Promise(res => setTimeout(res, 2500)); await r.continue(); });
    await page.goto(`${BASE}/giang-vien?subject=Hoá%20học`, { waitUntil: "domcontentloaded" });
    check("đang tải: thấy khung chờ aria-busy", await page.locator("[data-tutor-grid-loading][aria-busy=true]").first().waitFor({ timeout: 30000 }).then(() => true, () => false));
    await page.unroute("**/api/tutors?**");
    await ctx.close();
  }

  // ───────────────────────── Hồ sơ
  for (const [label, w, h] of [["1600", 1600, 900], ["390", 390, 844]] as const) {
    section(`Hồ sơ gia sư — ${label}px (khách)`);
    const ctx = await ctxFor(null, { width: w, height: h });
    const page = await ctx.newPage(); watch(page);
    await goto(page, `/mentor/${T.id}`, "[data-ho-so-dau]");
    check("ảnh bìa hiện", await page.locator("[data-cover] img").isVisible());
    const play = page.getByRole("button", { name: /Phát video giới thiệu của Cô Lan/ });
    await play.waitFor({ timeout: 30000 });
    check("trước khi bấm: video là NÚT và KHÔNG có iframe trong DOM", (await page.locator("iframe").count()) === 0);
    const yt = page.getByRole("link", { name: "Xem trên YouTube" });
    check("liên kết 'Xem trên YouTube' có rel noopener", /noopener/.test((await yt.getAttribute("rel")) ?? "") && (await yt.getAttribute("href")) === `https://www.youtube.com/watch?v=${VIDEO_ID}`);
    const pb = await play.boundingBox();
    check("nút phát cao ≥ 44px", !!pb && pb.height >= 44, pb);
    await play.click();
    const fr = page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]');
    await fr.waitFor({ timeout: 15000 });
    check("bấm ⇒ iframe youtube-nocookie.com/embed/<mã>", ((await fr.getAttribute("src")) ?? "").includes(VIDEO_ID));

    const nutZalo = page.getByRole("link", { name: "Nhắn Zalo" }).filter({ visible: true });
    check("'Nhắn Zalo' hiện vì gia sư bật", (await nutZalo.count()) === 1 && /zalo\.me\//.test((await nutZalo.getAttribute("href")) ?? ""));
    const req = page.getByRole("link", { name: "Gửi yêu cầu" }).filter({ visible: true });
    check("'Gửi yêu cầu' → /mentor/<id>/yeu-cau (một nút nhìn thấy)", (await req.count()) === 1 && (await req.getAttribute("href")) === `/mentor/${T.id}/yeu-cau`);
    check("không còn nút 'Đăng ký học với …'", (await page.getByText(/Đăng ký học với/).count()) === 0);
    check("giá tham khảo + câu 'tự khai/thỏa thuận trực tiếp'", (await page.locator("[data-gia-tham-khao]").filter({ visible: true }).count()) === 1 && /Thỏa thuận trực tiếp/.test(await page.locator("[data-gia-tham-khao]").first().innerText()));
    check("không in giá lớp (500.000)", !(await page.locator("body").innerText()).includes("500.000"));

    // Ba tab: đổi nội dung và URL
    for (const [name, key, marker] of [["Lớp đang mở", "lop", "[data-tab-lop]"], ["Chỉ số", "chi-so", "[data-tab-chi-so]"], ["Giới thiệu", "gioi-thieu", "[data-tab-gioi-thieu]"]] as const) {
      await page.getByRole("tab", { name }).click();
      await page.waitForURL(u => rel(u.toString()).includes(`tab=${key}`), { timeout: 30000 });
      await page.locator(marker).waitFor({ timeout: 30000 });
      check(`tab ${name}: URL ?tab=${key} và nội dung đổi`, rel(page.url()).includes(`tab=${key}`));
      if (key === "lop") await shot(page, `ho-so-gia-su-lop-${label}`);
    }
    await page.goto(`${BASE}/mentor/${T.id}?tab=lop`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-tab-lop]").waitFor({ timeout: 60000 });
    check("tab 'Lớp đang mở': thấy lớp miễn phí và nhãn 'Miễn phí'", await page.locator('[data-class-row]', { hasText: "Tin học miễn phí" }).getByText("Miễn phí", { exact: true }).isVisible());
    check("lớp có học phí: chỉ 'Xem lớp', không nút Vào lớp", (await page.locator("[data-class-row]", { hasText: "Toán 9 có học phí" }).getByRole("button").count()) === 0);
    await page.goto(`${BASE}/mentor/${T.id}?tab=chi-so`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-tab-chi-so]").waitFor({ timeout: 60000 });
    check("tab 'Chỉ số' không có ★", !(await page.locator("[data-ho-so]").innerText()).includes("★"));
    check("Chỉ số: nhãn 'Có dạy trong 30 ngày qua' và chân 'Không hiển thị thông tin học sinh'", /Có dạy trong 30 ngày qua/.test(await page.locator("[data-tab-chi-so]").innerText()) && /Không hiển thị thông tin học sinh/.test(await page.locator("[data-tab-chi-so]").innerText()));
    check("giá trị tab lạ ⇒ tab Giới thiệu", await (async () => { await page.goto(`${BASE}/mentor/${T.id}?tab=bay-ba`, { waitUntil: "domcontentloaded" }); return page.locator("[data-tab-gioi-thieu]").waitFor({ timeout: 60000 }).then(() => true, () => false); })());

    // Thứ tự ở 390: hai nút liên hệ nằm TRƯỚC thanh tab
    if (w === 390) {
      const reqY = (await req.boundingBox())?.y ?? 0, tabY = (await page.getByRole("tab", { name: "Giới thiệu" }).boundingBox())?.y ?? 0;
      check("390: hàng hai nút (Zalo · Gửi yêu cầu) nằm trước thanh tab", reqY > 0 && reqY < tabY, { reqY, tabY });
      const nz = await nutZalo.boundingBox(), nr = await req.boundingBox();
      check("390: hai nút ngang hàng", !!nz && !!nr && Math.abs(nz.y - nr.y) < 4, { nz, nr });
    }
    await page.goto(`${BASE}/mentor/${T.id}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-ho-so-dau]").waitFor({ timeout: 60000 });
    const m = await measure(page);
    check(`hồ sơ: nút ≥ 44px (${label})`, m.small.length === 0, m.small);
    check(`hồ sơ: không tràn ngang (${label})`, !m.overflow);
    await shot(page, `ho-so-gia-su-${label}`);
    await ctx.close();
  }

  section("Hồ sơ — gia sư không bật Zalo, không bìa, không video");
  {
    const ctx = await ctxFor(null, { width: 390, height: 844 });
    const page = await ctx.newPage(); watch(page);
    await goto(page, `/mentor/${T2.id}`, "[data-ho-so-dau]");
    check("không có 'Nhắn Zalo'; 'Gửi yêu cầu' còn", (await page.getByRole("link", { name: "Nhắn Zalo" }).count()) === 0 && (await page.getByRole("link", { name: "Gửi yêu cầu" }).filter({ visible: true }).count()) === 1);
    check("không bìa: khối nền nhạt (không ảnh giả); không video", (await page.locator("[data-cover]").count()) === 0 && (await page.locator("[data-cover-empty]").count()) === 1 && (await page.locator("[data-intro-video]").count()) === 0);
    await ctx.close();
  }

  section("Hồ sơ — gia sư bị khoá / ẩn / không tồn tại: cùng một khối, không lộ lý do");
  {
    const ctx = await ctxFor(null, { width: 1600, height: 900 });
    const page = await ctx.newPage(); watch(page);
    const texts: string[] = [];
    for (const id of [LOCKED.id, HIDDEN.id, "khong-ton-tai-xyz"]) {
      await goto(page, `/mentor/${id}`, "[data-ho-so-khong-thay]");
      texts.push((await page.locator("[data-ho-so-khong-thay]").innerText()).trim());
    }
    check("ba nguyên nhân hiện đúng một nội dung 'Không tìm thấy gia sư'", texts.every(t => t === texts[0]) && texts[0].includes("Không tìm thấy gia sư"), texts);
    await ctx.close();
  }

  // ───────────────────────── Vào lớp miễn phí (luồng BU-01) theo người xem
  section("Vào lớp miễn phí — khách");
  {
    const ctx = await ctxFor(null, { width: 1600, height: 900 });
    const page = await ctx.newPage(); watch(page);
    await goto(page, `/mentor/${T.id}`, "[data-free-class-block]");
    const btn = page.locator("[data-free-class-block]").getByRole("button", { name: /Vào lớp miễn phí/ });
    check("khách thấy nút 'Vào lớp miễn phí' (lớp open) và 'Xin vào lớp miễn phí' (lớp approve)", (await btn.count()) === 1 && (await page.locator("[data-free-class-block]").getByRole("button", { name: /Xin vào lớp miễn phí/ }).count()) === 1);
    await Promise.all([page.waitForURL(u => u.pathname === "/dang-nhap", { timeout: 60000 }), btn.click()]);
    check("khách bấm ⇒ 303 sang /dang-nhap có redirect về trang lớp", decodeURIComponent(rel(page.url())).includes(`/khoa-hoc/${cFree.id}`), rel(page.url()));
    check("không tạo Enrollment/yêu cầu cho khách", (await prisma.enrollment.count({ where: { courseId: cFree.id } })) === 0 && (await prisma.classJoinRequest.count()) === 0);
    await ctx.close();
  }

  section("Vào lớp miễn phí — học sinh");
  {
    const ctx = await ctxFor(S, { width: 390, height: 844 });
    const page = await ctx.newPage(); watch(page);
    await goto(page, `/mentor/${T.id}?tab=lop`, "[data-tab-lop]");
    const row = page.locator("[data-class-row]", { hasText: "Tin học miễn phí" });
    await Promise.all([page.waitForURL(u => u.pathname === "/student/hoc-tap", { timeout: 60000 }), row.getByRole("button", { name: /Vào lớp miễn phí/ }).click()]);
    check("lớp open: vào ngay → /student/hoc-tap, đúng 1 Enrollment", (await prisma.enrollment.count({ where: { courseId: cFree.id, userId: S.id } })) === 1);

    await goto(page, `/mentor/${T.id}?tab=lop`, "[data-tab-lop]");
    const row2 = page.locator("[data-class-row]", { hasText: "Văn xin vào lớp" });
    await Promise.all([page.waitForURL(u => u.pathname === "/student/nhap-ma-lop", { timeout: 60000 }), row2.getByRole("button", { name: /Xin vào lớp miễn phí/ }).click()]);
    const send = page.getByRole("button", { name: "Gửi yêu cầu vào lớp" });
    await send.waitFor({ timeout: 60000 });
    await send.click();
    await page.getByText("Đã gửi yêu cầu — chờ gia sư duyệt").waitFor({ timeout: 60000 });
    check("lớp approve: đúng 1 yêu cầu pending, 1 mã cá nhân, chưa có Enrollment", (await prisma.classJoinRequest.count({ where: { courseId: cApprove.id, userId: S.id, status: "pending" } })) === 1
      && (await prisma.classInvite.count({ where: { courseId: cApprove.id, kind: "personal", boundUserId: S.id } })) === 1 && (await prisma.enrollment.count({ where: { courseId: cApprove.id, userId: S.id } })) === 0);
    const notis = await prisma.notification.findMany({ where: { userId: T.id, type: "join_request_new" } });
    check("gia sư nhận đúng 1 thông báo xin vào lớp, KHÔNG có tên học sinh và KHÔNG có số tiền", notis.length === 1 && !/Mai|Kín Tên/.test(notis[0].title + notis[0].message) && !/\d[.,]?\d{3}\s*(đ|vnđ|VND)|đồng/i.test(notis[0].title + notis[0].message), notis.map(n => [n.title, n.message]));
    await ctx.close();
  }

  section("Vào lớp miễn phí — gia sư đăng nhập");
  {
    const ctx = await ctxFor(T2, { width: 1600, height: 900 });
    const page = await ctx.newPage(); watch(page);
    await goto(page, `/mentor/${T.id}`, "[data-free-class-block]");
    check("gia sư/quản trị không thấy nút Vào lớp; có chữ 'Tài khoản gia sư không vào lớp bằng nút này.'", (await page.locator("[data-free-class-block]").getByRole("button").count()) === 0 && (await page.locator("[data-free-class-block]").innerText()).includes("Tài khoản gia sư không vào lớp bằng nút này."));
    await ctx.close();
  }

  section("'Gửi yêu cầu' mở được không cần đăng nhập");
  {
    const ctx = await ctxFor(null, { width: 1600, height: 900 });
    const page = await ctx.newPage(); watch(page);
    await goto(page, `/mentor/${T.id}`, "[data-ho-so-dau]");
    await Promise.all([page.waitForURL(u => u.pathname === `/mentor/${T.id}/yeu-cau`, { timeout: 60000 }), page.getByRole("link", { name: "Gửi yêu cầu" }).filter({ visible: true }).click()]);
    check("mở được biểu mẫu yêu cầu của đúng gia sư", await page.getByRole("heading", { name: /Gửi yêu cầu/ }).first().waitFor({ timeout: 60000 }).then(() => true, () => false));
    await ctx.close();
  }

  check("không lỗi trang / console", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
