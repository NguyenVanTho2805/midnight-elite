// BU-05 — Cộng đồng: 3 cột (1280) / 2 cột (vỏ rộng) / 1 cột kiểu Threads (390, 320). Trình duyệt thật; CHƯA chạy lần nào (viết cùng lúc với giao diện).
// Cần: máy chủ thử cổng 3100 + DB kin_test, và API cộng đồng của stu-code (docs/kin/phong-ban/dac-ta/BU-05.md mục 4).
// Ô hỏi của khách chỉ có khi máy chủ chạy với KIN_GUEST_QUESTIONS=1; không bật thì bài báo rõ và bỏ qua nhánh gửi form (không đỏ).
// Ghi chú đo: hàng hành động cao 36px ở chuột (≥880 vùng nội dung) nhưng ≥44px ở 390 — luật nút ≥44px của Hướng A thắng số 36 của Threads.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BASE, api, mkSuper, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

const FORBIDDEN = /Bảng xếp hạng|\bVí\b|Coin|\bxu\b|Thư viện|Tin tức|Nhắn tin|Tin nhắn/;

(async () => {
  await wipe();
  const S = await mkUser({ name: "Trần Thị Bích" });      // học sinh (hiển thị rút gọn "Bích T.")
  const S2 = await mkUser({ name: "Lê Văn Cường" });       // học sinh ngoài lớp
  const T = await mkTutor("Cô Lan");
  const A = await mkSuper("Quản trị");
  const course = await mkCourse(T.id, { name: "Toán 9 Cô Lan" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: course.id, status: "active" } });
  await prisma.user.update({ where: { id: T.id }, data: { bio: "Gia sư Toán 9.", subjects: ["Toán 9"] } });

  const post = async (as: any, body: Record<string, unknown>) => (await api("POST", "/api/community/threads", { as, body })).json;
  const common = await post(T, { content: "Bài chung: ai cũng thấy", category: "kinh-nghiem" });
  const classPost = await post(T, { content: "Bài của lớp: chỉ lớp thấy", category: "kinh-nghiem", courseId: course.id });
  const q = await post(S, { kind: "question", title: "Giải phương trình bậc hai thế nào?", content: "Em không hiểu delta.", category: "hoi-dap" });
  const classQ = await post(S, { kind: "question", title: "Bài tập lớp: đề số 3", content: "Câu 2 làm sao ạ?", category: "hoi-dap", courseId: course.id });
  const rep = (await api("POST", `/api/community/threads/${q.id}/reply`, { as: T, body: { content: "Em tính delta = b² − 4ac trước nhé." } })).json;
  await api("POST", `/api/community/threads/${q.id}/reply`, { as: S, body: { content: "Dạ em cảm ơn cô.", parentReplyId: rep?.id } });
  await api("POST", `/api/community/threads/${classQ.id}/reply`, { as: S, body: { content: "Em làm được rồi ạ." } });
  check("dữ liệu mẫu dựng được qua API", !!common?.id && !!classPost?.id && !!q?.id && !!classQ?.id && !!rep?.id, { common, q });

  await launch();
  const errors: string[] = [];
  const questionCalls: string[] = [];
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => errors.push(String(e)));
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(m.text()); });
    p.on("request", (r: any) => { if (/\/api\/questions(\/|\?|$)/.test(new URL(r.url()).pathname)) questionCalls.push(r.url()); });
  };
  const box = async (loc: any) => (await loc.first().boundingBox()) as { x: number; y: number; width: number; height: number };
  const noOverflow = (p: any) => p.evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`) as Promise<boolean>;
  const open = async (p: any, path: string) => { await p.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 }); await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); }; // không chết nếu mạng không bao giờ yên (dev server); phần tử cần thì có waitFor riêng

  // ───────────────────────────── Khách, 1280
  section("Khách 1280: ba cột, thẻ kẻ 1px, hàng hành động 36px");
  const gctx = await ctxFor(null, { width: 1280, height: 900 });
  const g = await gctx.newPage(); watch(g);
  await open(g, "/cong-dong");
  await g.getByRole("heading", { name: "Cộng đồng", level: 1 }).waitFor({ timeout: 90000 });
  await g.getByText("Bài chung: ai cũng thấy").waitFor({ timeout: 30000 });
  const nav = await box(g.locator("[data-kc-nav]")), main = await box(g.locator(".kc-main")), rail = await box(g.locator(".kc-rail"));
  check("trái 220±2", Math.abs(nav.width - 220) <= 2, nav);
  check("giữa 540–600", main.width >= 540 && main.width <= 600, main);
  check("phải ≥280", rail.width >= 280, rail);
  check("thứ tự trái < giữa < phải (đúng 3 cột)", nav.x + nav.width <= main.x + 1 && main.x + main.width <= rail.x + 1);
  const navItems = await g.locator("[data-kc-nav] .kc-nav-item").allInnerTexts();
  check("khách: ba mục (Bảng tin, Hỏi đáp, Đã lưu); 'Lớp của tôi' ẩn", navItems.join("|") === "Bảng tin|Hỏi đáp|Đã lưu" && (await g.locator("#community-scope").count()) === 0, navItems);
  const card = g.locator("[data-feed-card]").first();
  const cs = await card.evaluate((el: Element) => { const s = getComputedStyle(el); return { shadow: s.boxShadow, top: s.borderTopWidth, left: s.borderLeftWidth, bottom: s.borderBottomWidth }; });
  check("thẻ bài: không bóng, không viền quanh, kẻ dưới 1px", cs.shadow === "none" && cs.top === "0px" && cs.left === "0px" && cs.bottom === "1px", cs);
  const ah = Math.round((await box(card.locator(".kc-act").first())).height);
  check("hàng hành động cao 36±1 ở chuột", Math.abs(ah - 36) <= 1, ah);
  const acts = (await card.locator(".kc-act").allInnerTexts()).join(" ");
  check("hàng hành động có đủ Thích · Bình luận · Lưu · Báo cáo", ["Thích", "Bình luận", "Lưu", "Báo cáo"].every(t => acts.includes(t)), acts);
  check("không cuộn ngang", await noOverflow(g));
  const gtxt = await g.locator("main").innerText(); // chỉ khu cộng đồng; header/nav khách (có "Tin tức") là chrome chung, không thuộc phạm vi quét
  check("không chữ về xu / ví / xếp hạng / nhắn tin trên khu này", !FORBIDDEN.test(gtxt), gtxt.match(FORBIDDEN)?.[0]);
  check("khách KHÔNG thấy bài của lớp", !gtxt.includes("Bài của lớp: chỉ lớp thấy"));
  check("tên học sinh rút gọn 'Bích T.', không lộ 'Trần Thị Bích'", gtxt.includes("Bích T.") && !gtxt.includes("Trần Thị Bích"));
  await shot(g, "cong-dong-1280-khach");

  section("Khách: Thích → đăng nhập quay lại đúng chỗ");
  await Promise.all([g.waitForURL(/\/dang-nhap\?redirect=/, { timeout: 30000 }), g.locator("[data-feed-card]").first().locator("[data-act=like]").click()]);
  check("redirect trỏ về /cong-dong", decodeURIComponent(g.url()).includes("redirect=/cong-dong"), g.url());

  section("Khách: ô hỏi (POST + 303), bài chờ duyệt không hiện");
  await open(g, "/cong-dong");
  await g.getByRole("heading", { name: "Cộng đồng", level: 1 }).waitFor({ timeout: 60000 });
  const guestForm = g.locator("[data-kc-guest-form]");
  if ((await g.locator("[data-kc-guest-box] details").count()) === 0) {
    check("cờ KIN_GUEST_QUESTIONS tắt: chỉ còn lời mời 'Đăng nhập để đặt câu hỏi'", await g.getByText("Đăng nhập để đặt câu hỏi").isVisible());
  } else {
    await g.locator("[data-kc-guest-box] summary").click();
    check("có ô bẫy ẩn 'website' (ra khỏi màn hình, tabindex -1)", (await guestForm.locator('input[name="website"]').getAttribute("tabindex")) === "-1");
    check("form khách POST tới /api/community/guest-questions, không có ô ảnh/tệp", (await guestForm.getAttribute("method"))?.toUpperCase() === "POST" && (await guestForm.getAttribute("action")) === "/api/community/guest-questions" && (await guestForm.locator('input[type="file"]').count()) === 0);
    await guestForm.locator('input[name="name"]').fill("Bạn Khách");
    await guestForm.locator('input[name="title"]').fill("Làm sao học tốt hình học?");
    await guestForm.locator('textarea[name="content"]').fill("Em hay mất điểm ở phần chứng minh, có cách nào không ạ?");
    await Promise.all([g.waitForURL(/da-gui=1/, { timeout: 30000 }), guestForm.getByRole("button", { name: "Gửi câu hỏi" }).click()]);
    await g.getByText("Đã nhận. Câu hỏi sẽ hiện sau khi được duyệt.").waitFor({ timeout: 30000 });
    check("lời xác nhận hiện", true);
    await open(g, "/cong-dong");
    check("tải lại: KHÔNG thấy câu hỏi của mình (đang chờ duyệt)", (await g.getByText("Làm sao học tốt hình học?").count()) === 0);
    const pend = await api("GET", "/api/community/moderation/pending", { as: A });
    const mine = pend.json?.items?.find((i: any) => i.title === "Làm sao học tốt hình học?");
    check("quản trị thấy trong hàng chờ", !!mine, pend.json);
    if (mine) {
      await api("POST", `/api/community/moderation/${mine.id}`, { as: A, body: { decision: "approve" } });
      await open(g, "/cong-dong");
      await g.getByText("Làm sao học tốt hình học?").first().waitFor({ timeout: 30000 });
      check("sau khi duyệt: khách tải lại thấy, có thẻ 'Khách'", (await g.locator("[data-feed-card]", { hasText: "Làm sao học tốt hình học?" }).getByText("Khách", { exact: true }).count()) > 0);
    }
  }

  section("Khách: hồ sơ gia sư xem được, hồ sơ học sinh 'Không tìm thấy'");
  await open(g, `/cong-dong/ho-so/${T.id}`);
  await g.getByRole("heading", { name: "Cô Lan", level: 1 }).waitFor({ timeout: 60000 });
  const ptxt = await g.locator("main").innerText();
  check("hồ sơ gia sư: thẻ 'Gia sư', môn, hai số, nút 'Xem hồ sơ gia sư' → /mentor/<id>", ptxt.includes("Gia sư") && ptxt.includes("Toán 9") && /bài viết/.test(ptxt) && /câu trả lời/.test(ptxt)
    && (await g.getByRole("link", { name: "Xem hồ sơ gia sư" }).getAttribute("href")) === `/mentor/${T.id}`);
  check("hồ sơ không có nút nhắn / theo dõi / liên hệ", !/Nhắn|Theo dõi|Zalo|Số điện thoại|@/.test(ptxt.replace(/\S+@\S+\.test/g, "")), ptxt.slice(0, 200));
  check("lưới 3 cột 1:1", await g.locator(".kc-pgrid").evaluate((el: Element) => getComputedStyle(el).gridTemplateColumns.split(" ").length === 3));
  await shot(g, "cong-dong-1280-ho-so");
  await open(g, `/cong-dong/ho-so/${S.id}`);
  await g.getByText("Không tìm thấy hồ sơ").waitFor({ timeout: 60000 });
  check("hồ sơ học sinh → 'Không tìm thấy'", true);
  await open(g, `/cong-dong/${classPost.id}`);
  await g.getByText("Không tìm thấy bài viết").waitFor({ timeout: 60000 });
  check("bài của lớp với khách → 'Không tìm thấy bài viết' (không lộ)", true);

  // ───────────────────────────── Học sinh 1280 (vỏ hẹp = 3 cột, vỏ rộng = 2 cột)
  section("Học sinh 1280: vỏ thu gọn → 3 cột; vỏ rộng → 2 cột (không vỡ)");
  const sctx = await ctxFor(S, { width: 1280, height: 900, rail: "mo" });
  const s = await sctx.newPage(); watch(s);
  await open(s, "/cong-dong");
  await s.getByText("Bài của lớp: chỉ lớp thấy").waitFor({ timeout: 90000 });
  const n3 = await box(s.locator("[data-kc-nav]")), m3 = await box(s.locator(".kc-main")), r3 = await box(s.locator(".kc-rail"));
  check("vỏ thu gọn: đủ 3 cột, trái 220±2, giữa 540–600, phải ≥280", Math.abs(n3.width - 220) <= 2 && m3.width >= 540 && m3.width <= 600 && r3.width >= 280 && n3.x < m3.x && m3.x < r3.x, { n3, m3, r3 });
  check("học sinh: đủ bốn mục điều hướng (Lớp của tôi hiện vì có lớp)", (await s.locator("#community-scope").count()) === 1 && (await s.locator("[data-kc-nav] .kc-nav-item").allInnerTexts()).join("|") === "Bảng tin|Hỏi đáp|Đã lưu");
  check("thấy cả bài lớp và bài chung", await s.getByText("Bài chung: ai cũng thấy").isVisible());
  check("không cuộn ngang", await noOverflow(s));
  await shot(s, "cong-dong-1280-hoc-sinh");
  const wctx = await ctxFor(S, { width: 1280, height: 900, rail: "rong" });
  const w = await wctx.newPage(); watch(w);
  await open(w, "/cong-dong");
  await w.getByText("Bài chung: ai cũng thấy").waitFor({ timeout: 90000 });
  const nw = await box(w.locator("[data-kc-nav]")), mw = await box(w.locator(".kc-main"));
  check("vỏ rộng: hạ xuống 2 cột — dải chip nằm TRÊN cột giữa, không tràn", nw.y + nw.height <= mw.y + 2 && (await noOverflow(w)), { nw, mw });
  await shot(w, "cong-dong-1280-vo-rong");

  section("Học sinh: đăng bài (bấm đúp = một bài), Thích, Lưu, Báo cáo");
  await s.getByText("Bạn muốn hỏi hay chia sẻ gì?").click();
  await s.getByLabel("Nội dung bài viết").fill("Mẹo nhớ công thức lượng giác");
  await s.getByRole("button", { name: "Đăng", exact: true }).dblclick();
  await s.getByText("Mẹo nhớ công thức lượng giác").first().waitFor({ timeout: 30000 });
  await eventually("bài xuất hiện đúng một lần ở đầu feed", async () => (await s.locator("[data-feed-card]", { hasText: "Mẹo nhớ công thức lượng giác" }).count()) === 1);
  check("bài mới nằm đầu feed", ((await s.locator("[data-feed-card]").first().innerText()).includes("Mẹo nhớ công thức lượng giác")));
  const others = s.locator("[data-feed-card]", { hasText: "Bài chung: ai cũng thấy" });
  await others.locator("[data-act=like]").click();
  await eventually("Thích: aria-pressed=true, số đếm tăng", async () => (await others.locator("[data-act=like]").getAttribute("aria-pressed")) === "true");
  await others.locator("[data-act=save]").click();
  await eventually("Lưu: aria-pressed=true", async () => (await others.locator("[data-act=save]").getAttribute("aria-pressed")) === "true");
  await others.locator("[data-act=report]").click();
  await s.getByLabel("Lý do báo cáo").fill("Thử báo cáo");
  await s.getByRole("button", { name: "Gửi báo cáo" }).click();
  await others.getByText("Đã báo cáo").first().waitFor({ timeout: 30000 });
  check("Báo cáo xong: nút đổi thành 'Đã báo cáo'", true);
  await open(s, "/cong-dong?tab=da-luu");
  await s.getByText("Bài chung: ai cũng thấy").waitFor({ timeout: 60000 });
  check("'Đã lưu' thấy bài vừa lưu", true);
  const sh = await s.locator('a[href="/student/cong-dong"]').first().getAttribute("aria-current").catch(() => null);
  check("mục 'Cộng đồng' của vỏ học sinh vẫn sáng ở ?tab=da-luu", sh === "page", sh);
  await open(s, `/cong-dong/ho-so/${T.id}`);
  await s.getByRole("heading", { name: "Cô Lan", level: 1 }).waitFor({ timeout: 60000 });
  check("mục 'Cộng đồng' vẫn sáng ở /cong-dong/ho-so/<id>", (await s.locator('a[href="/student/cong-dong"]').first().getAttribute("aria-current").catch(() => null)) === "page");

  section("Chi tiết bài: trả lời lồng 1 cấp, gia sư có danh tính");
  await open(s, `/cong-dong/${q.id}`);
  await s.getByText("Em tính delta = b² − 4ac trước nhé.").waitFor({ timeout: 60000 });
  const tutorReply = s.locator('[data-kc-reply]', { hasText: "Em tính delta" });
  check("trả lời của gia sư: tên đầy đủ 'Cô Lan', thẻ 'Gia sư', liên kết hồ sơ", (await tutorReply.getByText("Gia sư", { exact: true }).count()) > 0 && (await tutorReply.getByRole("link", { name: "Cô Lan" }).getAttribute("href")) === `/cong-dong/ho-so/${T.id}`);
  check("trả lời con thụt vào trong khung `kc-reply-indent`", (await s.locator(".kc-reply-indent [data-kc-reply]", { hasText: "Dạ em cảm ơn cô." }).count()) === 1);
  await s.locator('[data-kc-reply]', { hasText: "Dạ em cảm ơn cô." }).getByRole("button", { name: "Trả lời" }).click();
  await s.getByLabel("Nội dung trả lời").fill("Em hiểu rồi!");
  await s.getByRole("button", { name: "Gửi", exact: true }).click();
  await s.getByText("Em hiểu rồi!").waitFor({ timeout: 30000 });
  check("'Trả lời' dưới trả lời con vẫn gắn vào cha gốc (vẫn đúng 1 cấp: 2 con dưới 1 cha)", (await s.locator(".kc-reply-indent").first().locator("[data-kc-reply]").count()) === 2);
  check("chủ câu hỏi thấy 'Chọn là đúng'", (await s.getByRole("button", { name: "Chọn là đúng" }).count()) > 0);
  await shot(s, "cong-dong-1280-chi-tiet");

  // ───────────────────────────── Gia sư
  section("Gia sư chủ lớp: 'Chọn là đúng'; học sinh ngoài lớp: không thấy bài lớp");
  const tctx = await ctxFor(T, { width: 1280, height: 900 });
  const t = await tctx.newPage(); watch(t);
  await open(t, `/cong-dong/${classQ.id}`);
  await t.getByText("Em làm được rồi ạ.").waitFor({ timeout: 90000 });
  check("gia sư chủ lớp thấy 'Chọn là đúng' ở câu hỏi của lớp", (await t.getByRole("button", { name: "Chọn là đúng" }).count()) > 0);
  const o2 = await (await ctxFor(S2, { width: 1280, height: 900 })).newPage(); watch(o2);
  await open(o2, `/cong-dong/${classQ.id}`);
  await o2.getByText("Không tìm thấy bài viết").waitFor({ timeout: 60000 });
  check("học sinh khác lớp: 'Không tìm thấy bài viết'", true);
  await open(o2, "/cong-dong?tab=da-luu");
  await o2.getByText("Bạn chưa lưu bài nào.").waitFor({ timeout: 60000 });
  check("rỗng: 'Bạn chưa lưu bài nào.' (không nhắc xu)", true);

  // ───────────────────────────── Ba trạng thái
  section("Ba trạng thái: lỗi + Thử lại, rỗng");
  const pg = await (await ctxFor(S, { width: 1280, height: 900 })).newPage(); watch(pg);
  await pg.route("**/api/community/feed*", r => r.abort());
  await pg.goto(`${BASE}/cong-dong`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.getByText("Không tải được").first().waitFor({ timeout: 90000 });
  const retry = pg.getByRole("button", { name: "Thử lại" });
  check("lỗi: có nút 'Thử lại' cao ≥44px", (await retry.boundingBox())!.height >= 44);
  await api("DELETE", `/api/community/threads/${common.id}`, { as: A });
  await pg.unroute("**/api/community/feed*");
  await retry.click();
  await pg.getByText("Mẹo nhớ công thức lượng giác").first().waitFor({ timeout: 60000 });
  check("sau khi quản trị xoá bài, 'Thử lại' không còn hiện bài đó", (await pg.getByText("Bài chung: ai cũng thấy").count()) === 0);
  await open(pg, "/cong-dong?tab=goc-vui");
  await pg.getByText("Chưa có bài viết. Hãy là người đầu tiên chia sẻ.").waitFor({ timeout: 60000 });
  check("rỗng: đúng chữ + liên kết đi tiếp", (await pg.getByRole("link", { name: "Xem Hỏi đáp" }).count()) > 0);

  // ───────────────────────────── 390 và 320
  for (const width of [390, 320]) {
    section(`Học sinh ${width}: một cột Threads`);
    const mp = await (await ctxFor(S, { width, height: 844 })).newPage(); watch(mp);
    await open(mp, "/cong-dong");
    await mp.locator("[data-feed-card]").first().waitFor({ timeout: 90000 });
    check("một cột: không có cột phải", !(await mp.locator(".kc-rail").isVisible()));
    check("cột đường thread rộng 48, avatar 36", Math.round((await box(mp.locator("[data-feed-card] .kc-col1"))).width) === 48 && Math.round((await box(mp.locator("[data-feed-card] .kc-avatar"))).width) === 36);
    const hs = await mp.locator("[data-feed-card]").first().locator(".kc-act:visible").evaluateAll((els: Element[]) => els.map(e => Math.round(e.getBoundingClientRect().height)));
    check("nút hành động cao ≥44", hs.length >= 3 && hs.every((h: number) => h >= 44), hs);
    check("'Báo cáo' ẩn dưới dấu '…' (nút Thêm hiện)", !(await mp.locator("[data-feed-card] [data-act=report]").first().isVisible()) && (await mp.locator("[data-feed-card]", { hasText: "Bài của lớp: chỉ lớp thấy" }).getByRole("button", { name: "Thêm" }).isVisible()));
    const chips = await mp.locator("[data-kc-nav] .kc-nav-item, [data-kc-nav] select").evaluateAll((els: Element[]) => els.map(e => Math.round(e.getBoundingClientRect().height)));
    check("chip điều hướng cao ≥44", chips.length >= 3 && chips.every((h: number) => h >= 44), chips);
    check("không tràn ngang", await noOverflow(mp));
    await mp.addStyleTag({ content: "html{font-size:130% !important}" });
    check("chữ phóng 130% không tràn ngang", await noOverflow(mp));
    await shot(mp, `cong-dong-${width}-bang-tin`);
    await open(mp, `/cong-dong/${q.id}`);
    await mp.getByText("Dạ em cảm ơn cô.").waitFor({ timeout: 60000 });
    const lineW = await mp.locator("[data-kc-line]").first().evaluate((el: Element) => Math.round(el.getBoundingClientRect().width));
    check("đường dọc 1px nối avatar", lineW === 1, lineW);
    const parent = await box(mp.locator("[data-kc-reply]", { hasText: "Em tính delta" })), child = await box(mp.locator(".kc-reply-indent [data-kc-reply]").first());
    check("trả lời con thụt đúng 48px", Math.round(child.x - parent.x) === 48, { parent: parent.x, child: child.x });
    check("chi tiết: không tràn ngang", await noOverflow(mp));
    await shot(mp, `cong-dong-${width}-chi-tiet`);
    await open(mp, `/cong-dong/ho-so/${T.id}`);
    await mp.getByRole("heading", { name: "Cô Lan", level: 1 }).waitFor({ timeout: 60000 });
    check("hồ sơ: lưới 3 cột, không tràn ngang", (await mp.locator(".kc-pgrid").evaluate((el: Element) => getComputedStyle(el).gridTemplateColumns.split(" ").length)) === 3 && (await noOverflow(mp)));
    await shot(mp, `cong-dong-${width}-ho-so`);
  }

  // ───────────────────────────── Quét tĩnh + lỗi trang
  section("Quét: không mã hex, không chữ Coin, không gọi /api/questions từ giao diện mới");
  const files: string[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx|ts|css)$/.test(n)) files.push(p); } };
  walk(join(process.cwd(), "src/components/community")); walk(join(process.cwd(), "src/app/(guest)/cong-dong"));
  const HEX = /(?<![\w&/#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])/;
  const own = files.filter(f => !/ThreadDetailShared\.tsx$/.test(f)); // tệp cũ còn dùng cho ThreadModal (ngoài phạm vi BU-05), có ngoại lệ riêng ở t-no-hex
  check("giao diện mới không có mã hex", own.every(f => !readFileSync(f, "utf8").split("\n").some(l => HEX.test(l))), own.filter(f => readFileSync(f, "utf8").split("\n").some(l => HEX.test(l))));
  check("giao diện mới không còn chữ xu / Coin / QUESTION_COST", own.every(f => !/\bxu\b|Coin|🪙|QUESTION_COST|ANSWER_REWARD/.test(readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""))));
  check("0 yêu cầu tới /api/questions từ giao diện mới", questionCalls.length === 0, questionCalls.slice(0, 3));
  check("không lỗi trang / console", errors.length === 0, errors.slice(0, 3));

  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
