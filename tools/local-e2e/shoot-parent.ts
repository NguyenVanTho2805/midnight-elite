// Chụp trang phụ huynh (/so-cua-con, /phieu) ở 390 và 1280 để đối chiếu Figma 299:115140 / 299:116806. Dùng token của mock (student-world).
import { BASE } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { TOKENS } from "./student-world";
const TAG = process.argv[2] ?? "ph";
(async () => {
  await launch();
  for (const [name, w, h] of [["desktop", 1280, 900], ["mobile", 390, 800]] as const) {
    const c = await ctxFor(null, { width: w, height: h });
    for (const [label, url] of [["so-cua-con", `${BASE}/so-cua-con/${TOKENS.portal}`], ["phieu", `${BASE}/phieu/${TOKENS.invoice}`]] as const) {
      const p = await c.newPage();
      await p.goto(url, { waitUntil: "networkidle", timeout: 120000 });
      await p.waitForTimeout(800);
      await p.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast] { display: none !important; }" });
      await p.screenshot({ path: `scratchpad/shots/${TAG}-${label}-${name}.png`, fullPage: true });
      console.log(label, name, "overflow:", await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1));
      await p.close();
    }
  }
  await closeAll();
})().catch(e => { console.error(e); process.exit(1); });
