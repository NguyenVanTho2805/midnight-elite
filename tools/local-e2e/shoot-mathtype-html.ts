// Công cụ chụp (không phải test): dựng trang HTML so sánh KaTeX (từ LaTeX KiN giải) | ảnh WMF→SVG (KiN vẽ) | [ảnh gốc nếu có PNG] từ picked.json.
// Chạy: npx tsx tools/local-e2e/shoot-mathtype-html.ts <picked.json> <ra.html> [thư-mục-png-gốc]
import fs from "node:fs";
import path from "node:path";
import katex from "katex";
const [picked, out, orig] = process.argv.slice(2);
const items: any[] = JSON.parse(fs.readFileSync(picked, "utf8"));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const css = path.resolve("node_modules/katex/dist/katex.min.css");
const rows = items.map((f, i) => {
  let k = ""; try { k = katex.renderToString(f.latex, { throwOnError: true }); } catch (e) { k = `<span class="err">KaTeX lỗi: ${esc(String(e).slice(0, 80))}</span>`; }
  const png = orig && fs.existsSync(path.join(orig, `${i + 1}.png`)) ? `<img class="orig" src="file://${path.resolve(orig, `${i + 1}.png`)}">` : "";
  return `<tr><td class="n">${i + 1}<br><small>${esc(f.cat)}${f.unverified ? "<br><b>chưa kiểm</b>" : ""}</small></td><td class="c"><div class="k">${k}</div><code>${esc(f.latex)}</code></td><td class="c"><div class="s">${f.svg}</div></td>${orig ? `<td class="c">${png || "<small>(không có)</small>"}</td>` : ""}</tr>`;
}).join("\n");
fs.writeFileSync(out, `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="file://${css}"><style>
body{font:14px system-ui;margin:16px;background:#fff;color:#111}table{border-collapse:collapse;width:100%;table-layout:fixed}.k,.s{overflow-x:auto}th,td{border:1px solid #bbb;padding:8px;vertical-align:middle}
th{background:#eee}td.n{width:70px;font-weight:700}td.c{width:${orig ? "30%" : "42%"}}.k{font-size:22px}.s svg{zoom:1.7;display:block}code{display:block;font:10px monospace;color:#555;margin-top:6px;word-break:break-all}.err{color:#b00}.orig{max-width:100%;max-height:110px}small{font-weight:400}
</style><h3>So sánh ${items.length} công thức: KaTeX từ LaTeX KiN giải | ảnh WMF→SVG do KiN vẽ${orig ? " | ảnh gốc (Word vẽ)" : ""}</h3>
<table><tr><th>#</th><th>KaTeX (LaTeX KiN giải)</th><th>SVG (WMF→SVG KiN vẽ)</th>${orig ? "<th>Gốc (Word)</th>" : ""}</tr>${rows}</table>`);
console.log("ok", items.length);
