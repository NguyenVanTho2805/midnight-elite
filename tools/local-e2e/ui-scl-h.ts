// SCL-H (P2-30, P2-31, P2-33): vỏ học sinh dựng ở máy chủ + một lần gọi việc/lịch + hồ sơ lấy lớp từ /api/student/lop.
//  • HTML máy chủ của /student/viec-cua-toi đã có thanh module (không còn chỉ vòng xoay "Đang tải");
//  • chuyển hướng giữ như cũ: khách → /dang-nhap?redirect=<trang + tham số>&vai=hoc-sinh; gia sư → /lop-cua-toi;
//  • mở "Việc của tôi": /api/student/viec-cua-toi đúng 1 lần, không gọi /api/schedule, không chờ /api/auth/me mới có trang;
//  • phản hồi viec-cua-toi có `events` trùng /api/schedule; hồ sơ hiện lớp riêng (không có trong danh mục công khai).
// Cần máy chủ dev. XOÁ SẠCH DB thử. Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/ui-scl-h.ts
import { BASE, api, cookieFor, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Hiệu Năng");
  const S = await mkUser({ name: "Em Hiệu Năng" });
  const A = await mkCourse(T.id, { name: "Lớp riêng thử SCLH" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const d = new Date(Date.now() + 3 * 86_400_000);
  const date = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  await prisma.exam.create({ data: { id: "sclh-de", code: "sclh-de", title: "Đề lớp riêng", category: "Toán", date, time: "08:00", duration: "45", questions: 5, status: "available", createdAt: "2020", courseId: A.id, ownerId: T.id } });

  section("HTML máy chủ có vỏ");
  const html = await (await fetch(`${BASE}/student/viec-cua-toi`, { headers: { cookie: await cookieFor(S) } })).text();
  check("HTML có thanh module của học sinh", html.includes("Module của học sinh"));
  check("HTML có tên học sinh ở dải trên (đã biết người dùng ở máy chủ)", html.includes("Em Hiệu Năng"));

  section("API: việc + lịch một phản hồi");
  const w = await api("GET", "/api/student/viec-cua-toi", { as: S }), sc = await api("GET", "/api/schedule", { as: S });
  const ev = (w.json as { events?: unknown[] }).events;
  check("viec-cua-toi có events trùng /api/schedule", Array.isArray(ev) && JSON.stringify(ev) === JSON.stringify((sc.json as { events: unknown[] }).events), { ev, sc: sc.json });
  check("events có đề của lớp em", Array.isArray(ev) && ev.some(e => (e as { id: string }).id === "exam-sclh-de"));

  await launch();
  section("Chuyển hướng như cũ");
  const g = await (await ctxFor(null)).newPage();
  await g.goto(`${BASE}/student/viec-cua-toi?x=1`, { waitUntil: "commit" });
  await g.waitForURL(u => u.pathname === "/dang-nhap", { timeout: 90000 });
  const gu = new URL(g.url());
  check("khách → /dang-nhap?redirect=/student/viec-cua-toi?x=1&vai=hoc-sinh", gu.searchParams.get("redirect") === "/student/viec-cua-toi?x=1" && gu.searchParams.get("vai") === "hoc-sinh", g.url());
  const t = await (await ctxFor(T)).newPage();
  await t.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "commit" });
  await t.waitForURL(u => u.pathname.startsWith("/lop-cua-toi"), { timeout: 90000 });
  check("gia sư → vỏ gia sư /lop-cua-toi", new URL(t.url()).pathname.startsWith("/lop-cua-toi"), t.url());

  section("Trình duyệt: Việc của tôi");
  const ctx = await ctxFor(S);
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 }); // làm nóng
  const count: Record<string, number> = {};
  pg.on("request", r => { const p = new URL(r.url()).pathname; if (p.startsWith("/api/")) count[p] = (count[p] ?? 0) + 1; });
  await pg.reload({ waitUntil: "networkidle" });
  check("/api/student/viec-cua-toi đúng 1 lần (vỏ + trang dùng chung)", count["/api/student/viec-cua-toi"] === 1, count);
  check("không gọi /api/schedule", !count["/api/schedule"], count);
  await pg.getByRole("heading", { level: 1, name: "Việc của tôi" }).waitFor({ timeout: 30000 });
  check("số việc trên thanh module vẫn hiện từ phản hồi chung", await pg.getByRole("navigation", { name: "Module của học sinh" }).getByRole("link", { name: /^Việc của tôi/ }).count() > 0);

  section("Thông báo không hỏi khi tab ẩn");
  const np = await ctx.newPage();
  await np.clock.install();
  await np.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  let notif = 0;
  np.on("request", r => { if (new URL(r.url()).pathname === "/api/notifications") notif++; });
  // Chuỗi, không hàm: tsx chèn __name vào hàm truyền cho evaluate.
  const setVis = (v: string) => np.evaluate(`Object.defineProperty(document, "visibilityState", { configurable: true, get() { return ${JSON.stringify(v)}; } }); document.dispatchEvent(new Event("visibilitychange"));`);
  await setVis("hidden");
  await np.clock.runFor(65_000);
  await np.waitForTimeout(500);
  check("tab ẩn 65 giây: không gọi /api/notifications", notif === 0, notif);
  await setVis("visible");
  await np.waitForTimeout(1500);
  check("quay lại tab: hỏi ngay một lần", notif === 1, notif);

  section("Hồ sơ: lớp từ /api/student/lop");
  const hs = await ctx.newPage();
  const seenApi: string[] = [];
  hs.on("request", r => { const p = new URL(r.url()).pathname; if (p === "/api/courses" || p === "/api/student/lop") seenApi.push(p); });
  await hs.goto(`${BASE}/student/ho-so`, { waitUntil: "networkidle", timeout: 120000 });
  check("hồ sơ hiện lớp riêng của em", await hs.getByText("Lớp riêng thử SCLH").count() > 0);
  check("hồ sơ không tải danh mục /api/courses", !seenApi.includes("/api/courses") && seenApi.includes("/api/student/lop"), seenApi);

  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
