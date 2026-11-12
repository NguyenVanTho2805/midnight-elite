// BU-06 — Tìm gia sư kiểu sàn (/giang-vien) và hồ sơ (/mentor/[id]) trên trình duyệt thật, hai cỡ 1600×900 và 390×844. Có chụp ảnh.
// LOI-05 (11/11/2026): kỳ vọng BỐ CỤC theo thiết kế mới (docs/kin/phong-ban/dac-ta/LOI-05.md mục 4): thẻ [data-the-gia-su], lưới 3 cột (1600) / 1 cột (390),
//   hàng lọc ngang (Môn · Khu vực · Hình thức) thay cột lọc trái, nút "Lọc (n)" + tờ "Lọc gia sư" ở 390, hồ sơ một trang cuộn (không tab, ?tab= cũ bỏ qua),
//   không khối bìa giả. Bỏ khỏi bài vì giao diện không còn: hộp gợi ý, ô Sắp xếp, lọc giá, chip Môn, tab Chỉ số (API sắp xếp vẫn kiểm qua fetch; tham số cũ phải bị bỏ qua).
//   GIỮ mọi ca an toàn/quyền/không lộ: ẩn/khoá không hiện, HTML không PII, video chỉ youtube-nocookie sau khi bấm, tên miền giả bị loại, giá chỉ khi tự bật,
//   không in giá lớp, vào lớp miễn phí theo vai (khách → đăng nhập, học sinh, gia sư không nút), Gửi yêu cầu không cần đăng nhập.
//   Cờ NEXT_PUBLIC_KIN_MO_TIM_GIA_SU: đặt CÙNG giá trị cho máy chủ dev và bài này. Cờ tắt: phần danh sách thay bằng kiểm /giang-vien 307; phần hồ sơ chạy như nhau.
// Cần Postgres + Next dev (xem tools/local-e2e/README.md); bài này KHÔNG tự bật máy chủ. API danh sách/gợi ý do stu-code làm: bài chạy được khi route mới đã có.
// Quy ước đo: nút ≥ 44px trong phạm vi trang (loại lớp phủ dev của Next, KinToast, vỏ trang), không tràn ngang, không pageerror.
// Lọc có chủ đích: console.error của React 19 về <script> chủ đề ở src/app/layout.tsx ("Encountered a script tag") — lỗi có sẵn trên main, không thuộc BU-06.
// Không dùng goto 'networkidle' (trang có kết nối nền): domcontentloaded rồi chờ bộ chọn. So URL bằng pathname+search. Không khẳng định 404 của nhóm (guest) (trả 200).
import { BASE, mkUser, mkTutor, mkCourse, mkAttendanceSession, wipe, check, eventually, section, done } from "./h";
import { vnDateKeyOf } from "@/lib/classSessions";
import { launch, ctxFor, shot, closeAll, kinSelect, type Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { featureOn } from "@/lib/features";

const SAN = featureOn("TIM_GIA_SU");

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
    var root = document.querySelector("[data-san-gia-su],[data-ho-so]") || document.body;
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
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-the-gia-su]"));
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
  // 26 gia sư phụ để qua trang 2 (24/trang): đủ nhiều hàng ở 3 cột.
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
  await mkAttendanceSession(cPaid.id, T.id, new Date(`${vnDateKeyOf(new Date(Date.now() - 86_400_000))}T00:00:00Z`)); // hôm qua (giờ VN): `new Date()` làm bài đỏ khi chạy lúc 00:00–17:00 UTC vì buổi 'ở tương lai' so với 00:00Z của ngày VN

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|Encountered a script tag/i.test(m.text())) errors.push(m.text()); });
  };
  // Next dev truyền trang theo luồng: lúc đầu nội dung nằm trong <div hidden id="S:n"> RỒI mới được script tráo vào chỗ — đo/đếm trước lúc đó sẽ thấy HAI bản. Chờ hết mẫu ẩn.
  const settle = (p: Page) => p.waitForFunction(`!document.querySelector('div[hidden][id^="S:"]')`, undefined, { timeout: 60000 }).catch(() => undefined);
  const goto = async (p: Page, url: string, ready: string) => { await p.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 120000 }); await p.locator(ready).first().waitFor({ timeout: 90000 }); await settle(p); };


  const CARD = "[data-the-gia-su]";
  const card = (p: Page, name: string | RegExp) => p.locator(CARD, { has: p.locator("[data-ten-gia-su]", { hasText: name }) });
  // ───────────────────────── Danh sách (cờ BẬT)
  if (SAN) {
  for (const [label, w, h] of [["1600", 1600, 900], ["390", 390, 844]] as const) {
    section(`Tìm gia sư — ${label}px`);
    const ctx = await ctxFor(null, { width: w, height: h });
    const page = await ctx.newPage(); watch(page);
    await goto(page, "/giang-vien", CARD);
    await page.locator("[data-luoi-cho]").waitFor({ state: "detached", timeout: 60000 }).catch(() => undefined);
    check("tiêu đề Tìm gia sư + dòng đếm 'N gia sư' (role=status)", await page.getByRole("heading", { level: 1, name: "Tìm gia sư" }).isVisible() && /\d+ gia sư/.test(await page.locator("[data-san-gia-su-client] > [role=status]").innerText().catch(() => "")));
    const cols = await gridColumns(page);
    check(`lưới ${w === 1600 ? 3 : 1} cột thật (đo vị trí thẻ)`, cols === (w === 1600 ? 3 : 1), cols);
    check("không cột lọc bên trái: hàng lọc nằm TRÊN lưới", ((await page.locator("[data-hang-loc]").boundingBox())?.y ?? 1e9) < ((await page.locator("[data-luoi-gia-su]").boundingBox())?.y ?? 0));

    // Thẻ Cô Lan: đủ dòng; gia sư không giá không in dòng giá; không có ★
    const lan = card(page, "Cô Lan");
    await lan.first().waitFor({ timeout: 60000 });
    const lanText = await lan.first().innerText();
    check("thẻ có tên, môn, '150.000đ / buổi · giá tham khảo, tự khai'", lanText.includes("Cô Lan") && lanText.includes("Toán 9") && lanText.includes("150.000đ / buổi · giá tham khảo, tự khai"), lanText);
    check("thẻ có khu vực 'Cầu Giấy'; số đếm/'Hoạt động gần đây' KHÔNG ở thẻ (chỉ ở hồ sơ, theo đặc tả)", lanText.includes("Cầu Giấy") && !/buổi đã dạy|học sinh đang|Hoạt động gần đây/.test(lanText), lanText);
    // Thầy Khang không nằm trang 1 (24 thẻ/trang, còn 26 gia sư phụ) ⇒ tìm theo tên rồi trả về danh sách đầy đủ.
    await goto(page, "/giang-vien?q=Khang", CARD);
    await eventually("?q=Khang: chỉ còn thẻ Thầy Khang", async () => (await page.locator(CARD).count()) === 1);
    const khang = card(page, "Thầy Khang");
    check("gia sư không khai giá: thẻ không in dòng giá, không 'tự khai', không 'Liên hệ'", (await khang.count()) === 1 && (await khang.locator('[data-dong-the="gia"]').count()) === 0 && !/Liên hệ|tự khai|đ \/ buổi/.test(await khang.innerText()), { cards: await khang.count(), text: (await khang.first().innerText().catch(() => "")).slice(0, 200) });
    await goto(page, "/giang-vien?q=C%C3%B4", CARD);
    await eventually("?q=Cô: có thẻ Cô Lan", async () => (await card(page, "Cô Lan").count()) === 1);
    check("khách không thấy gia sư bị khoá / ẩn (kể cả khi tìm đúng tên)", (await page.locator(CARD, { hasText: /Cô Bị Khoá|Cô Ẩn Hồ Sơ/ }).count()) === 0);
    check("nút 'Xem hồ sơ' aria-label 'Xem hồ sơ …' → /mentor/<id>; tên cũng là liên kết cùng đích", (await page.getByRole("link", { name: "Xem hồ sơ Cô Lan" }).getAttribute("href")) === `/mentor/${T.id}` && (await card(page, "Cô Lan").locator("[data-ten-gia-su] a").getAttribute("href")) === `/mentor/${T.id}`);

    // Sắp xếp: giao diện không còn ô Sắp xếp (đặc tả 1.5), API vẫn nhận sort.
    check("giao diện không còn ô 'Sắp xếp'", (await page.getByRole("combobox", { name: "Sắp xếp" }).count()) === 0);
    { const r = await fetch(`${BASE}/api/tutors?sort=price_asc`); const j = await r.json() as { items: { name: string }[] };
      check("API vẫn nhận sort=price_asc: người đầu là Thầy Giá Thấp (80.000đ)", r.status === 200 && j.items[0]?.name === "Thầy Giá Thấp", j.items.slice(0, 3).map(x => x.name)); }
    // Tham số cũ (giá) bị bỏ qua: link cũ mở danh sách đầy đủ hơn, không lỗi.
    await goto(page, "/giang-vien?q=Khang&priceMin=100000&priceMax=100000000&sort=price_asc", CARD);
    await eventually("tham số cũ priceMin/priceMax bị bỏ qua: Thầy Khang (không giá) vẫn hiện", async () => (await card(page, "Thầy Khang").count()) === 1);

    // Xem thêm: nối trang
    await goto(page, "/giang-vien", CARD);
    await eventually("trang 1 đủ 24 thẻ", async () => (await page.locator(CARD).count()) === 24);
    const before = await page.locator(CARD).count();
    const more = page.getByRole("button", { name: "Xem thêm gia sư" });
    await more.waitFor({ timeout: 30000 });
    await more.click();
    await eventually("Xem thêm nối thêm thẻ (không thay)", async () => (await page.locator(CARD).count()) > before);
    check("số thẻ sau khi nối không trùng", await page.evaluate(`(() => { var l = Array.prototype.map.call(document.querySelectorAll("[data-the-gia-su]"), function (a) { return a.getAttribute("data-the-gia-su"); }); return l.length > 24 && new Set(l).size === l.length; })()`));

    if (w === 1600) {
      section("1600px — hàng lọc ngang: chọn Môn");
      await kinSelect(page.getByRole("combobox", { name: "Môn" }).first(), { label: "Hoá học" });
      await page.waitForURL(u => /subject=/.test(rel(u.toString())), { timeout: 30000 });
      await eventually("lọc theo môn: mọi thẻ đều Hoá học", async () => { const t = await page.locator(CARD).allInnerTexts(); return t.length > 0 && t.every(x => x.includes("Hoá học")); });
      check("URL có subject=Hoá học", decodeURIComponent(rel(page.url()).replace(/\+/g, " ")).includes("subject=Hoá học"), rel(page.url()));
    } else {
      section("390px — nút 'Lọc (n)' + tờ trượt bộ lọc");
      const opener = page.getByRole("button", { name: /^Lọc \(\d+\)/ });
      check("nút 'Lọc (0)' khi chưa lọc", /\(0\)/.test(await opener.innerText()), await opener.innerText());
      await opener.click();
      const dlg = page.getByRole("dialog", { name: "Lọc gia sư" });
      await dlg.waitFor({ timeout: 15000 });
      await kinSelect(dlg.getByRole("combobox", { name: "Môn" }).first(), { label: "Hoá học" });
      await dlg.getByRole("button", { name: "Xem kết quả" }).click();
      await dlg.waitFor({ state: "detached", timeout: 15000 });
      await page.waitForURL(u => /subject=/.test(rel(u.toString())), { timeout: 30000 });
      await eventually("lọc theo môn từ tờ trượt: mọi thẻ đều Hoá học", async () => { const t = await page.locator(CARD).allInnerTexts(); return t.length > 0 && t.every(x => x.includes("Hoá học")); });
    }

    // F5 giữ bộ lọc
    const urlBefore = rel(page.url());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(CARD).first().waitFor({ timeout: 60000 });
    await eventually("F5 giữ bộ lọc (URL và kết quả)", async () => rel(page.url()) === urlBefore && (await page.locator(CARD).allInnerTexts()).every(x => x.includes("Hoá học")));

    if (w === 390) {
      const opener = page.getByRole("button", { name: /^Lọc \(\d+\)/ });
      check("nút 'Lọc (1)' đếm môn đang bật", /\(1\)/.test(await opener.innerText()), await opener.innerText());
      await opener.click();
      const dlg = page.getByRole("dialog", { name: "Lọc gia sư" });
      await dlg.waitFor({ timeout: 15000 });
      check("tờ trượt là dialog aria-modal, khoá cuộn nền", (await dlg.getAttribute("aria-modal")) === "true" && (await page.evaluate("document.body.style.overflow")) === "hidden");
      await shot(page, "tim-gia-su-390-to-loc");
      await page.keyboard.press("Escape");
      await dlg.waitFor({ state: "detached", timeout: 15000 });
      check("Esc đóng và trả tiêu điểm về nút Lọc", await page.evaluate(`!!(document.activeElement && /^Lọc \\(/.test((document.activeElement.textContent || "").trim()))`) as boolean);
      await opener.click();
      await dlg.waitFor({ timeout: 15000 });
      await dlg.getByRole("button", { name: "Xóa lọc" }).click();
      await dlg.getByRole("button", { name: "Xem kết quả" }).click();
      await dlg.waitFor({ state: "detached", timeout: 15000 });
      await page.waitForURL(u => !/subject=/.test(rel(u.toString())), { timeout: 30000 });
      check("áp bộ lọc từ tờ trượt đổi URL (đã bỏ môn)", !/subject=/.test(rel(page.url())), rel(page.url()));
    } else {
      const xoa = page.locator("[data-hang-loc]").getByRole("button", { name: "Xóa lọc" });
      check("1600: 'Xóa lọc' hiện khi có lọc", await xoa.isVisible());
      await xoa.click();
      await page.waitForURL(u => !/subject=/.test(rel(u.toString())), { timeout: 30000 });
      await eventually("Xóa lọc: về danh sách đầy đủ (có thẻ không phải Hoá học)", async () => (await page.locator(CARD).allInnerTexts()).some(x => !x.includes("Hoá học")));
      check("chân trang ghi 'do gia sư tự khai; KiN chưa xác minh'", /do gia sư tự khai; KiN chưa xác minh/.test(await page.locator("[data-chan-san]").innerText()));
    }

    // Ảnh + đo
    await page.goto(`${BASE}/giang-vien`, { waitUntil: "domcontentloaded" });
    await page.locator(CARD).first().waitFor({ timeout: 60000 }); await settle(page);
    const m = await measure(page);
    check(`nút/ô bấm trong trang ≥ 44px (${label})`, m.small.length === 0, m.small);
    check(`không tràn ngang (${label})`, !m.overflow);
    check("không có ký tự ★", !m.stars);
    await shot(page, `tim-gia-su-${label}`);
    await ctx.close();
  }

  // ───────────────────────── Ba trạng thái của danh sách
  section("Ba trạng thái (1600): lỗi + Thử lại, rỗng + Xóa lọc, đang tải");
  {
    const ctx = await ctxFor(null, { width: 1600, height: 900 });
    const page = await ctx.newPage(); watch(page);
    let fail = true;
    await page.route("**/api/tutors?**", r => (fail ? r.abort() : r.continue()));
    await page.goto(`${BASE}/giang-vien`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const alert = page.getByRole("alert").filter({ hasText: "Chưa tải được danh sách gia sư" });
    await alert.waitFor({ timeout: 60000 });
    check("lỗi: role=alert + nút Thử lại", await alert.getByRole("button", { name: "Thử lại" }).isVisible());
    fail = false;
    await alert.getByRole("button", { name: "Thử lại" }).click();
    await page.locator(CARD).first().waitFor({ timeout: 60000 });
    check("bấm Thử lại thì có dữ liệu", (await page.locator(CARD).count()) > 0);
    await page.unroute("**/api/tutors?**");

    await page.goto(`${BASE}/giang-vien?q=zzzkhongcogiasunaoten`, { waitUntil: "domcontentloaded" });
    await page.getByText("Không có gia sư khớp bộ lọc").waitFor({ timeout: 60000 });
    check("rỗng: nêu bộ lọc đang bật + nút Xóa lọc", /zzzkhongcogiasunaoten/.test(await page.locator("[data-kin-empty]").innerText()) && await page.locator("[data-kin-empty]").getByRole("button", { name: "Xóa lọc" }).isVisible());
    await page.locator("[data-kin-empty]").getByRole("button", { name: "Xóa lọc" }).click();
    await page.locator(CARD).first().waitFor({ timeout: 60000 });
    check("Xóa lọc đưa danh sách về đầy đủ", !/q=/.test(rel(page.url())));

    // đang tải: làm chậm API
    await page.route("**/api/tutors?**", async r => { await new Promise(res => setTimeout(res, 2500)); await r.continue(); });
    await page.goto(`${BASE}/giang-vien?subject=Hoá%20học`, { waitUntil: "domcontentloaded" });
    check("đang tải: thấy khung chờ aria-busy cùng dáng thẻ", await page.locator("[data-luoi-cho][aria-busy=true] [data-the-gia-su-cho]").first().waitFor({ timeout: 30000 }).then(() => true, () => false));
    await page.unroute("**/api/tutors?**");
    await ctx.close();
  }
  } else {
    section("Cờ TẮT — sàn /giang-vien bị chặn (hồ sơ vẫn mở, kiểm ở dưới)");
    for (const path of ["/giang-vien", "/giang-vien?subject=To%C3%A1n%209"]) {
      const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
      check(`${path} → 307`, r.status === 307, [r.status, r.headers.get("location")]);
    }
  }

  // ───────────────────────── Hồ sơ (không phụ thuộc cờ)
  for (const [label, w, h] of [["1600", 1600, 900], ["390", 390, 844]] as const) {
    section(`Hồ sơ gia sư — ${label}px (khách)`);
    const ctx = await ctxFor(null, { width: w, height: h });
    await ctx.route("https://i.ytimg.com/**", r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(COVER.split(",")[1], "base64") }));
    const page = await ctx.newPage(); watch(page);
    await goto(page, `/mentor/${T.id}`, "[data-ho-so-dau]");
    check("ảnh bìa hiện", await page.locator("[data-cover] img").isVisible());
    { // Gia sư BẬT Zalo cố ý đưa số vào đúng đường dẫn zalo.me/<số> (nút "Nhắn Zalo"); số đó KHÔNG được xuất hiện ở bất kỳ chỗ nào khác.
      const html = (await page.content()).replace(/zalo\.me\/\+?\d+/g, "zalo.me/·"); // kẻ tấn công đọc nguồn trang: không PII, không đường dẫn video thô lẫn tham số theo dõi, không mã quản trị
      check("HTML hồ sơ không nhúng số điện thoại / email / ngày sinh / tên em học sinh", !/0901234567|901234567|@test\.local|dateOfBirth|phoneE164|Em Mai Kín Tên|Em Nam Kín Tên/.test(html), (html.match(/0901234567|901234567|@test\.local|dateOfBirth|phoneE164|Em Mai Kín Tên|Em Nam Kín Tên/g) ?? []).slice(0, 5));
      check("HTML hồ sơ không nhúng khoá introVideoUrl / preferences thô", !/introVideoUrl|"preferences"/.test(html)); }
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
    check("giá tham khảo + câu 'tự khai/thỏa thuận trực tiếp'", (await page.locator("[data-gia-tham-khao]").filter({ visible: true }).count()) === 1 && /Thỏa thuận trực tiếp/.test(await page.locator("[data-gia-tham-khao]").first().innerText()) && /tự khai/.test(await page.locator("[data-gia-tham-khao]").first().innerText()));
    check("không in giá lớp (500.000)", !(await page.locator("body").innerText()).includes("500.000"));

    // Một trang cuộn: không tab; ?tab= cũ được chấp nhận và bỏ qua (link cũ không chết).
    check("không có tab; có 'Giới thiệu' và 'Lớp đang mở' trên cùng một trang", (await page.getByRole("tab").count()) === 0 && (await page.locator("[data-gioi-thieu-ho-so]").count()) === 1 && (await page.locator("[data-lop-dang-mo]").count()) === 1);
    for (const key of ["lop", "chi-so", "gioi-thieu", "bay-ba"]) {
      await goto(page, `/mentor/${T.id}?tab=${key}`, "[data-lop-dang-mo]");
      check(`?tab=${key} cũ: hồ sơ mở bình thường, không tab`, (await page.locator("[data-ho-so]").count()) === 1 && (await page.getByRole("tab").count()) === 0);
    }
    check("'Lớp đang mở': thấy lớp miễn phí và nhãn 'Miễn phí'", await page.locator('[data-class-row]', { hasText: "Tin học miễn phí" }).getByText("Miễn phí", { exact: true }).isVisible());
    check("lớp có học phí: chỉ 'Xem lớp', không nút Vào lớp", (await page.locator("[data-class-row]", { hasText: "Toán 9 có học phí" }).getByRole("button").count()) === 0);
    check("hồ sơ không có ★", !(await page.locator("[data-ho-so]").innerText()).includes("★"));
    check("số đếm sổ lớp kèm 'theo sổ lớp do gia sư ghi'", /theo sổ lớp do gia sư ghi/.test(await page.locator("[data-so-dem-so-lop]").innerText()));
    await shot(page, `ho-so-gia-su-lop-${label}`);

    // Thứ tự ở 390: hai nút liên hệ nằm TRƯỚC phần Giới thiệu
    if (w === 390) {
      await page.goto(`${BASE}/mentor/${T.id}`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-ho-so-dau]").first().waitFor({ timeout: 60000 }); await settle(page);
      const reqY = (await req.boundingBox())?.y ?? 0, gtY = (await page.locator("[data-gioi-thieu-ho-so]").boundingBox())?.y ?? 0;
      check("390: hàng hai nút (Zalo · Gửi yêu cầu) nằm trước phần Giới thiệu", reqY > 0 && reqY < gtY, { reqY, gtY });
      const nz = await nutZalo.boundingBox(), nr = await req.boundingBox();
      check("390: hai nút ngang hàng", !!nz && !!nr && Math.abs(nz.y - nr.y) < 4, { nz, nr });
    }
    await page.goto(`${BASE}/mentor/${T.id}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-ho-so-dau]").first().waitFor({ timeout: 60000 }); await settle(page);
    const m = await measure(page);
    check(`hồ sơ: nút ≥ 44px (${label})`, m.small.length === 0, m.small);
    check(`hồ sơ: không tràn ngang (${label})`, !m.overflow);
    await shot(page, `ho-so-gia-su-${label}`);
    await ctx.close();
  }

  section("Hồ sơ — video tên miền giả YouTube bị loại");
  {
    await prisma.user.update({ where: { id: T3.id }, data: { introVideoUrl: "https://youtube.com.xau.vn/watch?v=dQw4w9WgXcQ" } });
    const ctx = await ctxFor(null, { width: 390, height: 844 });
    const page = await ctx.newPage(); watch(page);
    await goto(page, `/mentor/${T3.id}`, "[data-ho-so-dau]");
    check("tên miền giả: không video, không iframe, không liên kết ra tên miền giả", (await page.locator("[data-intro-video]").count()) === 0 && (await page.locator("iframe").count()) === 0 && !(await page.content()).includes("xau.vn"));
    await ctx.close();
  }

  section("Hồ sơ — gia sư không bật Zalo, không bìa, không video");
  {
    const ctx = await ctxFor(null, { width: 390, height: 844 });
    const page = await ctx.newPage(); watch(page);
    await goto(page, `/mentor/${T2.id}`, "[data-ho-so-dau]");
    check("không có 'Nhắn Zalo'; 'Gửi yêu cầu' còn", (await page.getByRole("link", { name: "Nhắn Zalo" }).count()) === 0 && (await page.getByRole("link", { name: "Gửi yêu cầu" }).filter({ visible: true }).count()) === 1);
    check("không bìa: KHÔNG có khối bìa (cũng không khối giả); không video", (await page.locator("[data-cover],[data-cover-empty]").count()) === 0 && (await page.locator("[data-intro-video]").count()) === 0);
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
    check("không lộ lý do (không 'khoá' / 'ẩn bởi' / 'chưa duyệt')", !/khoá|bị khóa|chưa duyệt|bị cấm/i.test(texts[0]), texts[0]);
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
    await goto(page, `/mentor/${T.id}?tab=lop`, "[data-lop-dang-mo]");
    const row = page.locator("[data-class-row]", { hasText: "Tin học miễn phí" });
    await Promise.all([page.waitForURL(u => u.pathname === "/student/hoc-tap", { timeout: 60000 }), row.getByRole("button", { name: /Vào lớp miễn phí/ }).click()]);
    check("lớp open: vào ngay → /student/hoc-tap, đúng 1 Enrollment", (await prisma.enrollment.count({ where: { courseId: cFree.id, userId: S.id } })) === 1);

    await goto(page, `/mentor/${T.id}?tab=lop`, "[data-lop-dang-mo]");
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
