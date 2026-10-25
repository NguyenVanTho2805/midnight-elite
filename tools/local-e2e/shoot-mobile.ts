// Chụp Hộp việc và Điểm danh ở 390px bằng dữ liệu mock-seed (giasu@kin.local). Dùng: npx tsx tools/local-e2e/shoot-mobile.ts <nhãn>
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, closeAll } from "./ui";
const TAG = process.argv[2] ?? "x";
(async () => {
  const u = await prisma.user.findUniqueOrThrow({ where: { email: "giasu@kin.local" } });
  const sess = await prisma.attendanceSession.findFirstOrThrow({ where: { course: { ownerId: u.id }, records: { some: {} } }, orderBy: { date: "desc" }, include: { course: true } });
  const course = sess.course; const dkey = sess.date.toISOString().slice(0, 10);
  await launch();
  const T = { id: u.id, role: u.role as "admin", adminRole: u.adminRole as "teacher", email: u.email, name: u.name };
  for (const [w, h] of [[390, 800], [1440, 900]] as const) {
    const ctx = await ctxFor(T, { width: w, height: h });
    for (const [label, url] of [["hop-viec", "/lop-cua-toi"], ["diem-danh", `/admin/khoa-hoc/${course.id}/diem-danh?date=${dkey}`]] as const) {
      const p = await ctx.newPage();
      await p.goto((process.env.BASE ?? "http://localhost:3481") + url, { waitUntil: "networkidle", timeout: 180000 });
      await p.waitForTimeout(2500);
      await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" });
      await p.screenshot({ path: `scratchpad/shots/${TAG}-${label}-${w}.png`, fullPage: true });
      console.log(label, w, "scrollW", await p.evaluate(() => document.documentElement.scrollWidth));
      await p.close();
    }
    await ctx.close();
  }
  await closeAll(); await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
