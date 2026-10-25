// Chụp các màn học sinh (Việc của tôi, Lịch học, Lớp của tôi, Bài tập & đề thi) ở 1440 và 390 để đối chiếu Figma. Cần dữ liệu từ mock-seed.
import { launch, ctxFor, closeAll } from "./ui";
import { BASE } from "./h";
import { prisma } from "@/lib/prisma";
const TAG = process.argv[2] ?? "hs";
(async () => {
  const S = await prisma.user.findUniqueOrThrow({ where: { email: "hocsinh@kin.local" } });
  const course = await prisma.enrollment.findFirst({ where: { userId: S.id, status: "active" }, select: { courseId: true } });
  await launch();
  const pages: [string, string][] = [["viec", "/student/viec-cua-toi"], ["lich", "/student/lich-hoc"], ["lop", `/student/hoc-tap${course ? `?course=${course.courseId}` : ""}`], ["bai-tap", "/student/bai-tap"]];
  for (const [name, w, h] of [["desktop", 1440, 960], ["mobile", 390, 844]] as const) {
    const c = await ctxFor({ id: S.id, role: S.role, adminRole: S.adminRole } as never, { width: w, height: h });
    for (const [label, path] of pages) {
      const p = await c.newPage();
      await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 120000 });
      await p.waitForFunction(() => !document.querySelector("[aria-busy=true]"), undefined, { timeout: 90000 }).catch(() => {});
      await p.waitForTimeout(600);
      await p.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast] { display: none !important; }" });
      await p.screenshot({ path: `scratchpad/shots/${TAG}-${label}-${name}.png`, fullPage: true });
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(label, name, "tràn ngang:", over);
      await p.close();
    }
    await c.close();
  }
  await closeAll();
})().catch(e => { console.error(e); process.exit(1); });
