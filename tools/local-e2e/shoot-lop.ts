// Chụp ba màn "Lớp" của gia sư giasu@kin.local (sau mock-seed) ở 1440 và 390 để đối chiếu Figma 299:112349 / 299:112581 / 299:112849. Ảnh: scratchpad/shots/lop-*.png
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { BASE } from "./h";
(async () => {
  const T = await prisma.user.findUniqueOrThrow({ where: { email: "giasu@kin.local" } });
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  const course = await prisma.course.findFirstOrThrow({ where: { ownerId: T.id }, orderBy: { createdAt: "asc" } });
  await launch();
  for (const [name, w, h] of [["desktop", 1440, 1104], ["mobile", 390, 844]] as const) {
    const c = await ctxFor(T, { width: w, height: h });
    const p = await c.newPage();
    const shots: [string, string, string][] = [
      ["lop", "/lop-cua-toi/lop", "Lớp học"], ["chi-tiet", `/lop-cua-toi/${course.id}`, course.name], ["tao", "/lop-cua-toi/lop/tao", "Tạo lớp học"],
    ];
    for (const [label, path, h1] of shots) {
      await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
      await p.getByRole("heading", { name: h1, level: 1 }).waitFor({ timeout: 90000 });
      await p.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 90000 });
      await p.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-agentation-root] { display: none !important; }" });
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${process.env.SHOTS ?? "scratchpad/shots"}/lop-${label}-${name}.png`, fullPage: true });
      console.log(name, label, "scrollWidth", await p.evaluate("document.documentElement.scrollWidth"), "innerWidth", w);
    }
    await c.close();
  }
  await closeAll();
})().catch(e => { console.error(e); process.exit(1); });
