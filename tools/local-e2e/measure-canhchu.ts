// Đo cỡ chữ / lề / khoảng cách các màn gia sư bằng getComputedStyle (công cụ rà soát căn chỉnh, không phải test).
import { prisma } from "@/lib/prisma";
import { cookieFor, BASE } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { writeFileSync } from "fs";
const TAG = process.argv[2] ?? "truoc";
const ONLY = process.argv[3];
(async () => {
  const T = await prisma.user.findUnique({ where: { email: "giasu@kin.local" } });
  const c = await prisma.course.findFirst({ where: { ownerId: T!.id, enrollments: { some: {} } }, orderBy: { createdAt: "asc" } });
  const tu = { id: T!.id, role: T!.role, adminRole: T!.adminRole } as any;
  const pages: [string, string][] = [
    ["hop-viec", "/lop-cua-toi"], ["lich", "/lop-cua-toi/lich"], ["lop", "/lop-cua-toi/lop"], ["tao-lop", "/lop-cua-toi/lop/tao"],
    ["chi-tiet", `/lop-cua-toi/${c!.id}`], ["diem-danh-tab", `/lop-cua-toi/${c!.id}?tab=diem-danh`], ["hoc-sinh", "/lop-cua-toi/hoc-sinh"], ["bai-tap", "/lop-cua-toi/bai-tap"],
    ["thu-vien", "/thu-vien"], ["diem-danh", `/admin/khoa-hoc/${c!.id}/diem-danh`], ["hoc-phi", "/lop-cua-toi/hoc-phi"], ["cai-dat", "/lop-cua-toi/cai-dat"],
  ].filter(([n]) => !ONLY || ONLY.split(",").includes(n)) as any;
  await launch();
  const out: any = {};
  for (const w of [1440, 1024, 390]) {
    const ctx = await ctxFor(tu, { width: w, height: 900 }); await ctx.addInitScript("window.__name=function(f){return f}");
    for (const [name, path] of pages) {
      const p = await ctx.newPage();
      await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 120000 }).catch(() => {});
      await p.waitForTimeout(1500);
      await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" });
      const m = await p.evaluate(() => {
        const cs = (e: Element) => getComputedStyle(e);
        const r = (e: Element) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
        const h1 = document.querySelector("main h1, h1");
        const o: any = { overflow: document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth : 0 };
        let root: Element = document.body;
        if (h1) {
          const s = cs(h1); o.h1 = { txt: h1.textContent?.slice(0, 30), fs: s.fontSize, fw: s.fontWeight, lh: s.lineHeight, ff: s.fontFamily.split(",")[0], ...r(h1) };
          const hdr = h1.closest("header") ?? h1.parentElement!.parentElement!;
          root = h1.closest("[data-kin-page]") ?? hdr.parentElement!;
          const sub = h1.nextElementSibling ?? h1.parentElement!.querySelector("p");
          if (sub) { const ss = cs(sub); o.sub = { fs: ss.fontSize, fw: ss.fontWeight, lh: ss.lineHeight, gap: Math.round(sub.getBoundingClientRect().top - h1.getBoundingClientRect().bottom) }; o.subBottomToHdr = Math.round(hdr.getBoundingClientRect().bottom - sub.getBoundingClientRect().bottom); }
          o.pagePad = { pl: cs(root).paddingLeft, pt: cs(root).paddingTop, rootL: Math.round(root.getBoundingClientRect().left), rootW: Math.round(root.getBoundingClientRect().width) };
          const nx = hdr.nextElementSibling; if (nx) o.afterHdr = Math.round(nx.getBoundingClientRect().top - hdr.getBoundingClientRect().bottom);
        }
        o.h2 = [...root.querySelectorAll("h2")].filter(e => (e as HTMLElement).offsetParent).slice(0, 8).map(e => { const s = cs(e); return `${e.textContent?.slice(0, 16)}|${s.fontSize}|${s.fontWeight}|${s.lineHeight}|l${Math.round(e.getBoundingClientRect().left)}`; });
        const cnt: Record<string, number> = {};
        const wk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n; (n = wk.nextNode());) { if (!n.textContent?.trim()) continue; const pe = n.parentElement!; if (!pe.offsetParent && cs(pe).position !== "fixed") continue; const k = `${cs(pe).fontSize}/${cs(pe).fontWeight}`; cnt[k] = (cnt[k] ?? 0) + 1; }
        o.sizes = cnt;
        const navy = "rgb(30, 58, 138)";
        const prim = [...root.querySelectorAll("a, button")].filter(e => cs(e).backgroundColor === navy && (e as HTMLElement).offsetParent && e.getBoundingClientRect().height > 30).slice(0, 2);
        o.btn = prim.map(e => ({ txt: e.textContent?.slice(0, 16), ...r(e), fs: cs(e).fontSize }));
        const g = [...root.querySelectorAll("*")].filter(e => /354px/.test(cs(e).gridTemplateColumns))[0];
        o.col354 = g ? cs(g).gridTemplateColumns : null; o.gap = g ? cs(g).columnGap : null;
        const tr = [...root.querySelectorAll("[data-kin-list-row], ul[aria-label] > li")].filter(e => (e as HTMLElement).offsetParent).slice(0, 5).map(e => Math.round(e.getBoundingClientRect().height));
        o.rowH = tr;
        o.skel = root.querySelectorAll(".kin-skel").length;
        return o;
      });
      out[`${name}@${w}`] = m;
      if (!ONLY || ONLY.includes("shot")) await p.screenshot({ path: `scratchpad/shots/${TAG}-${name}-${w}.png`, fullPage: false });
      await p.close();
    }
    await ctx.close();
  }
  await closeAll();
  writeFileSync(`scratchpad/measure-${TAG}.json`, JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries<any>(out)) console.log(k.padEnd(20), "H1", v.h1 ? `${v.h1.fs}/${v.h1.fw}/${v.h1.lh} ${v.h1.ff} l${v.h1.l} t${v.h1.t}` : "-", "| sub", v.sub ? `${v.sub.fs} gap${v.sub.gap}` : "-", "| pad", v.pagePad?.pl, v.pagePad?.pt, "| afterHdr", v.afterHdr, "| ovf", v.overflow, "| 354:", v.col354 ? v.col354 + " gap " + v.gap : "n", "| btn", JSON.stringify(v.btn?.map((b: any) => `${b.w}x${b.h}@${b.l},${b.t}`)), "| rows", JSON.stringify(v.rowH));
})().catch(e => { console.error(e); process.exit(1); });
