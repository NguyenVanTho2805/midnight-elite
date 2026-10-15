// Đã vào vai trò thì MỌI chức năng mở trong khung thanh bên — 15/10/2026. Trình duyệt thật.
// Thọ (ảnh vỏ HỌC SINH, tài khoản quản trị "Admin TSIX"): "thi thử", "thư viện", "hỏi đáp cộng đồng"… lại hiện ra trang kiểu trang chủ.
// Nguyên nhân: quản trị xem thử khu học sinh (AuthGuard cho vào /student/*) nhưng các trang khách (/thi-thu, /thu-vien, /cong-dong…) không cho quản trị vỏ nào.
// Kiểm 4 loại tài khoản × mọi lối vào ở "Khác" + thanh module, rồi kiểm "gợi ý vỏ" (không nháy khung khách khi tải cứng).
import { BASE, mkUser, mkTutor, mkSuper, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import type { Page } from "./ui";

// Tất cả lối vào học viên thấy ở "Khác" + "Thư viện" trên thanh module (StudentShell). Mỗi mục: mở xong phải còn thanh bên, không có chân trang / thanh trên của khách.
const PATHS = ["/student/thi-thu", "/student/hoi-dap", "/student/cong-dong", "/student/bang-xep-hang", "/student/tin-tuc", "/thu-vien", "/khoa-hoc", "/khoa-hoc-da-luu", "/giang-vien", "/diem-chuan", "/cai-dat/chu-de"];

async function guestChromeLeft(p: Page) {
  return p.evaluate(() => ({
    // Nhận diện đúng chân trang / thanh trên CỦA KHÁCH (trang Thư viện công khai có thẻ <footer> riêng trong nội dung — không tính).
    footer: !!document.querySelector('footer nav[aria-label="Vai trò"]') || !!document.querySelector('nav[aria-label="Điều hướng chính"]'),
    guest: document.querySelectorAll("[data-guest-chrome]").length,
    rail: !!document.querySelector("#kin-rail"),
  }));
}

(async () => {
  await wipe();
  const S = await mkUser({ name: "Học Sinh" });
  const A = await mkSuper("Admin TSIX");
  const C = await mkUser({ name: "Quản Trị Nội Dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); };

  section("Mở từng chức năng bằng địa chỉ (tải cứng) — thanh bên phải còn, khung khách phải biến mất");
  for (const [label, u] of [["học viên", S], ["quản trị cấp 1 (Admin TSIX)", A], ["quản trị nội dung", C], ["gia sư", T]] as const) {
    const ctx = await ctxFor(u, { width: 1280, height: 800 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); // sandbox không ra được mạng ngoài; không để chờ font
    const p = await ctx.newPage(); watch(p);
    const bad: string[] = [];
    for (const path of PATHS) {
      await p.goto(BASE + path, { waitUntil: "load", timeout: 150000 });
      await p.locator("#kin-rail").waitFor({ state: "attached", timeout: 90000 }).catch(() => {});
      await p.waitForTimeout(600); // để lệnh chuyển hướng phía máy chủ (/student/thi-thu → /thi-thu) xong hẳn
      const r = await guestChromeLeft(p);
      if (!r.rail || r.footer || r.guest > 0) bad.push(`${path} → ${new URL(p.url()).pathname} ${JSON.stringify(r)}`);
    }
    check(`${label}: cả ${PATHS.length} chức năng mở trong khung có thanh bên, không có chân trang / thanh trên của khách`, bad.length === 0, bad);
    await ctx.close();
  }

  section("Đúng thao tác của Thọ: quản trị đứng ở 'Lớp', mở 'Khác' → bấm từng mục; rồi bấm 'Thư viện' trên thanh");
  {
    const ctx = await ctxFor(A, { width: 1280, height: 800 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/student/hoc-tap`, { waitUntil: "load", timeout: 150000 });
    await p.locator("#kin-rail").waitFor({ timeout: 90000 });
    const labels = ["Thi thử", "Bảng xếp hạng", "Hỏi đáp", "Cộng đồng", "Khoá học đang mở", "Lớp đang theo dõi", "Gia sư", "Tin tức", "Tra cứu điểm chuẩn", "Chủ đề màu"];
    const lost: string[] = [];
    const seen: string[] = [];
    for (const label of labels) {
      await p.locator("[data-khac-nut]:visible").click();
      const item = p.getByRole("dialog", { name: "Các mục khác" }).getByRole("link", { name: label, exact: false }).first();
      if (!(await item.count())) { lost.push(`${label} (không có trong 'Khác')`); await p.keyboard.press("Escape"); continue; }
      seen.push(label);
      await item.click();
      await p.waitForLoadState("load");
      await p.waitForTimeout(1500);
      const r = await guestChromeLeft(p);
      if (!r.rail || r.footer || r.guest > 0) lost.push(`${label} → ${new URL(p.url()).pathname} ${JSON.stringify(r)}`);
    }
    check(`bấm ${seen.length} mục trong 'Khác' (${seen.join(", ")}): luôn còn thanh bên, không nhảy ra trang kiểu trang chủ`, lost.length === 0 && seen.length === labels.length, { lost, seen });
    await p.locator("#kin-rail").getByRole("link", { name: "Thư viện" }).click();
    await p.waitForURL(u => u.pathname === "/thu-vien", { timeout: 90000 });
    await p.waitForTimeout(1500);
    const r = await guestChromeLeft(p);
    check("bấm 'Thư viện' trên thanh module: vẫn còn thanh bên, không có chân trang của khách", r.rail && !r.footer && r.guest === 0, r);
    await ctx.close();
  }

  section("Gợi ý vỏ — tải cứng không nháy ra khung khách");
  {
    // Chặn /api/auth/me 3 giây: khoảng thời gian đó là lúc cũ thấy "trang chủ" một thoáng.
    const slowMe = (ctx: Awaited<ReturnType<typeof ctxFor>>, body?: string) => ctx.route("**/api/auth/me", async route => {
      await new Promise(r => setTimeout(r, 3000));
      if (body !== undefined) await route.fulfill({ status: 200, contentType: "application/json", body });
      else await route.continue();
    });
    const chromeDisplay = (p: Page) => p.evaluate(() => Array.from(document.querySelectorAll("[data-guest-chrome]")).map(e => getComputedStyle(e).display));

    // a) Đã nhớ 'student' → trong lúc chờ, khung khách bị ẩn (display:none), rồi vào vỏ.
    const ctxA = await ctxFor(S, { width: 1280, height: 800 });
    await ctxA.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctxA.addInitScript(() => { try { localStorage.setItem("kin.vo", "student"); } catch { /* */ } });
    await slowMe(ctxA);
    const pa = await ctxA.newPage(); watch(pa);
    await pa.goto(`${BASE}/thu-vien`, { waitUntil: "domcontentloaded", timeout: 150000 });
    await pa.locator("[data-guest-chrome]").first().waitFor({ state: "attached", timeout: 90000 });
    await pa.waitForTimeout(500);
    const during = await chromeDisplay(pa);
    check("đã nhớ 'student': trong lúc chờ trả lời, thanh trên + chân trang của khách bị ẩn (không hiện ra như trang chủ)", during.length >= 2 && during.every(d => d === "none"), during);
    check("…và <html> mang data-kin-vo=student từ trước khi vẽ", (await pa.evaluate(() => document.documentElement.getAttribute("data-kin-vo"))) === "student");
    await pa.locator("#kin-rail").waitFor({ timeout: 90000 });
    check("…rồi vào vỏ học viên có thanh bên, khung khách không còn trong trang", (await guestChromeLeft(pa)).guest === 0);
    await ctxA.close();

    // b) Khách chưa từng đăng nhập: khung khách hiện bình thường.
    const ctxB = await ctxFor(null, { width: 1280, height: 800 });
    await ctxB.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await slowMe(ctxB);
    const pb = await ctxB.newPage(); watch(pb);
    await pb.goto(`${BASE}/thu-vien`, { waitUntil: "domcontentloaded", timeout: 150000 });
    await pb.locator("[data-guest-chrome]").first().waitFor({ state: "attached", timeout: 90000 });
    await pb.waitForTimeout(500);
    const guestDisplay = await chromeDisplay(pb);
    check("khách chưa đăng nhập: thanh trên + chân trang hiện bình thường (không bị ẩn nhầm)", guestDisplay.length >= 2 && guestDisplay.every(d => d !== "none"), guestDisplay);
    check("…và <html> không có data-kin-vo", (await pb.evaluate(() => document.documentElement.getAttribute("data-kin-vo"))) === null);
    await ctxB.close();

    // c) Gợi ý CŨ (phiên đã hết hạn / đăng xuất ở máy khác): máy chủ trả "không ai" → gỡ gợi ý, khung khách hiện lại, localStorage sạch.
    const ctxC = await ctxFor(null, { width: 1280, height: 800 });
    await ctxC.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctxC.addInitScript(() => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("kin.vo", "student"); sessionStorage.setItem("seeded", "1"); } } catch { /* */ } });
    const pc = await ctxC.newPage(); watch(pc);
    await pc.goto(`${BASE}/thu-vien`, { waitUntil: "load", timeout: 150000 });
    await pc.waitForFunction(() => document.documentElement.getAttribute("data-kin-vo") === null, null, { timeout: 90000 });
    await pc.waitForTimeout(500);
    const after = await chromeDisplay(pc);
    check("gợi ý cũ nhưng không còn ai đăng nhập: gỡ data-kin-vo, thanh trên + chân trang của khách hiện lại", after.length >= 2 && after.every(d => d !== "none"), after);
    check("…và xoá gợi ý khỏi localStorage (lần tải sau không ẩn nhầm)", (await pc.evaluate(() => localStorage.getItem("kin.vo"))) === null);
    await ctxC.close();

    // d) Người đã đăng nhập, chưa có gợi ý (lần đầu trên máy): sau khi biết ai thì NHỚ — lần tải sau không nháy.
    const ctxD = await ctxFor(T, { width: 1280, height: 800 });
    await ctxD.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const pd = await ctxD.newPage(); watch(pd);
    await pd.goto(`${BASE}/thu-vien`, { waitUntil: "load", timeout: 150000 });
    await pd.locator("#kin-rail").waitFor({ timeout: 90000 });
    await pd.waitForTimeout(500);
    check("gia sư vừa vào vỏ: máy nhớ 'tutor'", (await pd.evaluate(() => localStorage.getItem("kin.vo"))) === "tutor");
    check("…và <html> có data-kin-vo=tutor", (await pd.evaluate(() => document.documentElement.getAttribute("data-kin-vo"))) === "tutor");
    await ctxD.close();
  }

  section("Trang không có vỏ (đăng nhập / quên mật khẩu) — người đã đăng nhập VẪN thấy thanh trên của khách, dù máy đã nhớ gợi ý");
  {
    const ctx = await ctxFor(S, { width: 1280, height: 800 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/thu-vien`, { waitUntil: "load", timeout: 150000 });
    await p.locator("#kin-rail").waitFor({ timeout: 90000 });
    await p.waitForTimeout(500);
    check("(chuẩn bị) máy đã nhớ gợi ý 'student'", (await p.evaluate(() => localStorage.getItem("kin.vo"))) === "student");
    await p.goto(`${BASE}/quen-mat-khau`, { waitUntil: "load", timeout: 150000 });
    await p.getByRole("navigation", { name: "Điều hướng chính" }).waitFor({ state: "visible", timeout: 90000 });
    check("/quen-mat-khau đã đăng nhập + có gợi ý: thanh trên của khách hiện, không có thanh bên", await p.getByRole("navigation", { name: "Điều hướng chính" }).isVisible() && !(await p.locator("#kin-rail").count()));
    await ctx.close();
  }

  check("không có lỗi JavaScript trên trang nào", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
