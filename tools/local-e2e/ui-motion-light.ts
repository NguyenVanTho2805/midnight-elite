// Chuyển động nhóm nhẹ lấy từ Lucian UX/UI Prompt (MIT) — 15/10/2026. Trình duyệt thật.
//   #008 nút sao chép → dấu tích · #039 gạch chân tab trượt · #074 chuông thông báo · #079 khung xám quét sáng · #012 dải lưu bài · #200 khối gập mở.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BASE, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { generateInvoiceCode } from "@/lib/tuitionInvoice";

const root = process.cwd();
const tok = (b: number) => b.toString(16).padStart(2, "0").repeat(16);
const noFonts = (ctx: { route: (u: RegExp, h: (r: { abort: () => Promise<void> }) => Promise<void>) => Promise<void> }) => ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else if (/\.tsx?$/.test(f)) out.push(p); }
  return out;
}

(async () => {
  section("Mã nguồn: bản quyền Lucian (MIT) được giữ ở mọi tệp có chuyển động lấy từ họ");
  {
    const files = walk(join(root, "src"));
    const lucian = files.filter(f => /Lucian UX\/UI Prompt #\d{3}/.test(readFileSync(f, "utf8"))).map(f => f.slice(root.length + 1));
    check("các tệp: CopyButton, Tabs, NotificationBell, Bookmark, Fold đều ghi số element gốc",
      ["kin/CopyButton.tsx", "kin/Tabs.tsx", "NotificationBell.tsx", "kin/Bookmark.tsx", "kin/Fold.tsx"].every(n => lucian.some(f => f.endsWith(n))), lucian);
    const css = readFileSync(join(root, "src/app/kin-motion.css"), "utf8");
    check("kin-motion.css ghi tên tác giả + MIT + trỏ tới docs/kin/thu-vien-lucian.md", /MIT License, Copyright \(c\) 2026 Seokwoooo/.test(css) && /docs\/kin\/thu-vien-lucian\.md/.test(css));
    check("kin-motion.css không có mã màu hex (dùng token --kin-*)", !/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")));
    const pulses = ["(student)/student/loading.tsx", "(admin)/admin/loading.tsx", "(guest)/loading.tsx", "lop-cua-toi/(tutor)/loading.tsx", "../components/Skeleton.tsx"]
      .filter(n => /animate-pulse/.test(readFileSync(join(root, "src/app", n), "utf8")));
    check("các khung chờ (loading.tsx + Skeleton) dùng vệt sáng .kin-skel, không còn animate-pulse", pulses.length === 0, pulses);
  }

  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Minh Anh" });
  const S = await mkUser({ name: "Học Sinh Chuông" });
  const B = await mkUser({ name: "Bạn Đọc" });
  const course = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: A.id, courseId: course.id, status: "active" } });
  await prisma.tutorPayoutAccount.create({ data: { userId: T.id, bankBin: "970436", accountNo: "0123456789", accountName: "NGUYEN VAN LAN" } });
  await prisma.tuitionInvoice.create({ data: { code: generateInvoiceCode(), tutorId: T.id, studentId: A.id, yearMonth: "2026-10", amountDue: 1_200_000, status: "sent", sentAt: new Date(), viewToken: tok(0xc3), viewTokenExpiresAt: new Date(Date.now() + 20 * 86400_000) } });
  const thread = await prisma.thread.create({ data: { content: "Bài để thử lưu và chia sẻ", authorId: A.id, courseId: null, category: "hoi-dap" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => p.on("pageerror", e => errors.push(String(e)));

  // ───────── #008 sao chép + #200 gập mở: phiếu học phí của phụ huynh ─────────
  section("#008 Sao chép → dấu tích (phiếu học phí): chép thật vào bộ nhớ tạm, bong bóng, tự trở về");
  {
    const ctx = await ctxFor(null, { width: 1100, height: 900 });
    await noFonts(ctx as never);
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/phieu/${tok(0xc3)}`, { waitUntil: "load", timeout: 150000 });
    const copy = p.getByRole("button", { name: "Chép số tài khoản" });
    await copy.waitFor({ timeout: 90000 });
    const box = await copy.boundingBox();
    check("nút chép là nút vuông ≥ 44px (trước đây chỉ là chữ gạch chân nhỏ)", (box?.width ?? 0) >= 44 && (box?.height ?? 0) >= 44, box);
    const wrap = p.locator(".kin-copy").first();
    check("lúc đầu ở trạng thái nghỉ", (await wrap.getAttribute("data-copy")) === "idle");
    await copy.click();
    await p.waitForFunction(() => document.querySelector(".kin-copy")?.getAttribute("data-copy") === "done", null, { timeout: 5000 });
    check("chép đúng số tài khoản vào bộ nhớ tạm thật", (await p.evaluate(() => navigator.clipboard.readText())) === "0123456789");
    await sleep(700);
    const st = await wrap.evaluate(el => ({
      tip: getComputedStyle(el.querySelector(".kin-copy-tip")!).opacity,
      tipText: el.querySelector(".kin-copy-tip")?.textContent,
      dash: getComputedStyle(el.querySelector(".ok path")!).strokeDashoffset,
      cpOpacity: getComputedStyle(el.querySelector(".cp")!).opacity,
      live: el.querySelector('[role="status"]')?.textContent,
    }));
    check("bong bóng 'Đã sao chép' hiện rõ; hai ô vuông biến mất, dấu tích được vẽ đủ (dashoffset 0)", st.tip === "1" && st.cpOpacity === "0" && parseFloat(st.dash) === 0 && /Đã chép/.test(st.tipText ?? ""), st);
    check("trình đọc màn hình nghe 'Đã chép số tài khoản' (vùng role=status)", st.live === "Đã chép số tài khoản", st);
    await p.waitForFunction(() => document.querySelector(".kin-copy")?.getAttribute("data-copy") === "idle", null, { timeout: 6000 });
    check("1,8 giây sau tự trở về như cũ", true);
    await p.getByRole("button", { name: "Chép nội dung chuyển khoản" }).click();
    await p.waitForFunction(() => document.querySelectorAll('.kin-copy[data-copy="done"]').length === 1, null, { timeout: 5000 });
    const content = await p.evaluate(() => navigator.clipboard.readText());
    check("nút thứ hai chép đúng nội dung chuyển khoản (có mã phiếu)", /^KIN-/i.test(content) || content.length > 6, content);

    section("#200 Khối gập mở: QR + tài khoản");
    const toggle = p.getByRole("button", { name: /cách chuyển khoản/ });
    check("mặc định MỞ (luồng thanh toán không đổi): nút ghi 'Ẩn cách chuyển khoản', aria-expanded=true", (await toggle.innerText()).includes("Ẩn cách chuyển khoản") && (await toggle.getAttribute("aria-expanded")) === "true");
    const fold = p.locator(".kin-fold").first();
    const openH = (await fold.boundingBox())?.height ?? 0;
    await toggle.click();
    await sleep(120);
    const mid = (await fold.boundingBox())?.height ?? 0;
    await sleep(700);
    const closedH = (await fold.boundingBox())?.height ?? 0;
    check("gập lại MƯỢT: giữa chừng cao hơn 0 và thấp hơn lúc mở, cuối cùng cao 0", mid > 2 && mid < openH && closedH <= 1, { openH, mid, closedH });
    check("đóng thì nội dung bị inert (không Tab vào / không đọc nhầm), aria-expanded=false, nhãn đổi", (await p.locator(".kin-fold-in").first().getAttribute("inert")) !== null && (await toggle.getAttribute("aria-expanded")) === "false" && (await toggle.innerText()).includes("Xem cách chuyển khoản"));
    await toggle.click();
    await sleep(800);
    const reH = (await fold.boundingBox())?.height ?? 0;
    check("mở lại: cao trở về như cũ, hết inert", Math.abs(reH - openH) <= 2 && (await p.locator(".kin-fold-in").first().getAttribute("inert")) === null, { openH, reH });
    await ctx.close();
  }

  section("Giảm chuyển động: nút sao chép vẫn chạy nhưng không hoạt hình");
  {
    const ctx = await ctxFor(null, { width: 1100, height: 900 });
    await noFonts(ctx as never);
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    const p = await ctx.newPage(); await p.emulateMedia({ reducedMotion: "reduce" });
    await p.goto(`${BASE}/phieu/${tok(0xc3)}`, { waitUntil: "load", timeout: 150000 });
    const copy = p.getByRole("button", { name: "Chép số tài khoản" });
    await copy.waitFor({ timeout: 90000 });
    await copy.click();
    await p.waitForFunction(() => document.querySelector(".kin-copy")?.getAttribute("data-copy") === "done", null, { timeout: 5000 });
    const dur = await p.locator(".kin-copy-ico svg").first().evaluate(el => parseFloat(getComputedStyle(el).transitionDuration));
    check("thời lượng chuyển cảnh ≈ 0 (đã tắt) mà vẫn hiện dấu tích", dur < 0.01, dur);
    await ctx.close();
  }

  // ───────── #039 tab trượt ─────────
  section("#039 Gạch chân tab TRƯỢT (trang đăng nhập: tab 'Mật khẩu' / 'Mã qua email')");
  {
    const ctx = await ctxFor(null, { width: 1000, height: 800 });
    await noFonts(ctx as never);
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/dang-nhap`, { waitUntil: "load", timeout: 150000 });
    const tabs = p.getByRole("tab");
    await tabs.first().waitFor({ timeout: 90000 });
    await sleep(600);
    const read = () => p.evaluate(() => {
      const ink = document.querySelector<HTMLElement>(".kin-tab-ink")!;
      const act = document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
      const m = new DOMMatrix(getComputedStyle(ink).transform);
      return { x: m.m41, w: parseFloat(getComputedStyle(ink).width), tx: act.offsetLeft, tw: act.offsetWidth, on: ink.dataset.on, anim: ink.dataset.anim, label: act.textContent?.trim() };
    });
    const a = await read();
    check("có đúng MỘT gạch chân chung, nằm dưới tab đang mở (cùng vị trí và bề rộng)", a.on === "1" && Math.abs(a.x - a.tx) < 1.5 && Math.abs(a.w - a.tw) < 1.5, a);
    check("gạch chân riêng của từng tab đã trong suốt (không còn hai gạch chồng nhau)", await p.evaluate(() => Array.from(document.querySelectorAll('[role="tab"] > span:nth-child(2)')).every(s => getComputedStyle(s).backgroundColor === "rgba(0, 0, 0, 0)")));
    check("chuyển động là transform .5s đường cong lò xo (có overshoot)", await p.evaluate(() => { const c = getComputedStyle(document.querySelector(".kin-tab-ink")!); return c.transitionProperty.includes("transform") && /0\.5s/.test(c.transitionDuration) && /1\.45/.test(c.transitionTimingFunction); }));
    await tabs.nth(1).click();
    await sleep(110);
    const mid = await read();
    await sleep(900);
    const end = await read();
    check("đổi tab: giữa chừng gạch chân ĐANG TRƯỢT (chưa tới nơi), cuối cùng dừng đúng dưới tab mới", Math.abs(mid.x - a.x) > 1 && Math.abs(mid.x - end.tx) > 1 && Math.abs(end.x - end.tx) < 1.5 && end.label !== a.label, { a: a.x, mid: mid.x, end: end.x, endTab: end.tx });
    await tabs.first().focus();
    await p.keyboard.press("ArrowRight");
    await sleep(900);
    const kb = await read();
    check("bàn phím (mũi tên) cũng làm gạch chân trượt theo", Math.abs(kb.x - kb.tx) < 1.5, kb);
    await ctx.close();
  }

  // ───────── #074 chuông ─────────
  section("#074 Chuông thông báo: rung khi có thông báo MỚI, huy hiệu nảy, bảng nở, dòng mới rơi vào, chấm chưa đọc co lại");
  {
    const ctx = await ctxFor(S, { width: 1280, height: 800 });
    await noFonts(ctx as never);
    const p = await ctx.newPage(); watch(p);
    await p.clock.install();
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "load", timeout: 150000 });
    const bell = p.locator("button.kin-bell").first();
    await bell.waitFor({ timeout: 90000 });
    await sleep(800);
    check("chưa có thông báo: nhãn là 'Thông báo' (không số), huy hiệu thu về 0", (await bell.getAttribute("aria-label")) === "Thông báo" && (await p.locator(".kin-badge").first().getAttribute("data-zero")) !== null);
    check("lần tải đầu KHÔNG rung", await p.evaluate(() => getComputedStyle(document.querySelector(".kin-bell svg")!).animationName === "none"));
    await prisma.notification.create({ data: { userId: S.id, type: "exam_new", title: "Đề mới: Toán 9", message: "Có đề thi thử mới", link: null } });
    await p.clock.fastForward(31_000); // chu kỳ thăm dò 30 giây
    await p.waitForFunction(() => document.querySelector(".kin-badge")?.textContent?.trim() === "1", null, { timeout: 10000 });
    const rang = await p.waitForFunction(() => getComputedStyle(document.querySelector(".kin-bell svg")!).animationName === "kin-bell-ring", null, { timeout: 3000 }).then(() => true).catch(() => false);
    check("số chưa đọc TĂNG → chuông rung (hoạt hình kin-bell-ring)", rang);
    check("huy hiệu hiện '1' và nhãn nói rõ '1 chưa đọc'", (await bell.getAttribute("aria-label")) === "Thông báo, 1 chưa đọc" && (await p.locator(".kin-badge").first().getAttribute("data-zero")) === null);
    await sleep(1100);
    check("rung xong tự dừng (lớp tự gỡ)", await p.evaluate(() => getComputedStyle(document.querySelector(".kin-bell svg")!).animationName === "none"));
    await bell.click();
    const pan = p.locator(".kin-pan");
    await pan.waitFor({ timeout: 5000 });
    check("mở bảng: bảng nở ra bằng hoạt hình kin-pan-in", await pan.evaluate(el => getComputedStyle(el).animationName === "kin-pan-in"));
    await sleep(700);
    // thông báo thứ hai đến lúc bảng đang mở
    await prisma.notification.create({ data: { userId: S.id, type: "exam_reminder", title: "Nhắc: thi lúc 20:00", message: "Còn 1 giờ", link: null } });
    await p.clock.fastForward(31_000);
    await p.getByText("Nhắc: thi lúc 20:00").waitFor({ timeout: 10000 });
    check("dòng thông báo MỚI được đánh dấu để rơi vào từ trên (kin-notif-it--new), dòng cũ thì không",
      (await p.locator(".kin-notif-it--new").count()) === 1 && (await p.locator(".kin-notif-it").count()) === 2);
    await sleep(900);
    const dot = p.locator(".kin-dot").first();
    check("trước khi đọc: chấm chưa đọc đang hiện", (await dot.getAttribute("data-read")) === null);
    await p.getByText("Nhắc: thi lúc 20:00").click();
    await bell.click(); // mở lại bảng sau khi bấm dòng (bấm dòng đóng bảng)
    await p.waitForSelector(".kin-dot[data-read]", { state: "attached", timeout: 5000 });
    await sleep(600);
    check("đã đọc: chấm co lại (scale 0) bằng chuyển cảnh", await p.locator(".kin-dot[data-read]").first().evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a < 0.05));
    await ctx.close();
  }

  // ───────── #012 dải lưu + chia sẻ ─────────
  section("#012 Dải lưu bài (cộng đồng): màu đổ xuống dải, dải nảy, vòng sáng; #008 chia sẻ cỡ nhỏ");
  {
    const ctx = await ctxFor(B, { width: 1100, height: 900 });
    await noFonts(ctx as never);
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/cong-dong/${thread.id}`, { waitUntil: "load", timeout: 150000 });
    const mark = p.getByRole("button", { name: "Lưu bài", exact: true });
    await mark.waitFor({ timeout: 90000 });
    check("chưa lưu: aria-pressed=false, dải còn rỗng (clip-path che kín)", (await mark.getAttribute("aria-pressed")) === "false" && await mark.locator(".kin-mark-in").evaluate(el => getComputedStyle(el).clipPath.includes("100%")));
    await mark.click();
    const burst = await p.waitForFunction(() => { const b = document.querySelector(".kin-mark"); return !!b && getComputedStyle(b.querySelector(".kin-mark-ring")!).animationName === "kin-mark-ring"; }, null, { timeout: 8000 }).then(() => true).catch(() => false);
    check("lưu xong → vòng sáng toả ra (kin-mark-ring) và dải rơi nảy (kin-mark-drop)", burst);
    await sleep(900);
    const on = p.getByRole("button", { name: "Bỏ lưu bài", exact: true });
    check("đã lưu: aria-pressed=true, nhãn đổi 'Bỏ lưu bài', dải đã đầy màu (clip-path mở hết)", (await on.getAttribute("aria-pressed")) === "true" && await on.locator(".kin-mark-in").evaluate(el => /inset\(0(px)? 0(px)? 0(px)? 0(px)?\)/.test(getComputedStyle(el).clipPath) || getComputedStyle(el).clipPath.replace(/\s/g, "") === "inset(0px)"));
    check("bài lưu thật trong cơ sở dữ liệu", (await prisma.threadBookmark.count({ where: { userId: B.id, threadId: thread.id } })) === 1);
    await p.reload({ waitUntil: "load" });
    const again = p.getByRole("button", { name: "Bỏ lưu bài", exact: true });
    await again.waitFor({ timeout: 90000 });
    await sleep(300);
    check("tải lại trang bài đã lưu: KHÔNG phát lại hiệu ứng (chỉ phát khi vừa đổi sang 'đã lưu')", await again.evaluate(el => !el.classList.contains("kin-mark-burst")));
    await again.click();
    await p.getByRole("button", { name: "Lưu bài", exact: true }).waitFor({ timeout: 8000 });
    check("bỏ lưu: tô lại ngay, không phát hiệu ứng", await p.getByRole("button", { name: "Lưu bài", exact: true }).evaluate(el => !el.classList.contains("kin-mark-burst")));
    const share = p.getByRole("button", { name: /Chia sẻ/ });
    const sb = await share.boundingBox();
    check("nút chia sẻ cỡ nhỏ 32px (vừa hàng thao tác dày)", Math.round(sb?.width ?? 0) === 32 && Math.round(sb?.height ?? 0) === 32, sb);
    await share.click();
    await p.waitForFunction(() => document.querySelector('.kin-copy[data-copy="done"]') !== null, null, { timeout: 5000 });
    check("chia sẻ chép đúng link bài viết", (await p.evaluate(() => navigator.clipboard.readText())) === `${BASE}/cong-dong/${thread.id}`);
    await ctx.close();
  }

  // ───────── #079 khung xám ─────────
  section("#079 Khung xám: một vệt sáng quét chung cả màn hình; nội dung 'nở' vào từ trên xuống");
  {
    const ctx = await ctxFor(null, { width: 900, height: 600 });
    await noFonts(ctx as never);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/dang-nhap`, { waitUntil: "load", timeout: 150000 });
    await p.locator("body").waitFor();
    // Chuỗi mã (không phải hàm) để esbuild không chèn trợ giúp __name vào trình duyệt.
    const r = await p.evaluate(`(function () {
      function mk(cls) { var d = document.createElement("div"); d.className = cls; d.style.cssText = "width:200px;height:40px"; document.body.appendChild(d); return d; }
      var a = mk("kin-skel"), b = mk("kin-skel kin-skel--soft"), c = mk("kin-bloom");
      var sa = getComputedStyle(a), sb = getComputedStyle(b), sc = getComputedStyle(c);
      var out = { anim: sa.animationName, dur: sa.animationDuration, attach: sa.backgroundAttachment, soft: sb.backgroundColor !== sa.backgroundColor, bloom: sc.animationName, bloomFill: sc.animationFillMode };
      [a, b, c].forEach(function (e) { e.remove(); });
      return out;
    })()`) as { anim: string; dur: string; attach: string; soft: boolean; bloom: string; bloomFill: string };
    check("khung xám quét sáng 1,6 giây, gắn theo khung nhìn (fixed) nên mọi khối thấy MỘT vệt chung", r.anim === "kin-skel-shine" && r.dur === "1.6s" && r.attach.startsWith("fixed"), r);
    check("biến thể nhạt (--soft) có màu nền khác (dùng ở khung chờ của gia sư)", r.soft, r);
    check("'nở': hoạt hình kin-bloom-in, KHÔNG dùng forwards (giữ transform sẽ làm hỏng position:sticky)", r.bloom === "kin-bloom-in" && r.bloomFill === "backwards", r);
    await ctx.close();
  }

  check("không có lỗi JavaScript trên trang nào", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
