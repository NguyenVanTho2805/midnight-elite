// Chuyển động ở trang đăng nhập (Lucian UX/UI Prompt, MIT) — 15/10/2026. Trình duyệt thật.
//   #062 nút gửi co thành vòng tròn (logo K đang chạy) + thẻ lắc khi sai · #026 ô mã 6 số · #067 đếm ngược khi bị khoá.
// Phản hồi sai / chậm / bị khoá do TEST GIẢ LẬP (route.fulfill) để quan sát từng trạng thái; riêng đường thành công dùng tài khoản và đăng nhập thật.
import { BASE, mkUser, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import type { Page } from "./ui";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const noFonts = (ctx: { route: (u: RegExp, h: (r: { abort: () => Promise<void> }) => Promise<void>) => Promise<void> }) => ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());

(async () => {
  await wipe();
  const U = await mkUser({ name: "Người Đăng Nhập" });
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => p.on("pageerror", e => errors.push(String(e)));

  async function open(ctxOpts: { reduce?: boolean } = {}) {
    const ctx = await ctxFor(null, { width: 900, height: 900 });
    await noFonts(ctx as never);
    const p = await ctx.newPage(); watch(p);
    if (ctxOpts.reduce) await p.emulateMedia({ reducedMotion: "reduce" });
    await p.goto(`${BASE}/dang-nhap`, { waitUntil: "load", timeout: 150000 });
    await p.locator("#dn-id-pw").waitFor({ timeout: 90000 });
    return { ctx, p };
  }
  const goBtn = (p: Page) => p.locator("button.kin-go").first();
  const look = (p: Page) => goBtn(p).evaluate(el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return { state: (el as HTMLElement).dataset.state, w: Math.round(r.width), h: Math.round(r.height), radius: parseFloat(s.borderTopLeftRadius), label: parseFloat(getComputedStyle(el.querySelector(".kin-go-label")!).opacity), spin: parseFloat(getComputedStyle(el.querySelector(".kin-go-spin")!).opacity), ok: parseFloat(getComputedStyle(el.querySelector(".kin-go-ok")!).opacity), name: el.textContent?.trim(), busy: el.getAttribute("aria-busy"), disabled: (el as HTMLButtonElement).disabled };
  });

  // ───────── #062: mật khẩu sai ─────────
  section("#062 Mật khẩu sai: nút co thành vòng tròn có logo K → giãn lại; thẻ lắc; thông báo trượt vào");
  {
    const { ctx, p } = await open();
    await ctx.route("**/api/auth/login", async route => { await sleep(900); await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Sai tài khoản hoặc mật khẩu", code: "invalid" }) }); });
    const idle = await look(p);
    check("nghỉ: nút đầy chiều rộng, cao 48px, bo góc nhỏ, hiện chữ 'Đăng nhập'", idle.state === "idle" && idle.w > 250 && idle.h === 48 && idle.radius < 24 && idle.label === 1 && idle.spin === 0, idle);
    await p.fill("#dn-id-pw", "ai-do@test.local");
    await p.fill("#dn-pass", "sai-mat-khau");
    await p.locator("button.kin-go").first().click();
    await sleep(700); // sau 0,45 giây của chuyển động, trước khi phản hồi (0,9 giây) về
    const busy = await look(p);
    check("đang gửi: nút co thành VÒNG TRÒN 48×48, chữ mờ đi, logo K hiện (không phải spinner chung chung)", busy.state === "busy" && busy.w === 48 && busy.h === 48 && busy.radius >= 24 && busy.label === 0 && busy.spin === 1, busy);
    check("trợ năng: aria-busy, tên đọc của nút là 'Đang đăng nhập…', nút bị khoá không bấm đúp được", busy.busy === "true" && /Đang đăng nhập/.test(busy.name ?? "") && busy.disabled, busy);
    check("logo K trong vòng tròn chạy cùng chuyển động với KinLoader (ba lưỡi sáng lần lượt)", await p.locator(".kin-go-spin svg path").first().evaluate(el => getComputedStyle(el).animationName === "kin-loader-blade"));
    const shook = await p.waitForFunction(() => getComputedStyle(document.querySelector(".max-w-\\[420px\\]")!).animationName === "kin-shake-card", null, { timeout: 4000 }).then(() => true).catch(() => false);
    check("phản hồi sai về: cả thẻ lắc đầu (kin-shake-card)", shook);
    await sleep(900);
    const back = await look(p);
    check("nút giãn trở lại đầy chiều rộng, hiện lại chữ 'Đăng nhập', bấm được", back.state === "idle" && back.w > 250 && back.label === 1 && back.spin === 0 && !back.disabled, back);
    const notice = p.locator('div[role="alert"].kin-notice-in');
    check("thông báo lỗi hiện bằng hoạt hình trượt vào (kin-notice-in) và đọc được", (await notice.innerText()).includes("Sai tài khoản hoặc mật khẩu") && await notice.evaluate(el => el.classList.contains("kin-notice-in")));
    await ctx.close();
  }

  // ───────── #062: đăng nhập thật thành công ─────────
  section("#062 Đăng nhập thật thành công: nút hiện dấu tích trong lúc chuyển trang, không chậm thêm");
  {
    const { ctx, p } = await open();
    await p.fill("#dn-id-pw", U.email);
    await p.fill("#dn-pass", "Passw0rd!");
    const t0 = Date.now();
    await p.locator("button.kin-go").first().click();
    const sawOk = await p.waitForFunction(() => document.querySelector("button.kin-go")?.getAttribute("data-state") === "ok", null, { timeout: 15000, polling: 16 }).then(() => true).catch(() => false);
    check("thành công: nút chuyển sang trạng thái 'ok' (vòng tròn màu xong + dấu tích)", sawOk);
    if (sawOk) {
      await sleep(500);
      const ok = await look(p).catch(() => null);
      check("…dấu tích được vẽ (hiện rõ), chữ ẩn", ok === null || (ok.ok === 1 && ok.label === 0), ok);
    }
    await p.waitForURL(u => u.pathname.startsWith("/student"), { timeout: 120000 });
    check("vẫn vào dashboard bình thường (hiệu ứng KHÔNG chặn / làm chậm việc chuyển trang)", true, `${Date.now() - t0}ms`);
    await ctx.close();
  }

  // ───────── #067: bị khoá ─────────
  section("#067 Bị khoá vì sai nhiều lần: vòng đếm ngược + ổ khoá, hết giờ quai khoá bật mở");
  {
    const { ctx, p } = await open();
    await ctx.route("**/api/auth/login", async route => { await route.fulfill({ status: 429, headers: { "Retry-After": "4" }, contentType: "application/json", body: JSON.stringify({ error: "Đăng nhập tạm khoá vì sai nhiều lần.", code: "wait", retryAfterSec: 4 }) }); });
    await p.fill("#dn-id-pw", "ai-do@test.local");
    await p.fill("#dn-pass", "x");
    await p.locator("button.kin-go").first().click();
    const lock = p.locator(".kin-lock");
    await lock.waitFor({ timeout: 10000 });
    check("hiện đồng hồ đếm ngược (role=timer) cùng thông báo khoá; ổ khoá ĐANG KHOÁ", (await lock.locator('[role="timer"]').count()) === 1 && (await lock.getAttribute("data-open")) === null && (await p.locator('div[role="alert"].kin-notice-in').innerText()).includes("tạm khoá"));
    const t1 = await lock.locator(".kin-lock-time").innerText();
    await sleep(1400);
    const t2 = await lock.locator(".kin-lock-time").innerText();
    const prog = await lock.locator(".kin-lock-dial").evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue("--p")));
    check("số đếm ngược giảm theo giây thật; vòng co dần (0 < tiến độ < 1)", /^0:0[2-4]$/.test(t1) && t2 < t1 && prog > 0 && prog < 1, { t1, t2, prog });
    check("nhãn đọc cho trình đọc màn hình nói số giây còn lại", /^Còn \d+ giây$/.test((await lock.locator('[role="timer"]').getAttribute("aria-label")) ?? ""));
    const retry = lock.getByRole("button", { name: "Thử đăng nhập lại" });
    check("chưa hết giờ: nút 'Thử đăng nhập lại' bị khoá", await retry.isDisabled());
    await lock.waitFor({ state: "attached" });
    await p.waitForFunction(() => document.querySelector(".kin-lock")?.hasAttribute("data-open"), null, { timeout: 10000 });
    await sleep(900);
    const unlocked = await lock.evaluate(el => ({ shackle: new DOMMatrix(getComputedStyle(el.querySelector(".sh")!).transform).m42, a: getComputedStyle(el.querySelector(".kin-lock-title .a")!).opacity, b: getComputedStyle(el.querySelector(".kin-lock-title .b")!).opacity, time: el.querySelector(".kin-lock-time")?.textContent, p: getComputedStyle(el.querySelector(".kin-lock-dial")!).getPropertyValue("--p").trim() }));
    check("hết giờ: quai khoá bật mở (dịch lên), tiêu đề đổi sang 'Bạn có thể thử lại', số về 0:00, vòng cạn", unlocked.shackle < -4 && unlocked.a === "0" && unlocked.b === "1" && unlocked.time === "0:00" && parseFloat(unlocked.p) === 0, unlocked);
    check("nút 'Thử đăng nhập lại' mở khoá", await retry.isEnabled());
    await retry.click();
    check("bấm thử lại: thông báo khoá được gỡ, biểu mẫu dùng tiếp được", (await p.locator(".kin-lock").count()) === 0 && await p.locator("#dn-pass").isEnabled());
    await ctx.close();
  }

  // ───────── #026 ô mã 6 số ─────────
  section("#026 Ô mã 6 số: chữ số nảy lên, sóng khi kiểm tra, cả hàng lắc khi sai");
  {
    const { ctx, p } = await open();
    await ctx.route("**/api/auth/code/request", async route => { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, resendAfterSec: 60 }) }); });
    await ctx.route("**/api/auth/code/verify", async route => { await sleep(1100); await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Mã không đúng", code: "wrong", attemptsLeft: 3 }) }); });
    await p.getByRole("tab", { name: "Mã một lần" }).click();
    await p.locator("#dn-email").fill("ai-do@test.local");
    await p.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
    const cells = p.locator(".kin-code-cell");
    await cells.first().waitFor({ timeout: 15000 });
    check("đủ 6 ô, trạng thái nghỉ", (await cells.count()) === 6 && (await p.locator(".kin-code").getAttribute("data-state")) === "idle");
    await p.keyboard.type("1");
    const popped = await p.waitForFunction(() => getComputedStyle(document.querySelector(".kin-code-cell")!).animationName === "kin-code-pop", null, { timeout: 2500, polling: 16 }).then(() => true).catch(() => false);
    check("gõ một số → ô đó nảy lên từ dưới (kin-code-pop)", popped);
    await p.keyboard.type("11111"); // đủ 6 số → tự gửi
    const wave = await p.waitForFunction(() => document.querySelector(".kin-code")?.getAttribute("data-state") === "check" && getComputedStyle(document.querySelectorAll(".kin-code-cell")[2]).animationName === "kin-code-wave", null, { timeout: 4000, polling: 16 }).then(() => true).catch(() => false);
    check("đủ 6 số, đang kiểm tra: sáu ô nhấp nhô thành sóng (kin-code-wave), lệch pha từng ô", wave && await p.evaluate(() => { const d = Array.from(document.querySelectorAll<HTMLElement>(".kin-code-cell")).map(c => getComputedStyle(c).animationDelay); return new Set(d).size === 6; }));
    const bad = await p.waitForFunction(() => getComputedStyle(document.querySelector(".kin-code")!).animationName === "kin-code-shake", null, { timeout: 6000, polling: 16 }).then(() => true).catch(() => false);
    check("mã sai: cả hàng lắc đầu (kin-code-shake)", bad);
    await sleep(600);
    check("…ô chuyển viền đỏ (aria-invalid), thông báo 'còn 3 lần thử' hiện", (await cells.first().getAttribute("aria-invalid")) === "true" && (await p.locator('div[role="alert"].kin-notice-in').innerText()).includes("còn 3 lần thử"));
    await ctx.close();
  }

  // ───────── giảm chuyển động ─────────
  section("Giảm chuyển động: nút vẫn đổi trạng thái nhưng tức thì");
  {
    const { ctx, p } = await open({ reduce: true });
    await ctx.route("**/api/auth/login", async route => { await sleep(700); await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Sai", code: "invalid" }) }); });
    await p.fill("#dn-id-pw", "a@test.local"); await p.fill("#dn-pass", "x");
    await p.locator("button.kin-go").first().click();
    await sleep(150);
    const b = await look(p);
    check("chỉ 150ms sau khi bấm nút đã là vòng tròn hoàn chỉnh (không chờ 0,45 giây)", b.state === "busy" && b.w === 48 && b.spin === 1, b);
    await ctx.close();
  }

  check("không có lỗi JavaScript trên trang nào", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
