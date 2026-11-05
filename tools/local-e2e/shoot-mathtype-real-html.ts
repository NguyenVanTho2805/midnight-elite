// Công cụ chụp (không phải test; đầu ra KHÔNG đưa vào git): dựng các trang so sánh từ JSON của shoot-mathtype-real.ts rồi chụp 1280 và 390 bằng Chrome.
// Cột: KaTeX (LaTeX KiN giải) | ảnh WMF vẽ lại (SVG) | TeX gốc nếu có (KaTeX + chữ) | OMML nếu có. KHÔNG có cột "ảnh gốc Word" (tệp không chứa PNG của công thức, chỉ WMF).
// Chạy: CHROMIUM_PATH=… npx tsx tools/local-e2e/shoot-mathtype-real-html.ts <real-dir> <ra-dir>
import fs from "node:fs";
import path from "node:path";
import katex from "katex";
import { chromium } from "playwright";
const [realDir, outDir] = process.argv.slice(2); fs.mkdirSync(outDir, { recursive: true });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const css = path.resolve("node_modules/katex/dist/katex.min.css");
const kx = (l: string) => { try { return katex.renderToString(l, { throwOnError: true }); } catch (e) { return `<span class="err">KaTeX lỗi</span>`; } };
type It = { i: number; q: string; status: string; latex: string; guess: string; fail: string; svg: string | null; tex: string | null; omml: string | null };
const load = (n: string): It[] => JSON.parse(fs.readFileSync(path.join(realDir, n + ".json"), "utf8")).items;
const row = (tag: string, f: It) => `<tr><td class="n">${tag}#${f.i}<br><small>${esc(f.q)}<br><b>${f.status}</b>${f.fail ? "<br>" + esc(f.fail) : ""}</small></td>
<td class="c"><div class="k">${f.latex ? kx(f.latex) : f.guess ? "<small>(đoán, chưa kiểm)</small> " + kx(f.guess) : "—"}</div><code>${esc(f.latex || f.guess)}</code></td>
<td class="c"><div class="s">${f.svg ?? "<small>(không có ảnh)</small>"}</div></td>
<td class="c">${f.tex ? `<div class="k">${kx(f.tex)}</div><code>${esc(f.tex)}</code>` : "<small>—</small>"}${f.omml ? `<code>OMML: ${esc(f.omml)}</code>` : ""}</td></tr>`;
const page = (title: string, rows: string) => `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="file://${css}"><style>
body{font:13px system-ui;margin:10px;background:#fff;color:#111}table{border-collapse:collapse;width:100%;table-layout:fixed}.k,.s{overflow-x:auto}th,td{border:1px solid #bbb;padding:6px;vertical-align:middle;word-break:break-all}
th{background:#eee}td.n{width:78px;font-weight:700}.k{font-size:20px}.s svg{width:100%;height:auto;max-height:260px;display:block}code{display:block;font:9px monospace;color:#555;margin-top:4px}.err{color:#b00}small{font-weight:400}
@media(max-width:600px){td.n{width:54px}.k{font-size:16px}.s svg{width:100%}}
</style><h4>${title}</h4><table><tr><th>#</th><th>KaTeX (LaTeX KiN giải)</th><th>WMF→SVG (KiN vẽ từ ảnh xem trước của Word)</th><th>TeX gốc / OMML</th></tr>${rows}</table>`;
const skeleton = (l: string) => l.replace(/\\(left|right)/g, "").replace(/[A-Za-z0-9]+/g, m => (/^(frac|dfrac|sqrt|int|limits|lim|ln|log|sin|cos|tan|begin|end|array|text|infty|pi|cdot|Rightarrow|Leftrightarrow|leq|geq|neq|in|cup|cap|overrightarrow|vec|overline|mathbb|sum|prime|perp|forall|approx|times|subset)$/.test(m) ? m : "a"));
const cx = (l: string) => (l.match(/\\(frac|sqrt|int|lim|begin|overrightarrow|overline|sum|Rightarrow|Leftrightarrow|cup|cap|subset|mathbb|log|ln|sin|cos|tan)|\^|_|\\left/g) ?? []).length;
(async () => {
  const D = { de1: load("de1"), de2: load("de2") };
  const all = (["de1", "de2"] as const).flatMap(k => D[k].map(f => ({ k, f })));
  const pages: Record<string, string> = {};
  pages["susp"] = page("Công thức không ra LaTeX (ảnh dự phòng / nhãn / OMML)", all.filter(x => x.f.status !== "latex").map(x => row(x.k, x.f)).join(""));
  pages["tex"] = page("Công thức có TeX gốc (TeX Input Language)", all.filter(x => x.f.tex).map(x => row(x.k, x.f)).join(""));
  // mẫu theo bộ khung (mỗi khung 1 đại diện), xếp theo độ phức tạp giảm dần, 14 hàng/trang
  const seen = new Set<string>(); const reps: typeof all = [];
  const reach = (x: (typeof all)[number]) => !x.f.q.startsWith("LG·");
  all.sort((a, b) => Number(reach(b)) - Number(reach(a)));
  for (const x of all.filter(y => y.f.status === "latex" && y.f.svg && reach(y))) { const s = skeleton(x.f.latex); if (seen.has(s)) continue; seen.add(s); reps.push(x); }
  const nReach = reps.length; for (const x of all.filter(y => y.f.status === "latex" && y.f.svg && !reach(y))) { const s = skeleton(x.f.latex); if (seen.has(s)) continue; seen.add(s); reps.push(x); }
  const byC = (a: (typeof all)[number], b: (typeof all)[number]) => cx(b.f.latex) - cx(a.f.latex) || a.f.latex.length - b.f.latex.length;
  const head = reps.slice(0, nReach).sort(byC), tail = reps.slice(nReach).sort(byC); reps.length = 0; reps.push(...head, ...tail); console.log("reach skeletons", nReach);
  if (process.env.GREP) { const re = new RegExp(process.env.GREP), sk = new Set<string>(); const sel = all.filter(y => y.f.status === "latex" && y.f.svg && re.test(y.f.latex)).filter(y => { const k = skeleton(y.f.latex); if (sk.has(k)) return false; sk.add(k); return true; }).slice(0, Number(process.env.MAXN ?? 12)); pages["grep"] = page("Lọc: " + esc(process.env.GREP), sel.map(x => row(x.k, x.f)).join("")); }
  const PER = Number(process.env.PER ?? 14);
  for (let p = 0; p * PER < reps.length; p++) pages["mau" + String(p + 1).padStart(2, "0")] = page(`Mẫu theo khung #${p * PER + 1}–${Math.min(reps.length, (p + 1) * PER)}/${reps.length}`, reps.slice(p * PER, (p + 1) * PER).map(x => row(x.k, x.f)).join(""));
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
  const br = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  for (const [name, html] of Object.entries(pages)) {
    fs.writeFileSync(path.join(outDir, name + ".html"), html);
    if (only && !only.has(name)) continue;
    for (const w of [1280, 390]) { const c = await br.newContext({ viewport: { width: w, height: 900 } }); const pg = await c.newPage(); await pg.goto("file://" + path.resolve(outDir, name + ".html")); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(outDir, `${name}-${w}.png`), fullPage: true }); await c.close(); }
  }
  await br.close(); console.log("pages", Object.keys(pages).length, "reps", reps.length);
})();
