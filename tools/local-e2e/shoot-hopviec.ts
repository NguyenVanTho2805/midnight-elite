// Chụp Hộp việc của gia sư giasu@kin.local (sau mock-seed) ở 1440 và 390 để đối chiếu Figma 299:111821 / 299:116033. Ảnh: scratchpad/shots/hopviec-*.png
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { BASE } from "./h";
(async () => {
  const T = await prisma.user.findUniqueOrThrow({ where: { email: "giasu@kin.local" } });
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  await launch();
  for (const [name, w, h] of [["desktop", 1440, 1104], ["mobile", 390, 844]] as const) {
    const c = await ctxFor(T, { width: w, height: h });
    const p = await c.newPage();
    await p.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
    await p.getByRole("heading", { name: "Hộp việc", level: 1 }).waitFor({ timeout: 90000 });
    await p.getByText("Buổi học sắp tới").waitFor({ timeout: 90000 });
    await p.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-agentation-root] { display: none !important; }" });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${process.env.SHOTS ?? "scratchpad/shots"}/hopviec-${name}.png`, fullPage: true });
    console.log(name, "scrollWidth", await p.evaluate("document.documentElement.scrollWidth"), "innerWidth", w);
    await c.close();
  }
  await closeAll();
})().catch(e => { console.error(e); process.exit(1); });
