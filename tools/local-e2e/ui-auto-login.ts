// Tự động đăng nhập bằng thông tin trình duyệt đã lưu (src/lib/savedLogin.ts) — màn hình thật + API thật + trình duyệt GIẢ cho phần Credential Management:
// Chromium headless không có kho mật khẩu, nên mỗi kịch bản cài (addInitScript) một PasswordCredential + navigator.credentials giả, giữ cờ "đã đăng xuất" trong localStorage
// như Chrome thật (preventSilentAccess đặt cờ → get trả null; store xoá cờ = đăng nhập thủ công bật lại tự đăng nhập).
// Phủ: học sinh / gia sư tự vào; quản trị KHÔNG tự vào (form điền sẵn, chưa có phiên); mật khẩu lưu đã sai → một lần thử duy nhất rồi dừng; không có gì lưu → không gọi API;
// đăng nhập thủ công → nhờ trình duyệt lưu; đăng xuất → ngừng tự đăng nhập; ?cach=ma và lỗi Google/Facebook → không tự thử; trình duyệt không hỗ trợ → mọi thứ như cũ.
import { BASE, mkTutor, mkUser, mkSuper, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";

const PW = "Passw0rd!";
let ipSeq = Math.floor(Math.random() * 40) * 250 + 30_000;
const nextIp = () => `10.97.${Math.floor(++ipSeq / 250) % 250}.${ipSeq % 250}`;

type Saved = { id: string; password: string } | null;
// Trình duyệt giả cài bằng CHUỖI JS thuần (không phải hàm TS): tsx chèn `__name` vào hàm/lớp có tên, không chạy được trong trang.
const mockBrowser = (cfg: { saved: Saved; unsupported?: boolean }) => `(() => {
  const cfg = ${JSON.stringify(cfg)};
  const read = () => { try { return localStorage.getItem("__prevented") === "1"; } catch (e) { return false; } };
  const write = (v) => { try { if (v) localStorage.setItem("__prevented", "1"); else localStorage.removeItem("__prevented"); } catch (e) {} };
  const push = (key, v) => { try { const cur = JSON.parse(sessionStorage.getItem(key) || "[]"); cur.push(v); sessionStorage.setItem(key, JSON.stringify(cur)); } catch (e) {} };
  window.__cred = { get: [], store: [], prevent: 0 };
  if (cfg.unsupported) {
    delete window.PasswordCredential;
    Object.defineProperty(navigator, "credentials", { value: undefined, configurable: true });
    return;
  }
  function PC(d) { this.type = "password"; this.id = d.id; this.password = d.password; this.name = d.name; }
  window.PasswordCredential = PC;
  Object.defineProperty(navigator, "credentials", { configurable: true, value: {
    get: async (o) => { window.__cred.get.push(o); push("__getLog", o); return cfg.saved && !read() ? new PC(cfg.saved) : null; },
    store: async (c) => { window.__cred.store.push({ id: c.id, password: c.password }); push("__storeLog", { id: c.id, password: c.password }); write(false); },
    preventSilentAccess: async () => { window.__cred.prevent++; write(true); },
  } });
})();`;

(async () => {
  await wipe();
  await launch();
  const errors: string[] = [];
  const S = await mkUser({ name: "Nguyễn Minh Anh" });
  const T = await mkTutor("Cô Lan");
  const A = await mkSuper("Quản trị cấp 1");

  async function open(path: string, cfg: { saved: Saved; unsupported?: boolean }) {
    const ctx = await ctxFor(null, { width: 1280, height: 900 });
    await ctx.setExtraHTTPHeaders({ "x-forwarded-for": nextIp() });
    await ctx.addInitScript({ content: mockBrowser(cfg) });
    const p = await ctx.newPage();
    const posts: Array<Record<string, unknown>> = [];
    p.on("request", r => { if (r.method() === "POST" && r.url().endsWith("/api/auth/login")) posts.push(r.postDataJSON()); });
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|Hydration|401|403|429|Access to fetch at 'http:\/\/admin\./i.test(m.text())) errors.push(m.text()); });
    // networkidle: chờ React gắn xong xử lý biểu mẫu (bấm sớm hơn thì trình duyệt gửi biểu mẫu kiểu mặc định, không có lần gọi API nào).
    await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 240000 });
    return { ctx, p, posts };
  }
  const cred = (p: any) => p.evaluate(() => (window as any).__cred);
  const hasCookie = async (ctx: any) => (await ctx.cookies()).some((c: any) => c.name === "midnight_session");
  const acct = (p: any) => p.getByLabel(/Số điện thoại hoặc email|^Email$/);
  const pass = (p: any) => p.locator("#dn-pass");
  // Sau đăng xuất trang "/" có thể điều hướng hai lần liên tiếp tới cùng địa chỉ: đọc trạng thái trang phải chờ tải xong và thử lại nếu ngữ cảnh bị huỷ giữa chừng.
  const safeEval = async (p: any, fn: () => unknown) => {
    for (let i = 0; i < 6; i++) {
      try { await p.waitForLoadState("load"); return await p.evaluate(fn); }
      catch (e) { if (!/Execution context was destroyed|navigation/i.test(String(e))) throw e; await p.waitForTimeout(600); }
    }
    return p.evaluate(fn);
  };
  const left = (p: any) => p.waitForURL((u: URL) => !u.pathname.startsWith("/dang-nhap"), { timeout: 120000 }).then(() => true, () => false);

  section("Học sinh có mật khẩu đã lưu → tự vào, không cần bấm");
  { const { ctx, p, posts } = await open("/dang-nhap", { saved: { id: S.email, password: PW } });
    check("rời khỏi /dang-nhap (tự đăng nhập xong)", await left(p), p.url());
    check("đã có cookie phiên", await hasCookie(ctx));
    check("đúng MỘT lần gọi /api/auth/login, mang cờ auto:true", posts.length === 1 && posts[0].auto === true && posts[0].identifier === S.email, posts);
    check("vào khu học sinh, không dừng ở trang đăng nhập", /\/student|\/lop-cua-toi|^\/$/.test(new URL(p.url()).pathname), p.url());
    await ctx.close(); }
  { const { ctx, p } = await open("/dang-nhap", { saved: { id: S.email, password: PW } });
    await left(p);
    const logged = await p.evaluate(() => JSON.parse(sessionStorage.getItem("__getLog") ?? "[]")).catch(() => []);
    check("get được gọi đúng một lần với password:true và mediation 'silent' (không hộp chọn tài khoản)", logged.length === 1 && logged[0].password === true && logged[0].mediation === "silent", logged);
    await ctx.close(); }

  section("Gia sư có mật khẩu đã lưu → tự vào");
  { const { ctx, p, posts } = await open("/dang-nhap", { saved: { id: T.email, password: PW } });
    check("rời khỏi /dang-nhap", await left(p), p.url());
    check("có cookie phiên + một lần gọi auto:true", await hasCookie(ctx) && posts.length === 1 && posts[0].auto === true, posts);
    await ctx.close(); }

  section("Quản trị: KHÔNG tự vào (mốc 12 giờ có chủ ý) — form điền sẵn, tự bấm");
  { const { ctx, p, posts } = await open("/dang-nhap", { saved: { id: A.email, password: PW } });
    await p.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasText: "không tự đăng nhập" }).first().waitFor({ timeout: 120000 });
    check("vẫn ở /dang-nhap, hiện thông báo 'Tài khoản quản trị không tự đăng nhập'", new URL(p.url()).pathname.startsWith("/dang-nhap"), p.url());
    check("KHÔNG có cookie phiên", !(await hasCookie(ctx)));
    check("một lần gọi duy nhất, mang auto:true (máy chủ từ chối 403)", posts.length === 1 && posts[0].auto === true, posts);
    check("ô tài khoản và ô mật khẩu đã điền sẵn từ thông tin đã lưu", (await acct(p).inputValue()) === A.email && (await pass(p).inputValue()) === PW);
    check("nút 'Đăng nhập' bấm lại được (không kẹt ở trạng thái đang gửi)", await p.getByRole("button", { name: "Đăng nhập", exact: true }).isEnabled());
    await p.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await eventually("bấm tay → có lần gọi thứ hai tới /api/auth/login", () => posts.length >= 2, 60000);
    check("lần gọi do người dùng bấm KHÔNG mang cờ auto (cùng tài khoản + mật khẩu điền sẵn)", posts[1]?.auto === undefined && posts[1]?.identifier === A.email && posts[1]?.password === PW, posts);
    // Quản trị đăng nhập tay thành công bị đưa sang cửa quản trị (tên miền khác, chưa có phiên ở đó): trang đăng nhập bên đó tự thử lại, máy chủ lại từ chối — đúng chủ ý.
    await eventually("cookie phiên có SAU lần bấm tay (lần tự thử trước đó không cấp phiên)", () => hasCookie(ctx), 60000);
    await ctx.close(); }

  section("Mật khẩu đã lưu không còn đúng → thử đúng MỘT lần rồi dừng");
  { const { ctx, p, posts } = await open("/dang-nhap", { saved: { id: S.email, password: "mat-khau-cu-da-doi" } });
    await p.locator('[role="alert"]:not(#__next-route-announcer__)').first().waitFor({ timeout: 120000 });
    check("ở lại /dang-nhap, không cookie", new URL(p.url()).pathname.startsWith("/dang-nhap") && !(await hasCookie(ctx)), p.url());
    check("hiện lỗi từ máy chủ kèm lời giải thích đây là thông tin đã lưu", /không đúng/.test(await p.locator('[role="alert"]:not(#__next-route-announcer__)').first().innerText()) && /trình duyệt đã lưu/.test(await p.locator('[role="alert"]:not(#__next-route-announcer__)').first().innerText()));
    await p.waitForTimeout(2500);
    check("không có vòng lặp: vẫn đúng một lần gọi API", posts.length === 1, posts);
    const c = await cred(p);
    check("báo trình duyệt đừng tự đưa mật khẩu này nữa (preventSilentAccess 1 lần)", c.prevent === 1, c);
    check("form trống, người dùng nhập lại được", (await acct(p).inputValue()) === "" && (await pass(p).inputValue()) === "");
    await p.reload({ waitUntil: "domcontentloaded" }); await p.waitForTimeout(2500);
    check("mở lại trang: cờ giữ nguyên nên KHÔNG thử lại (tổng vẫn 1 lần gọi API, vẫn ở trang đăng nhập)", posts.length === 1 && new URL(p.url()).pathname.startsWith("/dang-nhap"), posts);
    await ctx.close(); }

  section("Không có gì được lưu → không gọi API");
  { const { ctx, p, posts } = await open("/dang-nhap", { saved: null });
    await p.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor({ timeout: 90000 });
    await p.waitForTimeout(2500);
    check("không gọi /api/auth/login, không đổi trang", posts.length === 0 && new URL(p.url()).pathname.startsWith("/dang-nhap"), posts);
    check("đã hỏi trình duyệt đúng một lần", (await cred(p)).get.length === 1, await cred(p));
    check("không có thông báo lỗi nào", (await p.locator('[role="alert"]:not(#__next-route-announcer__)').count()) === 0);
    await ctx.close(); }

  section("Đăng nhập thủ công → nhờ trình duyệt lưu; đăng xuất → ngừng tự đăng nhập");
  { const { ctx, p, posts } = await open("/dang-nhap", { saved: null });
    await acct(p).fill(S.email); await pass(p).fill(PW);
    await p.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    check("vào được", await left(p), p.url());
    check("lần gọi thủ công KHÔNG mang cờ auto", posts.length === 1 && posts[0].auto === undefined, posts);
    const stored = await p.evaluate(() => JSON.parse(sessionStorage.getItem("__storeLog") ?? "[]"));
    check("store() được gọi đúng một lần với tài khoản + mật khẩu vừa nhập", stored.length === 1 && stored[0].id === S.email && stored[0].password === PW, stored);

    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 240000 });
    await p.getByRole("button", { name: /^Tài khoản của/ }).first().click();
    await p.getByRole("menuitem", { name: "Đăng xuất" }).click();
    await p.waitForURL(u => u.pathname === "/" || u.pathname.startsWith("/dang-nhap"), { timeout: 120000 });
    check("đăng xuất xong: đã báo trình duyệt đừng tự đăng nhập (cờ 'đã đăng xuất' được đặt)", await safeEval(p, () => localStorage.getItem("__prevented") === "1"));
    check("đăng xuất xong: cookie phiên đã mất", !(await hasCookie(ctx)));
    const before = posts.length;
    await p.goto(`${BASE}/dang-nhap`, { waitUntil: "networkidle", timeout: 240000 });
    await p.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor({ timeout: 90000 });
    await p.waitForTimeout(2500);
    check("mở lại /dang-nhap sau khi đăng xuất: KHÔNG tự vào lại (ở lại trang, không gọi API, không cookie)", new URL(p.url()).pathname.startsWith("/dang-nhap") && posts.length === before && !(await hasCookie(ctx)), [p.url(), posts.length, before]);
    await acct(p).fill(S.email); await pass(p).fill(PW);
    await p.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    check("đăng nhập thủ công lại thì vào được, và cờ 'đã đăng xuất' được xoá (store bật lại tự đăng nhập)", (await left(p)) && (await safeEval(p, () => localStorage.getItem("__prevented"))) === null, p.url());
    await ctx.close(); }

  section("Các lối không tự thử");
  { const { ctx, p, posts } = await open("/dang-nhap?cach=ma", { saved: { id: S.email, password: PW } });
    await p.waitForTimeout(3000);
    check("/dang-nhap?cach=ma: không hỏi trình duyệt, không gọi login", posts.length === 0 && (await cred(p)).get.length === 0, [posts, await cred(p)]);
    await ctx.close(); }
  { const { ctx, p, posts } = await open("/dang-nhap?google=khong_ro", { saved: { id: S.email, password: PW } });
    await p.waitForTimeout(3000);
    check("vừa bị đưa về từ lỗi Google: không tự thử đăng nhập", posts.length === 0 && !(await hasCookie(ctx)) && (await cred(p)).get.length === 0, [posts, await cred(p)]);
    await ctx.close(); }
  { const { ctx, p, posts } = await open("/dang-nhap?facebook=khong_ro", { saved: { id: S.email, password: PW } });
    await p.waitForTimeout(3000);
    check("vừa bị đưa về từ lỗi Facebook: không tự thử đăng nhập", posts.length === 0 && !(await hasCookie(ctx)), posts);
    await ctx.close(); }

  section("Trình duyệt không hỗ trợ Credential Management (Firefox, Safari)");
  { const { ctx, p, posts } = await open("/dang-nhap", { saved: null, unsupported: true });
    await p.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor({ timeout: 90000 });
    await p.waitForTimeout(2000);
    check("không gọi API, không lỗi, form dùng bình thường", posts.length === 0 && (await acct(p).isVisible()) && (await pass(p).isVisible()));
    await acct(p).fill(S.email); await pass(p).fill(PW);
    await p.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    check("đăng nhập thủ công vẫn vào được", await left(p), p.url());
    await ctx.close(); }

  check("không lỗi script / console.error của ứng dụng", errors.length === 0, errors);
  await closeAll();
  await done();
})();
