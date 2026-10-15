// Chuyển động trong ứng dụng (Lucian UX/UI Prompt, MIT) — 15/10/2026. Trình duyệt thật.
//   #014 + #093 "Việc của tôi": vòng tiến độ, gạch ngang việc vừa xong, xong hết thì ăn mừng · #028 ô trả lời tự dãn + vòng đếm ký tự ·
//   #040 thanh bên MỞ RỘNG có nhãn + vạch nổi bật trượt (trạng thái thứ ba "rong").
// "Việc của tôi" dùng phản hồi giả có điều khiển (route.fulfill) để quan sát từng bước một việc chuyển sang "đã xong"; các phần còn lại dùng dữ liệu và API thật.
import { BASE, mkUser, mkTutor, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const noFonts = (ctx: { route: (u: RegExp, h: (r: { abort: () => Promise<void> }) => Promise<void>) => Promise<void> }) => ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());

type Item = { id: string; kind: "bai-tap" | "han-nop" | "buoi-hoc"; title: string; subtitle: string; at: string; when: string; status: { label: string; tone: "cho" | "loi" | "mo" | "xong" }; needsAction: boolean; done: boolean; detail: { heading: string; meta: string; commands: []; sections: [] } };
const mk = (id: string, kind: Item["kind"], title: string, o: { needs?: boolean; done?: boolean } = {}): Item => ({ id, kind, title, subtitle: "Toán 9", at: "2026-10-20T10:00:00.000Z", when: "Ngày mai", status: { label: o.done ? "Đã nộp" : "Chưa nộp", tone: o.done ? "xong" : "cho" }, needsAction: !!o.needs, done: !!o.done, detail: { heading: title, meta: "Toán 9", commands: [], sections: [] } });

(async () => {
  await wipe();
  const S = await mkUser({ name: "Học Sinh Việc" });
  const B = await mkUser({ name: "Bạn Trả Lời" });
  const T = await mkTutor("Cô Lan");
  const thread = await prisma.thread.create({ data: { content: "Câu hỏi để thử ô trả lời", authorId: S.id, courseId: null, category: "hoi-dap" } });
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => p.on("pageerror", e => errors.push(String(e)));

  // ───────── Việc của tôi ─────────
  section("#014 + #093 Việc của tôi: vòng tiến độ, gạch ngang việc VỪA xong, xong hết thì ăn mừng (không chặn đọc/làm)");
  {
    let items: Item[] = [mk("a", "bai-tap", "Bài tập 1: Hàm số", { needs: true }), mk("b", "bai-tap", "Bài tập 2: Phương trình", { needs: true }), mk("c", "han-nop", "Nộp phiếu khảo sát", { done: true }), mk("d", "buoi-hoc", "Buổi học tối thứ Ba")];
    const ctx = await ctxFor(S, { width: 1280, height: 900 });
    await noFonts(ctx as never);
    await ctx.route("**/api/student/viec-cua-toi", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items }) }));
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "load", timeout: 150000 });
    const ring = p.locator(".kin-ring");
    await ring.waitFor({ timeout: 90000 });
    check("vòng tiến độ chỉ đếm VIỆC (bài tập, hạn nộp): 1 xong / 3 (2 cần làm + 1 đã xong); buổi học không tính", (await ring.getAttribute("aria-label")) === "Việc đã xong: 1 trên 3" && (await ring.locator(".kin-ring-num").innerText()) === "1/3");
    check("tiến độ ≈ 1/3, vòng đang màu nhấn (chưa xong hết)", Math.abs(parseFloat(await ring.evaluate(el => getComputedStyle(el).getPropertyValue("--p"))) - 1 / 3) < 0.01 && (await ring.getAttribute("data-all")) === null);
    const strikeOf = (id: string) => p.locator(`#viec-${id} .kin-strike`);
    check("việc đã xong từ TRƯỚC: gạch ngang đứng yên ở trạng thái cuối (static), không chạy lại hoạt hình", (await strikeOf("c").getAttribute("data-strike")) === "static" && await strikeOf("c").evaluate(el => getComputedStyle(el, "::after").animationName === "none" && new DOMMatrix(getComputedStyle(el, "::after").transform).a === 1));
    check("việc chưa xong và buổi học: không gạch", (await strikeOf("a").getAttribute("data-strike")) === null && (await strikeOf("d").getAttribute("data-strike")) === null);
    check("dòng phụ lúc này là 'Bài phải nộp và buổi sắp tới' (chưa đổi)", (await p.locator(".kin-swap").getAttribute("data-alt")) === null);
    check("các dòng 'nở' vào theo thứ tự trong danh sách (kin-bloom, trễ 0 / 45 / 90 / 135ms, mỗi dòng một mức) khi danh sách vừa hiện", await p.evaluate(() => { const d = Array.from(document.querySelectorAll<HTMLElement>('[role="option"].kin-bloom')).map(e => e.style.getPropertyValue("--d")); return d.length === 4 && [...d].sort().join() === ["0ms", "135ms", "45ms", "90ms"].sort().join(); }));

    // Bài 1 xong (vd. vừa nộp ở tab khác rồi quay lại)
    items = items.map(i => i.id === "a" ? mk("a", "bai-tap", "Bài tập 1: Hàm số", { done: true }) : i);
    await p.evaluate(() => window.dispatchEvent(new Event("focus")));
    const drew = await p.waitForFunction(() => { const e = document.querySelector('#viec-a .kin-strike'); return !!e && e.getAttribute("data-strike") === "draw" && getComputedStyle(e, "::after").animationName === "kin-strike-draw"; }, null, { timeout: 8000, polling: 16 }).then(() => true).catch(() => false);
    check("việc VỪA xong: nét gạch quét từ trái sang (kin-strike-draw) và tiêu đề xám đi", drew);
    await sleep(900);
    check("quét xong: gạch phủ hết tiêu đề (scaleX 1)", await strikeOf("a").evaluate(el => new DOMMatrix(getComputedStyle(el, "::after").transform).a === 1));
    check("vòng tiến độ nhảy lên 2/3 (đầy dần bằng chuyển cảnh), vẫn chưa ăn mừng", (await ring.locator(".kin-ring-num").innerText()) === "2/3" && Math.abs(parseFloat(await ring.evaluate(el => getComputedStyle(el).getPropertyValue("--p"))) - 2 / 3) < 0.01 && (await ring.getAttribute("data-all")) === null);
    check("việc cũ 'c' KHÔNG bị gạch lại (chỉ dòng vừa đổi mới chạy hoạt hình)", (await strikeOf("c").getAttribute("data-strike")) === "static");

    // Xong nốt → ăn mừng
    items = items.map(i => i.id === "b" ? mk("b", "bai-tap", "Bài tập 2: Phương trình", { done: true }) : i);
    await p.evaluate(() => window.dispatchEvent(new Event("focus")));
    const burst = await p.waitForFunction(() => { const r = document.querySelector(".kin-ring"); return !!r && r.hasAttribute("data-all") && getComputedStyle(r.querySelector(".kin-ring-p")!).animationName === "kin-ring-dot"; }, null, { timeout: 8000, polling: 16 }).then(() => true).catch(() => false);
    check("xong HẾT việc cần làm: vòng đổi màu xong + mười chấm toả ra (kin-ring-dot)", burst);
    await sleep(900);
    const fin = await ring.evaluate(el => ({ num: getComputedStyle(el.querySelector(".kin-ring-num")!).opacity, check: new DOMMatrix(getComputedStyle(el.querySelector(".kin-ring-done")!).transform).a, stroke: getComputedStyle(el.querySelector(".fg")!).stroke, label: el.getAttribute("aria-label") }));
    check("dấu tích bật ra (scale 1), số mờ đi, nhãn đọc '3 trên 3'", parseFloat(fin.num) === 0 && fin.check === 1 && fin.label === "Việc đã xong: 3 trên 3", fin);
    check("dòng phụ đổi sang 'Bạn đã xong hết việc cần làm' bằng chuyển động trượt; câu cũ ẩn khỏi trình đọc màn hình", (await p.locator(".kin-swap").getAttribute("data-alt")) === "" && (await p.locator(".kin-swap > span").first().getAttribute("aria-hidden")) === "true" && (await p.locator(".kin-swap > span").nth(1).getAttribute("aria-hidden")) === null);
    // Mở lại khi đã xong hết từ trước: không ăn mừng lại
    await p.reload({ waitUntil: "load" });
    await p.locator(".kin-ring").waitFor({ timeout: 90000 });
    await sleep(600);
    check("tải lại khi mọi việc đã xong từ trước: vòng ở trạng thái 'xong' NHƯNG không phát lại ăn mừng", (await p.locator(".kin-ring").getAttribute("data-all")) === "" && await p.locator(".kin-ring-p").first().evaluate(el => getComputedStyle(el).animationName === "none"));
    await ctx.close();
  }

  section("#014 Không có việc nào cần ra tay & không có việc đã xong (chỉ buổi học): không hiện vòng tiến độ (tránh '0/0')");
  {
    const ctx = await ctxFor(S, { width: 1280, height: 900 });
    await noFonts(ctx as never);
    await ctx.route("**/api/student/viec-cua-toi", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [mk("d", "buoi-hoc", "Buổi học tối thứ Ba")] }) }));
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "load", timeout: 150000 });
    await p.locator('[role="option"]').first().waitFor({ timeout: 90000 });
    check("không có vòng tiến độ, dòng phụ vẫn là câu thường", (await p.locator(".kin-ring").count()) === 0 && (await p.locator(".kin-swap").getAttribute("data-alt")) === null);
    await ctx.close();
  }

  // ───────── #028 ô trả lời ─────────
  section("#028 Ô trả lời cộng đồng: tự cao dần theo chữ (chuyển cảnh), co lại khi xoá; vòng đếm ký tự đầy dần, gần hết thì phóng to + hiện số còn lại");
  {
    const ctx = await ctxFor(B, { width: 1100, height: 900 });
    await noFonts(ctx as never);
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/cong-dong/${thread.id}`, { waitUntil: "load", timeout: 150000 });
    const ta = p.getByPlaceholder(/^Trả lời /);
    await ta.waitFor({ timeout: 90000 });
    const h0 = (await ta.boundingBox())?.height ?? 0;
    const ring = p.locator(".kin-chars");
    check("lúc đầu: ô cao như 3 dòng, vòng đếm trống, chưa phóng to", h0 > 40 && (await ring.getAttribute("data-near")) === null && parseFloat(await ring.evaluate(el => getComputedStyle(el).getPropertyValue("--p"))) === 0, h0);
    await ta.click();
    await ta.pressSequentially("Dòng một\n".repeat(10), { delay: 0 });
    await sleep(500);
    const h1 = (await ta.boundingBox())?.height ?? 0;
    check("gõ nhiều dòng: ô cao dần lên (không còn thanh cuộn nhỏ xíu)", h1 > h0 + 60, { h0, h1 });
    check("chuyển cảnh chiều cao 0,25 giây (kin-grow)", await ta.evaluate(el => /0\.25s/.test(getComputedStyle(el).transitionDuration) && getComputedStyle(el).transitionProperty.includes("height")));
    await ta.pressSequentially("x".repeat(40), { delay: 0 });
    await ta.fill("Dòng một\n".repeat(60));
    await sleep(500);
    const h2 = (await ta.boundingBox())?.height ?? 0;
    check("quá dài: ô dừng ở mức tối đa 240px rồi mới cuộn (không dãn vô hạn)", Math.round(h2) <= 241 && (await ta.evaluate(el => getComputedStyle(el).overflowY)) === "auto", h2);
    await ta.fill("");
    await sleep(500);
    const h3 = (await ta.boundingBox())?.height ?? 0;
    check("xoá hết chữ: ô co lại về cỡ ban đầu", Math.abs(h3 - h0) <= 2, { h0, h3 });
    await ta.fill("a".repeat(300));
    await sleep(400);
    const mid = parseFloat(await ring.evaluate(el => getComputedStyle(el).getPropertyValue("--p")));
    check("300/1000 ký tự: vòng đầy 30%, chưa phóng to, số còn lại còn ẩn", Math.abs(mid - 0.3) < 0.01 && (await ring.getAttribute("data-near")) === null && (await ring.locator(".kin-chars-left").evaluate(el => getComputedStyle(el).opacity)) === "0", mid);
    await ta.fill("a".repeat(900));
    await sleep(700);
    const near = await ring.evaluate(el => ({ scale: new DOMMatrix(getComputedStyle(el).transform).a, left: el.querySelector(".kin-chars-left")!.textContent, op: getComputedStyle(el.querySelector(".kin-chars-left")!).opacity, stroke: getComputedStyle(el.querySelector(".fg")!).stroke, title: el.getAttribute("title") }));
    check("900/1000 (còn 100 ≤ 12%): vòng phóng to 1,25 lần, hiện số '100', đổi sang màu chờ", Math.abs(near.scale - 1.25) < 0.02 && near.left === "100" && near.op === "1" && near.title === "900/1000 ký tự", near);
    await ta.fill("a".repeat(1000));
    await sleep(500);
    check("đủ 1000: vòng đầy, số còn '0'; ô chặn gõ thêm (maxLength)", (await ta.inputValue()).length === 1000 && (await ring.locator(".kin-chars-left").textContent()) === "0");
    check("trình đọc màn hình: vùng role=status báo 'Còn 0 ký tự' đúng lúc chạm mốc", (await ring.locator('[role="status"]').textContent()) === "Còn 0 ký tự");
    await ctx.close();
  }

  // ───────── #040 thanh bên rộng ─────────
  section("#040 Thanh bên MỞ RỘNG 220px có nhãn: nút ở cạnh dưới thanh, nhãn hiện lần lượt, vạch nổi bật trượt; nhớ theo máy + tài khoản");
  {
    const ctx = await ctxFor(S, { width: 1280, height: 800 });
    await noFonts(ctx as never);
    let p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "load", timeout: 150000 });
    const wrap = p.locator("#kin-rail");
    await wrap.waitFor({ timeout: 90000 });
    await sleep(600);
    const geo = () => p.evaluate(() => {
      const w = document.querySelector("#kin-rail")!.getBoundingClientRect().width;
      const act = document.querySelector<HTMLElement>('#kin-rail [aria-current="page"]')!;
      const hl = document.querySelector<HTMLElement>(".kin-rail-hl")!;
      const ab = act.getBoundingClientRect(), hb = hl.getBoundingClientRect();
      const icon = act.querySelector("svg")!.getBoundingClientRect(), lab = act.querySelector(".kin-rail-lab")!.getBoundingClientRect();
      return { w: Math.round(w), attr: document.documentElement.getAttribute("data-kin-rail"), hlOn: hl.dataset.on, hlAnim: hl.dataset.anim, dy: Math.abs(hb.top - ab.top), dh: Math.abs(hb.height - ab.height), dx: Math.abs(hb.left - ab.left), dw: Math.abs(hb.width - ab.width), labelBelow: lab.top > icon.bottom - 2, labelBeside: lab.left >= icon.right - 1 && Math.abs((lab.top + lab.height / 2) - (icon.top + icon.height / 2)) < 8, itemW: Math.round(ab.width) };
    });
    const g0 = await geo();
    check("79px như Figma: nhãn nằm DƯỚI biểu tượng; vạch nổi bật trùng đúng mục đang chọn", g0.w === 79 && g0.attr === null && g0.labelBelow && g0.hlOn === "1" && g0.dy < 1.5 && g0.dh < 1.5 && g0.dx < 1.5 && g0.dw < 1.5, g0);
    check("mục đang chọn không tự mang nền riêng nữa (vạch chung thay)", await p.locator('#kin-rail [aria-current="page"]').evaluate(el => getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)"));
    const widen = p.locator("[data-rail-widen]");
    check("nút mở rộng có đủ nhãn + trạng thái cho trình đọc màn hình (aria-pressed=false)", (await widen.getAttribute("aria-label")) === "Mở rộng thanh bên có nhãn chữ" && (await widen.getAttribute("aria-pressed")) === "false");
    check("lúc chưa rê chuột vào thanh: nút ẩn (opacity 0)", (await widen.evaluate(el => getComputedStyle(el).opacity)) === "0");
    await wrap.hover({ position: { x: 30, y: 300 } });
    await sleep(350);
    check("rê chuột vào thanh: nút hiện (opacity 1)", (await widen.evaluate(el => getComputedStyle(el).opacity)) === "1");
    await widen.click();
    await sleep(120);
    const lab = await p.evaluate(() => getComputedStyle(document.querySelector('#kin-rail .kin-rail-it .kin-rail-lab')!).animationName);
    await sleep(900);
    const g1 = await geo();
    check("bấm: thanh nở ra 220px (đã nhớ trên <html> data-kin-rail=rong), nhãn chuyển sang NẰM CẠNH biểu tượng", g1.w === 220 && g1.attr === "rong" && g1.labelBeside && !g1.labelBelow, g1);
    check("nhãn hiện lần lượt bằng hoạt hình kin-rail-lab-in", lab === "kin-rail-lab-in", lab);
    check("vạch nổi bật dãn theo bề rộng mới, vẫn trùng mục đang chọn", g1.hlOn === "1" && g1.dw < 2 && g1.dy < 1.5 && g1.itemW > 190, g1);
    check("nút giờ ghi 'Thu hẹp thanh bên', aria-pressed=true, luôn hiện", (await widen.getAttribute("aria-label")) === "Thu hẹp thanh bên" && (await widen.getAttribute("aria-pressed")) === "true" && (await widen.evaluate(el => getComputedStyle(el).opacity)) === "1");
    check("đã nhớ theo máy (localStorage) và theo TÀI KHOẢN (cơ sở dữ liệu)", await (async () => {
      const local = await p.evaluate(() => localStorage.getItem("kin.thanh-ben") + "|" + localStorage.getItem("kin.thanh-ben-truoc"));
      await sleep(500);
      const u = await prisma.user.findUnique({ where: { id: S.id }, select: { preferences: true } });
      return local === "rong|rong" && (u?.preferences as { rail?: string } | null)?.rail === "rong";
    })());
    // vạch trượt khi đổi mục
    const lich = p.locator('#kin-rail a', { hasText: "Lịch" });
    const before = await p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".kin-rail-hl")!).transform).m42);
    await lich.click();
    await sleep(110);
    const mid = await p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".kin-rail-hl")!).transform).m42);
    await p.waitForURL(u => u.pathname === "/student/lich-hoc", { timeout: 90000 });
    await sleep(900);
    const g2 = await geo();
    const after = await p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".kin-rail-hl")!).transform).m42);
    check("sang mục 'Lịch': vạch nổi bật TRƯỢT xuống (giữa chừng chưa tới nơi) rồi dừng đúng mục mới", after > before + 20 && mid < after - 1 && g2.dy < 1.5, { before, mid, after, dy: g2.dy });
    // "Khác" neo theo bề rộng
    await p.locator('#kin-rail [data-khac-nut]').click();
    const kl = await p.evaluate(() => Math.round(document.querySelector("#khac-bang")!.getBoundingClientRect().left));
    check("bảng 'Khác' nổi cạnh thanh RỘNG (không đè lên thanh): mép trái ≥ 220", kl >= 220 && kl <= 236, kl);
    await p.keyboard.press("Escape");
    // tải lại: vẫn rộng, KHÔNG nháy (cùng cách quan sát với ui-sidebar: lấy mẫu bề rộng mỗi lần DOM đổi trong lúc dựng trang)
    await p.close();
    const p2 = await ctx.newPage(); watch(p2);
    await p2.addInitScript(`window.__rw = []; new MutationObserver(() => { const w = document.querySelector("#kin-rail"); if (w) window.__rw.push(Math.round(w.getBoundingClientRect().width)); }).observe(document, { childList: true, subtree: true });`);
    await p2.goto(`${BASE}/student/lich-hoc`, { waitUntil: "networkidle", timeout: 150000 });
    await p2.locator("#kin-rail").waitFor({ timeout: 90000 });
    const seen = await p2.evaluate(`window.__rw`) as number[];
    check(`tải lại cứng: <html> data-kin-rail=rong và thanh đứng 220px`, (await p2.evaluate(() => document.documentElement.getAttribute("data-kin-rail"))) === "rong" && (await p2.evaluate(() => Math.round(document.querySelector("#kin-rail")!.getBoundingClientRect().width))) === 220);
    check(`không có khoảnh khắc nào thanh bên hẹp hơn 220px trong lúc dựng trang (không nháy 79px rồi nở ra); đã quan sát ${seen.length} lần`, seen.length > 0 && Math.min(...seen) === 220, seen);
    p = p2;
    // thu → phím [ mở lại về 220
    await p.locator("[data-rail-close]").click();
    await sleep(600);
    check("thu: thanh về 0px, <html> data-kin-rail=thu", (await p.evaluate(() => document.querySelector("#kin-rail")!.getBoundingClientRect().width)) === 0 && (await p.evaluate(() => document.documentElement.getAttribute("data-kin-rail"))) === "thu");
    await p.keyboard.press("[");
    await sleep(900);
    check("phím '[' mở lại về ĐÚNG bề rộng đã dùng (220px), không về 79px", (await geo()).w === 220);
    await p.locator("[data-rail-close]").click();
    await sleep(500);
    await p.locator("[data-rail-open]").click();
    await sleep(900);
    check("nút 'Mở thanh bên' ở dải trên cũng mở lại về 220px", (await geo()).w === 220);
    // thu hẹp bằng bàn phím
    await p.locator("[data-rail-widen]").focus();
    check("nút mở rộng nhận tiêu điểm bàn phím và hiện ra khi có tiêu điểm", (await p.locator("[data-rail-widen]").evaluate(el => getComputedStyle(el).opacity)) === "1");
    await p.keyboard.press("Enter");
    await sleep(900);
    const g3 = await geo();
    check("Enter: thu hẹp về 79px, nhãn lại nằm dưới biểu tượng, vạch trùng mục; <html> bỏ data-kin-rail", g3.w === 79 && g3.attr === null && g3.labelBelow && g3.dy < 1.5, g3);
    await ctx.close();
  }

  section("#040 Vỏ gia sư dùng chung thanh này: cũng mở rộng được, nhãn + huy hiệu không đè nhau");
  {
    const ctx = await ctxFor(T, { width: 1280, height: 800 });
    await noFonts(ctx as never);
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/lop-cua-toi`, { waitUntil: "load", timeout: 150000 });
    await p.locator("#kin-rail").waitFor({ timeout: 90000 });
    await sleep(500);
    await p.locator("#kin-rail").hover({ position: { x: 30, y: 300 } });
    await sleep(300);
    await p.locator("[data-rail-widen]").click();
    await sleep(900);
    const r = await p.evaluate(() => {
      const items = Array.from(document.querySelectorAll<HTMLElement>("#kin-rail .kin-rail-it"));
      const rows = items.map(a => { const b = a.getBoundingClientRect(), l = a.querySelector(".kin-rail-lab")!.getBoundingClientRect(), bd = a.querySelector<HTMLElement>(".kin-badge-dem")?.getBoundingClientRect(); return { w: Math.round(b.width), overlap: bd ? !(bd.left >= l.right - 1 || bd.right <= l.left + 1) : false, h: Math.round(b.height) }; });
      return { n: items.length, w: Math.round(document.querySelector("#kin-rail")!.getBoundingClientRect().width), rows };
    });
    check("gia sư: thanh 220px, mọi mục đầy bề rộng và cao ≥ 44px, không huy hiệu nào đè lên nhãn", r.w === 220 && r.n >= 3 && r.rows.every(x => x.w > 190 && x.h >= 44 && !x.overlap), r);
    await ctx.close();
  }

  section("#040 Điện thoại: thanh dưới không đổi, không có nút mở rộng");
  {
    const ctx = await ctxFor(S, { width: 390, height: 800 });
    await noFonts(ctx as never);
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "load", timeout: 150000 });
    await p.locator('nav[aria-label="Module của học sinh"]').last().waitFor({ timeout: 90000 });
    await sleep(500);
    check("nút mở rộng không hiện ở điện thoại; thanh dưới vẫn cao 60px và đủ nhãn", !(await p.locator("[data-rail-widen]").isVisible()) && await p.evaluate(() => { const n = Array.from(document.querySelectorAll("nav")).find(e => getComputedStyle(e).position === "fixed")!; return Math.round(n.getBoundingClientRect().height) === 60 && n.querySelectorAll("a, button").length >= 4; }));
    await ctx.close();
  }

  check("không có lỗi JavaScript trên trang nào", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
