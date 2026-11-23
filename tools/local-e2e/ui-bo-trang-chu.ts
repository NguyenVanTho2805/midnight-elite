// 23/11/2026 (chủ: "bỏ trang chủ, vào web phát là học sinh vào lớp"): "/" không còn trang chủ.
//   khách → /dang-nhap; học sinh → Lớp /student/hoc-tap; gia sư → trang đầu gia sư; vỏ học sinh / gia sư không còn chữ "Trang chủ KiN".
// Ca phá cố ý: bỏ nhánh `pathname === "/"` trong decideRoute → 3 ca đầu đỏ (ở lại "/").
import { BASE, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, closeAll } from "./ui";
import { landingPath } from "@/lib/landing";

const path = (u: string) => new URL(u).pathname;

(async () => {
  await wipe();
  const S = await mkUser({ name: "Minh Anh" });
  const T = await mkTutor("Cô Lan");
  const c = await mkCourse(T.id, { name: "Lịch Sử - Tổng Ôn" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: c.id, status: "active" } });
  await launch();

  section("Mở gốc '/'");
  const g = await (await ctxFor(null)).newPage();
  await g.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
  check("khách mở '/' → /dang-nhap", path(g.url()) === "/dang-nhap", g.url());

  for (const w of [1280, 390]) {
    const p = await (await ctxFor(S, { width: w, height: 800 })).newPage();
    await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
    check(`${w}px học sinh mở '/' → Lớp /student/hoc-tap`, path(p.url()) === "/student/hoc-tap", p.url());
    const seen = p.locator('text="Lịch Sử - Tổng Ôn" >> visible=true').first();
    await seen.waitFor({ timeout: 60000 }).catch(() => {});
    check(`${w}px trang Lớp hiện lớp của em`, await seen.isVisible());
    check(`${w}px vỏ học sinh không còn liên kết 'Trang chủ KiN'`, (await p.getByRole("link", { name: "Trang chủ KiN" }).count()) === 0);
  }

  const t = await (await ctxFor(T, { width: 1280, height: 800 })).newPage();
  await t.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  const tutorHome = landingPath("admin", "teacher");
  check(`gia sư mở '/' → ${tutorHome}`, path(t.url()) === tutorHome, t.url());

  section("Đăng nhập xong vào Lớp");
  const lg = await (await ctxFor(S, { width: 1280, height: 800 })).newPage();
  await lg.goto(`${BASE}/dang-nhap`, { waitUntil: "domcontentloaded", timeout: 120000 });
  check("học sinh đã đăng nhập mở /dang-nhap → Lớp", path(lg.url()) === "/student/hoc-tap", lg.url());

  await closeAll();
  await done();
})();
