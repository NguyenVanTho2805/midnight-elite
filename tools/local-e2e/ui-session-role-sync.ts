// NC2-029c — luồng trình duyệt: gia sư chờ duyệt đang mở trang → quản trị duyệt (API) → gia sư TẢI LẠI → vào khung gia sư, KHÔNG đăng nhập lại.
import { api, BASE, mkSuper, mkUser, wipe, check, section, done, cookieFor } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const sup = await mkSuper("Quản trị 1");
  const A = await mkUser({ name: "Gia sư Chờ Duyệt", emailVerified: true });
  await prisma.user.update({ where: { id: A.id }, data: { tutorAppliedAt: new Date(), bio: "Dạy Toán 9 ba năm. ".repeat(12), subjects: ["Toán"], city: "Hà Nội" } });
  await launch();
  const errors: string[] = [];
  const ctx = await ctxFor(A, { width: 1280, height: 800 }); // cookie = phiên 'student' (như lúc vừa đăng ký/đăng nhập)
  const pg = await ctx.newPage();
  pg.on("pageerror", e => errors.push(String(e)));
  const RAIL = "Module của gia sư";
  const rail = pg.getByRole("navigation", { name: RAIL });
  const sessionCookie = async () => (await ctx.cookies(BASE)).find(c => c.name === "midnight_session")?.value ?? "";
  const roleOf = (jwt: string) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()) as { role: string; adminRole?: string; iat: number };

  section("Trước khi duyệt: chưa có khung gia sư");
  await pg.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  const iat0 = roleOf(await sessionCookie()).iat;
  check("chưa duyệt: không thấy thanh module gia sư", (await rail.count()) === 0);
  check("cookie đang là student", roleOf(await sessionCookie()).role === "student");

  section("Quản trị duyệt (API) — gia sư KHÔNG đăng nhập lại");
  const ap = await api("POST", `/api/admin/tutor-applications/${A.id}/approve`, { as: sup });
  check("duyệt 200", ap.status === 200, ap.status);
  await pg.reload({ waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForTimeout(1500);
  const afterFirst = roleOf(await sessionCookie());
  check("sau tải lại: cookie đã đổi sang admin/teacher, iat giữ nguyên", afterFirst.role === "admin" && afterFirst.adminRole === "teacher" && afterFirst.iat === iat0, afterFirst);
  const railFirst = await rail.count();
  console.log(`  (thông tin) thanh gia sư sau tải lại LẦN 1: ${railFirst ? "có" : "chưa"}`);
  check("sau TẢI LẠI một lần: vào được khung gia sư (thanh module gia sư hiện)", railFirst === 1);
  check("vẫn trong /lop-cua-toi (gia sư vào Lịch), không bị đẩy sang trang đăng nhập", new URL(pg.url()).pathname.startsWith("/lop-cua-toi"), pg.url());
  check("không lỗi script trang", errors.length === 0, errors);
  void cookieFor;
  await closeAll();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
