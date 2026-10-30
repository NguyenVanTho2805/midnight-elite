// 14/10/2026 — "đăng nhập vào là chỉ hiện dashboard, không hiện như trang cho guest": máy chủ + trình duyệt thật.
// 31/10/2026 (BU-00 bước 3) — gia sư KHÔNG còn làm việc trong /admin/*: mở /admin/thi-thu*, /admin/khoa-hoc* thì máy chủ 307 (cùng tên miền, no-store) sang
// bí danh /lop-cua-toi/de-thi*, /lop-cua-toi/quan-lop* (src/lib/tutorRoutes.ts), giữ tham số; đường không có bí danh (/admin, /admin/kiem-duyet, /admin/khoa-hoc/danh-muc)
// về Hộp việc. Các bí danh chạy trong vỏ GIA SƯ ("Module của gia sư") với dải tab nội dung (TutorContentTabs) thay dải tab quản trị.
// Phủ: máy chủ (307 đúng đích, no-store, người khác vẫn sang tên miền admin), trình duyệt (vỏ, dải tab, mục sáng trên thanh bên, thu/mở thanh bên, 390px),
// trang chủ / đăng ký / đăng nhập cho người đã đăng nhập đi thẳng vào dashboard; khách không đổi gì.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-tutor-admin.ts  (cần Next dev cổng 3100 + Chromium, xem README).
import http from "node:http";
import { BASE, cookieFor, mkSuper, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

async function get(path: string, cookie?: string) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
  await res.arrayBuffer();
  return { status: res.status, location: res.headers.get("location"), cacheControl: res.headers.get("cache-control") };
}
// fetch không cho đặt header Host, nên dùng http.request để giả lập tên miền admin.
function getAsAdminHost(path: string, cookie?: string): Promise<{ status: number; location: string | null }> {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE);
    const req = http.request({ host: "127.0.0.1", port: Number(u.port), path, method: "GET", headers: { host: "admin.midnightelite-edu.com:" + u.port, ...(cookie ? { cookie } : {}) } },
      res => { res.resume(); res.on("end", () => resolve({ status: res.statusCode ?? 0, location: (res.headers.location as string | undefined) ?? null })); });
    req.on("error", reject); req.end();
  });
}
const path = (loc: string | null) => { try { return loc ? new URL(loc, BASE).pathname + new URL(loc, BASE).search : null; } catch { return loc; } };
const host = (loc: string | null) => { try { return loc ? new URL(loc, BASE).host : null; } catch { return null; } };

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Minh Anh" });
  const SA = await mkSuper("Quản trị cấp 1");
  const A = await mkCourse(T.id, { name: "Toán 9" });
  // BU-00: gia sư mặc định đủ module; bật tường minh cho rõ ý (Hộp việc, Lớp, Bài tập, Thư viện).
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const [tc, sc, ac] = [await cookieFor(T), await cookieFor(S), await cookieFor(SA)];

  section("Máy chủ: /admin/* — gia sư 307 sang bí danh /lop-cua-toi (cùng tên miền), người khác sang tên miền admin");
  const t1 = await get("/admin/thi-thu", tc);
  check("gia sư mở /admin/thi-thu → 307 sang /lop-cua-toi/de-thi, CÙNG tên miền", t1.status === 307 && host(t1.location) === new URL(BASE).host && path(t1.location) === "/lop-cua-toi/de-thi", t1);
  check("chuyển hướng của gia sư kèm Cache-Control: no-store (không 308, không để trình duyệt nhớ)", /no-store/.test(t1.cacheControl ?? ""), t1.cacheControl);
  const t1b = await get("/admin/thi-thu/abc?x=1", tc);
  check("gia sư mở /admin/thi-thu/abc?x=1 → /lop-cua-toi/de-thi/abc?x=1 (giữ tham số)", t1b.status === 307 && path(t1b.location) === "/lop-cua-toi/de-thi/abc?x=1", t1b);
  const t1c = await get(`/admin/khoa-hoc/${A.id}?tab=lich-hoc`, tc);
  check("gia sư mở /admin/khoa-hoc/<lớp>?tab=lich-hoc → /lop-cua-toi/quan-lop/<lớp>?tab=lich-hoc", t1c.status === 307 && path(t1c.location) === `/lop-cua-toi/quan-lop/${A.id}?tab=lich-hoc`, t1c);
  const t1d = await get("/admin/khoa-hoc/danh-muc", tc);
  check("gia sư mở /admin/khoa-hoc/danh-muc (chỉ quản trị, không bí danh) → /lop-cua-toi", t1d.status === 307 && path(t1d.location) === "/lop-cua-toi", t1d);
  const t1e = await get("/admin/kiem-duyet", tc);
  check("gia sư mở /admin/kiem-duyet → /lop-cua-toi", t1e.status === 307 && path(t1e.location) === "/lop-cua-toi", t1e);
  const t2 = await get("/admin", tc);
  check("gia sư mở đúng /admin (bảng tổng quan quản trị) → về Hộp việc /lop-cua-toi", t2.status === 307 && path(t2.location) === "/lop-cua-toi", t2);
  const t3 = await get("/lop-cua-toi/de-thi", tc);
  check("gia sư mở thẳng bí danh /lop-cua-toi/de-thi → 200, không chuyển hướng", t3.status === 200, t3);
  for (const [name, c] of [["quản trị cấp 1", ac], ["học viên", sc], ["khách", undefined]] as const) {
    const r = await get("/admin/thi-thu?x=1", c);
    check(`${name} mở /admin/thi-thu?x=1 → 307 (không phải 308) sang tên miền admin, giữ tham số`, r.status === 307 && host(r.location)?.startsWith("admin.midnightelite-edu.com") === true && path(r.location) === "/admin/thi-thu?x=1", r);
    // 16/10/2026: 308 là "vĩnh viễn" nên trình duyệt nhớ — người mở /admin/... lúc chưa đăng nhập rồi đăng nhập gia sư sẽ mãi bị đẩy sang tên miền admin. Mọi chuyển hướng phải cấm lưu.
    check(`${name}: chuyển hướng sang tên miền admin kèm Cache-Control: no-store`, /no-store/.test(r.cacheControl ?? ""), r.cacheControl);
  }
  // Bí danh gia sư không dành cho người khác: layout (noi-dung) đưa quản trị về /admin (rồi sang tên miền admin), học viên về /lop-cua-toi.
  const s1 = await get("/lop-cua-toi/de-thi", sc);
  check("học viên mở /lop-cua-toi/de-thi → chuyển hướng về /lop-cua-toi (không thấy trang đề thi của gia sư)", s1.status === 307 && path(s1.location) === "/lop-cua-toi", s1);

  section("Máy chủ: tên miền admin");
  const a1 = await getAsAdminHost("/admin/thi-thu", tc);
  check("gia sư mở tên miền admin → 307 về tên miền chính, giữ đường dẫn (rồi tên miền chính 307 tiếp sang bí danh)", a1.status === 307 && host(a1.location) !== null && !host(a1.location)!.startsWith("admin.") && path(a1.location) === "/admin/thi-thu", a1);
  const a2 = await getAsAdminHost("/admin/kiem-duyet", ac);
  check("quản trị cấp 1 mở tên miền admin → vào bình thường (200)", a2.status === 200, a2);
  const a3 = await getAsAdminHost("/", ac);
  check("quản trị mở '/' của tên miền admin → dashboard admin (200)", a3.status === 200, a3);

  section("Máy chủ: trang chủ / đăng ký / đăng nhập cho người ĐÃ đăng nhập");
  const h1 = await get("/", sc), h2 = await get("/", tc), h3 = await get("/"), h4 = await get("/", ac);
  check("học viên mở '/' → /student/viec-cua-toi", h1.status === 307 && path(h1.location) === "/student/viec-cua-toi", h1);
  check("gia sư mở '/' → /lop-cua-toi", h2.status === 307 && path(h2.location) === "/lop-cua-toi", h2);
  check("khách mở '/' → xem trang chủ (200)", h3.status === 200, h3);
  check("quản trị mở '/' trên tên miền chính → vẫn 200 (không bị đẩy sang tên miền không có phiên)", h4.status === 200, h4);
  const g1 = await get("/dang-ky", sc), g2 = await get("/dang-nhap", tc), g3 = await get("/dang-nhap?redirect=%2Fstudent%2Flich-hoc", sc), g4 = await get("/dang-nhap?redirect=https%3A%2F%2Fevil.example%2Fx", sc);
  check("học viên đã đăng nhập mở /dang-ky → dashboard", g1.status === 307 && path(g1.location) === "/student/viec-cua-toi", g1);
  check("gia sư mở /dang-nhap → Hộp việc", g2.status === 307 && path(g2.location) === "/lop-cua-toi", g2);
  check("mở /dang-nhap?redirect=/student/lich-hoc → về đúng trang đang định vào", g3.status === 307 && path(g3.location) === "/student/lich-hoc", g3);
  check("redirect ra địa chỉ ngoài bị bỏ qua → dashboard", g4.status === 307 && path(g4.location) === "/student/viec-cua-toi" && host(g4.location) === new URL(BASE).host, g4);
  const k1 = await get("/dang-nhap"), k2 = await get("/dang-ky"), k3 = await get("/thu-vien", sc), k4 = await get("/khoa-hoc", tc);
  check("khách mở /dang-nhap, /dang-ky → 200; học viên/gia sư mở /thu-vien, /khoa-hoc → 200 (trang hiện trong vỏ dashboard, không bị chặn)", k1.status === 200 && k2.status === 200 && k3.status === 200 && k4.status === 200, [k1, k2, k3, k4]);

  // ───────────────────────────── Trình duyệt
  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(m.text()); }); };
  const rail = (p: any) => p.getByRole("navigation", { name: "Module của gia sư" });
  const adminRail = (p: any) => p.getByRole("navigation", { name: "Module quản trị" });
  const cur = (p: any, name: string) => rail(p).getByRole("link", { name: new RegExp(`^${name}`) }).getAttribute("aria-current");
  const tabsDeThi = (p: any) => p.getByRole("navigation", { name: "Trang của Đề thi" });
  const tabsQuanLop = (p: any) => p.getByRole("navigation", { name: "Trang của Quản lớp" });

  section("Trình duyệt: gia sư bấm 'Quản lý đề thi' → bí danh /lop-cua-toi/de-thi trong vỏ gia sư, có dải tab Đề thi · Ngân hàng câu hỏi · Ngân hàng đề");
  const ctx = await ctxFor(T, { width: 1280, height: 800 });
  const pg = await ctx.newPage(); watch(pg);
  await pg.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pg).waitFor({ timeout: 90000 });
  await rail(pg).getByRole("link", { name: /^Bài tập/ }).click();
  await pg.waitForURL(/\/lop-cua-toi\/bai-tap/, { timeout: 90000 });
  await rail(pg).waitFor({ timeout: 90000 });
  check("bấm 'Bài tập' → /lop-cua-toi/bai-tap, 'Bài tập' đang chọn", new URL(pg.url()).pathname === "/lop-cua-toi/bai-tap" && (await cur(pg, "Bài tập")) === "page", pg.url());
  check("'Quản lý đề thi' trỏ thẳng bí danh /lop-cua-toi/de-thi (không còn /admin/thi-thu)", (await pg.getByRole("link", { name: "Quản lý đề thi" }).getAttribute("href")) === "/lop-cua-toi/de-thi");
  await pg.getByRole("link", { name: "Quản lý đề thi" }).click();
  await pg.waitForURL(/\/lop-cua-toi\/de-thi$/, { timeout: 90000 });
  await rail(pg).waitFor({ timeout: 90000 });
  const u = new URL(pg.url());
  check("'Quản lý đề thi' → /lop-cua-toi/de-thi trên tên miền chính", u.hostname === "localhost" && u.pathname === "/lop-cua-toi/de-thi", pg.url());
  check("vẫn thấy thanh bên của GIA SƯ; không có thanh bên quản trị", await rail(pg).isVisible() && (await adminRail(pg).count()) === 0);
  check("'Bài tập' đang chọn (aria-current=page), 'Thư viện' không", (await cur(pg, "Bài tập")) === "page" && (await cur(pg, "Thư viện")) !== "page");
  await tabsDeThi(pg).waitFor({ timeout: 30000 });
  const tabText = (await tabsDeThi(pg).innerText()).replace(/\s+/g, " ").trim();
  check("dải tab 'Trang của Đề thi': Đề thi · Ngân hàng câu hỏi · Ngân hàng đề, 'Đề thi' đang chọn, không có dải tab quản trị 'Trang của Nội dung'", /Đề thi.*Ngân hàng câu hỏi.*Ngân hàng đề/.test(tabText) && await tabsDeThi(pg).getByRole("link", { name: "Đề thi", exact: true }).getAttribute("aria-current") === "page" && (await pg.getByRole("navigation", { name: "Trang của Nội dung" }).count()) === 0, tabText);
  check("có dải trên của vỏ gia sư (logo KiN + tên + nút mở thanh bên ẩn)", await pg.getByRole("link", { name: /KiN — Hộp việc của gia sư/ }).isVisible());
  await shot(pg, "tutor-admin-1-de-thi");

  section("Trình duyệt: đường cũ /admin/* → 307 sang bí danh, vẫn vỏ gia sư, mục đúng sáng");
  await pg.goto(`${BASE}/admin/thi-thu`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForURL(/\/lop-cua-toi\/de-thi$/, { timeout: 60000 });
  await rail(pg).waitFor({ timeout: 90000 });
  check("gõ /admin/thi-thu → tới /lop-cua-toi/de-thi, vỏ gia sư, dải tab Đề thi", new URL(pg.url()).pathname === "/lop-cua-toi/de-thi" && await rail(pg).isVisible() && await tabsDeThi(pg).isVisible(), pg.url());
  await pg.goto(`${BASE}/admin/thi-thu/ngan-hang-de-thi`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForURL(/\/lop-cua-toi\/de-thi\/ngan-hang-de-thi/, { timeout: 60000 });
  await rail(pg).waitFor({ timeout: 90000 });
  check("/admin/thi-thu/ngan-hang-de-thi → /lop-cua-toi/de-thi/ngan-hang-de-thi; 'Bài tập' sáng, 'Thư viện' không; tab 'Ngân hàng đề' đang chọn", (await cur(pg, "Bài tập")) === "page" && (await cur(pg, "Thư viện")) !== "page" && await tabsDeThi(pg).getByRole("link", { name: "Ngân hàng đề" }).getAttribute("aria-current") === "page", pg.url());
  await pg.goto(`${BASE}/admin/khoa-hoc/${A.id}?tab=lich-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForURL(new RegExp(`/lop-cua-toi/quan-lop/${A.id}\\?tab=lich-hoc`), { timeout: 60000 });
  await rail(pg).waitFor({ timeout: 90000 });
  check("/admin/khoa-hoc/<lớp>?tab=lich-hoc → /lop-cua-toi/quan-lop/<lớp>?tab=lich-hoc (giữ tham số); 'Lớp' sáng; dải tab Quản lớp có 'Lịch học' đang chọn", new URL(pg.url()).searchParams.get("tab") === "lich-hoc" && (await cur(pg, "Lớp")) === "page" && await tabsQuanLop(pg).getByRole("link", { name: "Lịch học" }).getAttribute("aria-current") === "page", pg.url());
  const qlText = (await tabsQuanLop(pg).innerText()).replace(/\s+/g, " ").trim();
  check("dải tab Quản lớp: Cài đặt · Chương bài · Lịch học · Học viên · Điểm danh", /Cài đặt.*Chương bài.*Lịch học.*Học viên.*Điểm danh/.test(qlText), qlText);
  await shot(pg, "tutor-admin-2-quan-lop");
  await pg.goto(`${BASE}/admin/khoa-hoc/${A.id}/hoc-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForURL(new RegExp(`/lop-cua-toi/quan-lop/${A.id}/hoc-vien`), { timeout: 60000 });
  await rail(pg).waitFor({ timeout: 90000 });
  check("trang học viên của lớp → /lop-cua-toi/quan-lop/<lớp>/hoc-vien: 'Lớp' sáng, tab 'Học viên' đang chọn", (await cur(pg, "Lớp")) === "page" && await tabsQuanLop(pg).getByRole("link", { name: "Học viên" }).getAttribute("aria-current") === "page", pg.url());
  await pg.goto(`${BASE}/admin/khoa-hoc/${A.id}/diem-danh`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForURL(new RegExp(`/lop-cua-toi/quan-lop/${A.id}/diem-danh`), { timeout: 60000 });
  await rail(pg).waitFor({ timeout: 90000 });
  check("trang điểm danh của lớp → bí danh, vẫn trong vỏ gia sư, 'Lớp' sáng, tab 'Điểm danh' đang chọn", await rail(pg).isVisible() && (await cur(pg, "Lớp")) === "page" && new URL(pg.url()).hostname === "localhost" && await tabsQuanLop(pg).getByRole("link", { name: "Điểm danh" }).getAttribute("aria-current") === "page", pg.url());
  await pg.goto(`${BASE}/admin/kiem-duyet`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForURL(/\/lop-cua-toi$/, { timeout: 60000 });
  check("gia sư gõ /admin/kiem-duyet (không bí danh) → về Hộp việc", new URL(pg.url()).pathname === "/lop-cua-toi", pg.url());
  await pg.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForURL(/\/lop-cua-toi$/, { timeout: 60000 });
  check("gia sư gõ /admin → về Hộp việc, không thấy bảng quản trị", new URL(pg.url()).pathname === "/lop-cua-toi");
  check("không có thanh bên quản trị nào xuất hiện trong cả phiên", (await adminRail(pg).count()) === 0);

  section("Trình duyệt: thu / mở thanh bên cũng chạy ở các trang bí danh của gia sư");
  await pg.goto(`${BASE}/lop-cua-toi/de-thi`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pg).waitFor({ timeout: 90000 });
  await pg.getByRole("button", { name: "Thu gọn thanh bên" }).click();
  await eventually("thu: thanh ẩn, nút mở hiện", async () => !(await rail(pg).isVisible()) && await pg.getByRole("button", { name: /^Mở thanh bên/ }).isVisible());
  await pg.getByRole("button", { name: /^Mở thanh bên/ }).click();
  await rail(pg).waitFor({ timeout: 10000 });
  await ctx.close();

  section("Trình duyệt: trang chủ / đăng ký cho người đã đăng nhập → thẳng dashboard");
  const ctxS = await ctxFor(S, { width: 1280, height: 800 });
  const ps = await ctxS.newPage(); watch(ps);
  await ps.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  check("học viên gõ trang chủ → /student/viec-cua-toi, thấy thanh bên học sinh, không thấy Navbar khách", /\/student\/viec-cua-toi/.test(ps.url()) && await ps.getByRole("navigation", { name: "Module của học sinh" }).isVisible() && (await ps.getByRole("navigation", { name: "Điều hướng chính" }).count()) === 0, ps.url());
  await ps.goto(`${BASE}/dang-ky`, { waitUntil: "networkidle", timeout: 120000 });
  check("học viên gõ /dang-ky → dashboard", /\/student\/viec-cua-toi/.test(ps.url()), ps.url());
  await ps.goto(`${BASE}/lop-cua-toi/de-thi`, { waitUntil: "networkidle", timeout: 120000 });
  await ps.waitForURL(/\/lop-cua-toi/, { timeout: 60000 });
  check("học viên gõ bí danh gia sư /lop-cua-toi/de-thi → không thấy trang đề thi (bị đưa đi, không trang trắng)", !/\/lop-cua-toi\/de-thi/.test(ps.url()) && (await ps.getByRole("navigation", { name: "Trang của Đề thi" }).count()) === 0, ps.url());
  await ctxS.close();
  const ctxG = await ctxFor(null, { width: 1280, height: 800 });
  const pgst = await ctxG.newPage(); watch(pgst);
  await pgst.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  check("khách gõ trang chủ → vẫn thấy trang giới thiệu (Navbar khách), không bị chuyển", new URL(pgst.url()).pathname === "/" && await pgst.getByRole("navigation", { name: "Điều hướng chính" }).isVisible());
  await ctxG.close();

  section("Điện thoại 390px: gia sư ở trang bí danh vẫn có thanh dưới của gia sư, dải tab cuộn ngang, không tràn");
  const ctxM = await ctxFor(T, { width: 390, height: 844 });
  const pm = await ctxM.newPage(); watch(pm);
  await pm.goto(`${BASE}/admin/thi-thu`, { waitUntil: "networkidle", timeout: 120000 });
  await pm.waitForURL(/\/lop-cua-toi\/de-thi$/, { timeout: 60000 });
  await rail(pm).waitFor({ timeout: 90000 });
  check("có thanh dưới của gia sư; có dải tab Đề thi; không tràn ngang", await rail(pm).isVisible() && await tabsDeThi(pm).isVisible() && await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(pm, "tutor-admin-3-390");
  await ctxM.close();

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})();
