// AuthGuard hỏi lại /api/auth/me một lần trước khi đuổi sang đăng nhập (16/10/2026; việc đề xuất sau rà vai học sinh).
// Gốc lỗi trang trắng ở bước xác thực email: AuthProvider chỉ hỏi /api/auth/me MỘT lần lúc mở trang, nên phiên do máy chủ tạo SAU đó
// (xác thực email tự đăng nhập) không bao giờ vào `user`. Khi trang chuyển client (router.push, KHÔNG tải cứng) vào khu có AuthGuard thì
// guard thấy user = null → /dang-nhap?redirect= → proxy thấy cookie hợp lệ → 307 đẩy ngược → còn lại trang trắng (AuthGuard return null).
//   R1  Khách mở /khoa-hoc, đăng nhập BẰNG fetch (phiên có ở máy chủ, AuthContext không biết), router.push vào /student/viec-cua-toi
//       → vào được khu học sinh (thấy thanh module), không trắng, không văng sang /dang-nhap
//   R2  Khách thật sự chưa đăng nhập, mở thẳng /student/viec-cua-toi (tải cứng) → /dang-nhap?redirect= đúng trang, CHỈ MỘT lần hỏi /api/auth/me
//   R3  Khách thật sự chưa đăng nhập, router.push vào khu học sinh từ trang công khai → /dang-nhap?redirect= đúng trang (hỏi lại đúng một lần: 2 lần tổng cộng)
//   R4  Học sinh đã đăng nhập mở thẳng /student/viec-cua-toi → vào được, không hỏi /api/auth/me thêm lần nào ngoài lần của AuthProvider
//   R5  Đăng xuất ở khu học sinh vẫn tải cứng về "/" (không rơi vào /dang-nhap?redirect=<trang cũ>)
//   R6  Tài khoản đã bị quản trị xoá nhưng cookie còn hạn (30 ngày): mở khu học sinh → /dang-nhap hiện form (không trang trắng) và cookie bị xoá;
//       trước đây /api/auth/me trả null mà giữ cookie, proxy thấy "đã đăng nhập" nên đẩy /dang-nhap và /dang-ky ngược về trang cũ → trắng, không đăng nhập lại được
import { BASE, mkTutor, mkCourse, mkUser, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

const GUARDED = "/student/viec-cua-toi";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Hoa (guard)");
  const C = await mkCourse(T.id, { name: "Toán 9 — guard" });
  const S = await mkUser({ name: "Học Sinh Guard" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });

  await launch();
  const errors: string[] = [];
  const noise = /Failed to load resource|favicon|font|status of 4\d\d/i;
  let seq = 0;
  async function freshPage(u: typeof S | null) {
    const ctx = await ctxFor(u, { width: 1280, height: 900 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.setExtraHTTPHeaders({ "x-forwarded-for": `10.96.${Math.floor(Math.random() * 250)}.${(seq++ % 250) + 1}` });   // không vướng giới hạn tốc độ theo IP
    const p = await ctx.newPage();
    const me: string[] = [];
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !noise.test(m.text())) errors.push(m.text()); });
    p.on("request", r => { if (new URL(r.url()).pathname === "/api/auth/me") me.push(r.url()); });
    return { ctx, p, me };
  }
  const at = (p: { url(): string }) => new URL(p.url());
  const shellUp = (p: import("playwright").Page) => p.locator('nav[aria-label="Module của học sinh"]').count().then(n => n > 0);

  section("R1. Phiên có ở máy chủ nhưng AuthContext chưa biết → router.push vào khu học sinh");
  {
    const { ctx, p } = await freshPage(null);
    await p.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
    const loginStatus = await p.evaluate(async (a) => {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) });
      return r.status;
    }, { identifier: S.email, password: "Passw0rd!" });
    check("đăng nhập bằng fetch thành công (cookie phiên đã có)", loginStatus === 200, loginStatus);
    const hasRouter = await p.evaluate(() => typeof (window as unknown as { next?: { router?: { push?: unknown } } }).next?.router?.push === "function");
    check("có window.next.router để đẩy trang kiểu client (không tải cứng)", hasRouter);
    await p.evaluate((to) => (window as unknown as { next: { router: { push(u: string): void } } }).next.router.push(to), GUARDED);
    await eventually("vào được khu học sinh (không bị đuổi sang /dang-nhap)", () => at(p).pathname === GUARDED, 30000);
    await eventually("thấy thanh module HỌC SINH (không phải trang trắng)", () => shellUp(p), 30000);
    const bodyText = (await p.locator("body").innerText()).trim();
    check("trang có nội dung (không trắng)", bodyText.length > 20, bodyText.slice(0, 80));
    await ctx.close();
  }

  section("R2. Khách thật sự chưa đăng nhập mở thẳng khu học sinh (tải cứng) → đăng nhập, chỉ một lần hỏi /api/auth/me");
  {
    const { ctx, p, me } = await freshPage(null);
    await p.goto(`${BASE}${GUARDED}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await eventually("sang /dang-nhap?redirect=<trang đang định vào>", () => at(p).pathname === "/dang-nhap" && at(p).searchParams.get("redirect") === GUARDED, 30000);
    await p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    check("chỉ một lần hỏi /api/auth/me (của AuthProvider; khách mở thẳng thì không hỏi thừa)", me.length === 1, me.length);
    await ctx.close();
  }

  section("R3. Khách thật sự chưa đăng nhập, router.push vào khu học sinh từ trang công khai");
  {
    const { ctx, p, me } = await freshPage(null);
    await p.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
    const before = me.length;
    await p.evaluate((to) => (window as unknown as { next: { router: { push(u: string): void } } }).next.router.push(to), GUARDED);
    await eventually("sang /dang-nhap?redirect=<trang đang định vào>", () => at(p).pathname === "/dang-nhap" && at(p).searchParams.get("redirect") === GUARDED, 30000);
    check("hỏi lại /api/auth/me đúng một lần trước khi đuổi đi", me.length - before === 1, me.length - before);
    await ctx.close();
  }

  section("R4. Học sinh đã đăng nhập mở thẳng khu học sinh → không hỏi thừa");
  {
    const { ctx, p, me } = await freshPage(S);
    await p.goto(`${BASE}${GUARDED}`, { waitUntil: "networkidle", timeout: 120000 });
    await eventually("thấy thanh module HỌC SINH", () => shellUp(p), 30000);
    check("chỉ một lần hỏi /api/auth/me (của AuthProvider)", me.length === 1, me.length);

    section("R5. Đăng xuất ở khu học sinh → tải cứng về trang chủ");
    await p.getByRole("button", { name: /^Tài khoản của/ }).click();
    await p.getByRole("menuitem", { name: "Đăng xuất" }).click();
    await eventually("về '/' (không phải /dang-nhap?redirect=...)", () => at(p).pathname === "/", 30000);
    await p.waitForTimeout(1500);
    check("vẫn ở '/' sau khi mọi thứ lắng xuống", at(p).pathname === "/", at(p).pathname + at(p).search);
    await ctx.close();
  }

  section("R6. Cookie còn hạn nhưng tài khoản đã bị xoá");
  {
    const GONE = await mkUser({ name: "Học Sinh Bị Xoá" });
    const { ctx, p } = await freshPage(GONE);
    await prisma.user.delete({ where: { id: GONE.id } });
    await p.goto(`${BASE}${GUARDED}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await eventually("sang /dang-nhap (không kẹt ở trang trắng)", () => at(p).pathname === "/dang-nhap", 30000);
    await eventually("trang đăng nhập hiện form (có ô mật khẩu)", async () => (await p.locator('input[type="password"]').count()) > 0, 30000);
    await p.waitForTimeout(1500);
    check("vẫn ở /dang-nhap sau khi lắng xuống (proxy không đẩy ngược)", at(p).pathname === "/dang-nhap", at(p).pathname + at(p).search);
    const cookies = await ctx.cookies(BASE);
    check("cookie phiên của tài khoản đã xoá bị xoá", !cookies.some(c => c.name === "midnight_session"), cookies.map(c => c.name));
    await p.goto(`${BASE}/dang-ky`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await eventually("mở được /dang-ky (không bị đẩy ngược về trang cũ)", () => at(p).pathname === "/dang-ky", 30000);
    await ctx.close();
  }

  check("không có lỗi JS / console.error", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await prisma.$disconnect();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
