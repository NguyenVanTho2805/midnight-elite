// Đo khung xương so với nội dung thật (không nhảy bố cục): chặn API 4 giây, đo vị trí khối đầu tiên, rồi đo lại sau khi tải xong.
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, closeAll } from "./ui";
import { BASE } from "./h";
(async () => {
  const T = await prisma.user.findUnique({ where: { email: "giasu@kin.local" } });
  await launch();
  for (const w of [1440, 390]) {
    const ctx = await ctxFor({ id: T!.id, role: T!.role, adminRole: T!.adminRole } as any, { width: w, height: 900 });
    await ctx.addInitScript("window.__name=function(f){return f}");
    for (const [name, path, api] of [["hop-viec", "/lop-cua-toi", "/api/tutor/hop-viec"], ["lop", "/lop-cua-toi/lop", "/api/tutor/lop"], ["hoc-sinh", "/lop-cua-toi/hoc-sinh", "/api/tutor/hoc-sinh"]] as const) {
      const p = await ctx.newPage();
      await p.route(`**${api}*`, async r => { await new Promise(res => setTimeout(res, 4000)); await r.continue(); });
      await p.goto(BASE + path, { waitUntil: "domcontentloaded" });
      await p.waitForSelector("[data-kin-page-header]", { timeout: 60000 });
      await p.waitForSelector("[aria-busy=true]", { timeout: 60000 });
      const probe = () => p.evaluate(() => {
        const r = (e: Element | null) => { if (!e) return null; const b = e.getBoundingClientRect(); return `${Math.round(b.left)},${Math.round(b.top + scrollY)} ${Math.round(b.width)}x${Math.round(b.height)}`; };
        const root = document.querySelector("[data-kin-page]")!;
        const sk = root.querySelectorAll(".kin-skel");
        const first = [...root.children].find(c => c.matches("[aria-busy=true]") || c.querySelector(".kin-skel") === null ? false : true) ?? null;
        return { h1: r(root.querySelector("h1")), firstBlock: r([...root.children].filter(c => !c.matches("header"))[0] ?? null), firstSkelOrStat: r(sk[0] ?? root.querySelector("[data-kin-stat-row], [aria-label='Tìm và lọc lớp'], label")), pageH: Math.round(document.documentElement.scrollHeight), nSkel: sk.length };
      });
      const a = await probe();
      await p.waitForSelector("[aria-busy=true]", { state: "detached", timeout: 60000 });
      await p.waitForTimeout(500);
      const b = await probe();
      console.log(w, name.padEnd(9), "skeleton:", JSON.stringify(a), "\n              real:    ", JSON.stringify(b));
      await p.close();
    }
    await ctx.close();
  }
  await closeAll();
})();
