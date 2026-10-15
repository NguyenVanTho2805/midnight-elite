// 14/10/2026 — "đăng nhập vào là chỉ hiện dashboard, không hiện như trang cho guest": máy chủ + trình duyệt thật.
// Phủ: gia sư mở các trang /admin/* ngay trên TÊN MIỀN CHÍNH trong vỏ gia sư (không bị đẩy sang tên miền quản trị, không đăng nhập lại, không thấy giao diện
// quản trị); người khác vẫn sang tên miền admin; trang chủ / đăng ký / đăng nhập cho người đã đăng nhập đi thẳng vào dashboard; khách không đổi gì.
import http from "node:http";
import { BASE, cookieFor, mkSuper, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

async function get(path: string, cookie?: string) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
  await res.arrayBuffer();
  return { status: res.status, location: res.headers.get("location") };
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
  // Gia sư mới ở chế độ gọn (chỉ Lịch + Học phí); bật đủ module như một gia sư đã dùng một thời gian.
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const [tc, sc, ac] = [await cookieFor(T), await cookieFor(S), await cookieFor(SA)];

  section("Máy chủ: /admin/* — gia sư ở lại, người khác sang tên miền admin");
  const t1 = await get("/admin/thi-thu", tc);
  check("gia sư mở /admin/thi-thu trên tên miền chính → 200, KHÔNG chuyển hướng", t1.status === 200, t1);
  const t2 = await get("/admin", tc);
  check("gia sư mở đúng /admin (bảng tổng quan quản trị) → về Hộp việc /lop-cua-toi", t2.status === 307 && path(t2.location) === "/lop-cua-toi", t2);
  for (const [name, c] of [["quản trị cấp 1", ac], ["học viên", sc], ["khách", undefined]] as const) {
    const r = await get("/admin/thi-thu?x=1", c);
    check(`${name} mở /admin/thi-thu?x=1 → 308 sang tên miền admin, giữ tham số`, r.status === 308 && host(r.location)?.startsWith("admin.midnightelite-edu.com") === true && path(r.location) === "/admin/thi-thu?x=1", r);
  }

  section("Máy chủ: tên miền admin");
  const a1 = await getAsAdminHost("/admin/thi-thu", tc);
  check("gia sư mở tên miền admin → 307 về tên miền chính, giữ đường dẫn", a1.status === 307 && host(a1.location) !== null && !host(a1.location)!.startsWith("admin.") && path(a1.location) === "/admin/thi-thu", a1);
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

  section("Trình duyệt: gia sư mở Bài KT / Thư viện / Lớp — vẫn trong dashboard của mình");
  const ctx = await ctxFor(T, { width: 1280, height: 800 });
  const pg = await ctx.newPage(); watch(pg);
  await pg.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pg).waitFor({ timeout: 90000 });
  await rail(pg).getByRole("link", { name: /^Bài KT/ }).click();
  await pg.waitForURL(/\/admin\/thi-thu/, { timeout: 90000 });
  await rail(pg).waitFor({ timeout: 90000 });
  const u = new URL(pg.url());
  check("bấm 'Bài KT' → mở /admin/thi-thu NGAY TRÊN tên miền chính (không sang admin.…)", u.hostname === "localhost" && u.pathname === "/admin/thi-thu", pg.url());
  check("vẫn thấy thanh bên của GIA SƯ; không có thanh bên quản trị", await rail(pg).isVisible() && (await adminRail(pg).count()) === 0);
  check("'Bài KT' đang chọn (aria-current=page), 'Thư viện' không", (await cur(pg, "Bài KT")) === "page" && (await cur(pg, "Thư viện")) !== "page");
  check("có dải tab 'Trang của Nội dung' với tab 'Đề thi' đang chọn", await pg.getByRole("navigation", { name: "Trang của Nội dung" }).getByRole("link", { name: "Đề thi" }).getAttribute("aria-current") === "page");
  check("có dải trên của vỏ gia sư (logo KiN + tên + nút mở thanh bên ẩn)", await pg.getByRole("link", { name: /KiN — Hộp việc của gia sư/ }).isVisible());
  await shot(pg, "tutor-admin-1-bai-kt");

  await pg.goto(`${BASE}/admin/thi-thu/ngan-hang-de-thi`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pg).waitFor({ timeout: 90000 });
  check("/admin/thi-thu/ngan-hang-de-thi (ngân hàng đề): thuộc họ 'Bài KT' nên 'Bài KT' sáng, 'Thư viện' không", (await cur(pg, "Bài KT")) === "page" && (await cur(pg, "Thư viện")) !== "page");
  await pg.goto(`${BASE}/admin/khoa-hoc/${A.id}/hoc-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pg).waitFor({ timeout: 90000 });
  check("trang học viên của lớp (/admin/khoa-hoc/<lớp>/hoc-vien): 'Lớp' sáng", (await cur(pg, "Lớp")) === "page");
  await pg.goto(`${BASE}/admin/khoa-hoc/${A.id}/diem-danh`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pg).waitFor({ timeout: 90000 });
  check("trang điểm danh của lớp: vẫn trong vỏ gia sư, 'Lớp' sáng", await rail(pg).isVisible() && (await cur(pg, "Lớp")) === "page" && new URL(pg.url()).hostname === "localhost");
  await pg.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForURL(/\/lop-cua-toi/, { timeout: 60000 });
  check("gia sư gõ /admin → về Hộp việc, không thấy bảng quản trị", /\/lop-cua-toi/.test(pg.url()));
  check("không có thanh bên quản trị nào xuất hiện trong cả phiên", (await adminRail(pg).count()) === 0);

  section("Trình duyệt: thu / mở thanh bên cũng chạy ở các trang /admin/* của gia sư");
  await pg.goto(`${BASE}/admin/thi-thu`, { waitUntil: "networkidle", timeout: 120000 });
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
  await ctxS.close();
  const ctxG = await ctxFor(null, { width: 1280, height: 800 });
  const pgst = await ctxG.newPage(); watch(pgst);
  await pgst.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  check("khách gõ trang chủ → vẫn thấy trang giới thiệu (Navbar khách), không bị chuyển", new URL(pgst.url()).pathname === "/" && await pgst.getByRole("navigation", { name: "Điều hướng chính" }).isVisible());
  await ctxG.close();

  section("Điện thoại 390px: gia sư ở trang /admin/* vẫn có thanh dưới của gia sư");
  const ctxM = await ctxFor(T, { width: 390, height: 844 });
  const pm = await ctxM.newPage(); watch(pm);
  await pm.goto(`${BASE}/admin/thi-thu`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pm).waitFor({ timeout: 90000 });
  check("có thanh dưới của gia sư; không tràn ngang", await rail(pm).isVisible() && await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await ctxM.close();

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})();
