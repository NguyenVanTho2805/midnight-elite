// Công cụ kiểm (không phải test): đối chiếu MỨC CHỈ SỐ — mỗi chữ/số trong LaTeX KiN giải nằm ở cỡ thường hay cỡ chỉ số (trong ^{} _{} hoặc cận tích phân/lim) có khớp với cỡ chữ
// của cùng ký tự trong SVG vẽ từ ảnh WMF của Word không. Bắt lỗi "mũ thành chỉ số dưới / chỉ số thành chữ thường / nhầm nhóm" mà phép đếm ký tự không thấy.
// Chạy: npx tsx tools/local-e2e/shoot-mathtype-script.ts <real.json>
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const GREEK: Record<string, string> = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ", phi: "φ", varphi: "φ", omega: "ω", Delta: "Δ", varepsilon: "ε", epsilon: "ε" };
const FN = ["sin", "cos", "tan", "cot", "log", "ln", "lim", "max", "min", "exp"];
// Đi qua LaTeX, trả [ký tự, cấp chỉ số (0 thường, 1 trở lên chỉ số)]
function walk(s: string): [string, number][] {
  const out: [string, number][] = []; let i = 0;
  function atom(lvl: number) { // một nhóm {…} hoặc một token
    while (s[i] === " ") i++;
    if (s[i] === "{") { i++; seq(lvl, true); return; }
    if (s[i] === "\\") { const m = /^\\([A-Za-z]+)/.exec(s.slice(i)); if (m) { const n = m[1]; i += m[0].length; cmd(n, lvl); } else i += 2; return; }
    if (i < s.length) { out.push([s[i], lvl]); i++; }
  }
  function cmd(n: string, lvl: number) {
    if (FN.includes(n)) { for (const c of n) out.push([c, lvl]); return; }
    if (GREEK[n]) { out.push([GREEK[n], lvl]); return; }
    if (n === "frac" || n === "dfrac") { atom(lvl); atom(lvl); return; }
    if (n === "sqrt") { while (s[i] === " ") i++; if (s[i] === "[") { const j = s.indexOf("]", i); for (const c of s.slice(i + 1, j)) out.push([c, lvl + 1]); i = j + 1; } atom(lvl); return; }
    if (n === "text" || n === "mathrm" || n === "mathbf" || n === "operatorname") { atom(lvl); return; }
    if (n === "overrightarrow" || n === "overline" || n === "vec" || n === "hat" || n === "widehat" || n === "bar") { atom(lvl); return; }
    if (n === "mathbb") { const mm = /^\{(\w)\}/.exec(s.slice(i)); if (mm) { out.push([({ R: "ℝ", Z: "ℤ", N: "ℕ", Q: "ℚ", C: "ℂ" } as Record<string, string>)[mm[1]] ?? mm[1], lvl]); i += mm[0].length; } return; }
    if (n === "overset" || n === "stackrel") { atom(lvl + 1); atom(lvl); return; }
    if (n === "begin") { const m = /^\{[^}]*\}(\{[^}]*\})?/.exec(s.slice(i)); if (m) i += m[0].length; return; }
    if (n === "end") { const m = /^\{[^}]*\}/.exec(s.slice(i)); if (m) i += m[0].length; return; }
    if (n === "left" || n === "right") { while (s[i] === " ") i++; if (s[i] === "\\") i += 2; else i++; return; }
    /* ký hiệu khác: bỏ */
  }
  function seq(lvl: number, inGroup: boolean) {
    while (i < s.length) {
      const c = s[i];
      if (c === "}") { if (inGroup) { i++; return; } i++; continue; }
      if (c === "{") { i++; seq(lvl, true); continue; }
      if (c === "^" || c === "_") { i++; atom(lvl + 1); continue; }
      if (c === "\\") { const m = /^\\([A-Za-z]+)/.exec(s.slice(i)); if (m) { const n = m[1]; i += m[0].length; cmd(n, lvl); } else i += 2; continue; }
      if (c === "&" || c === " " || c === "$") { i++; continue; }
      out.push([c, lvl]); i++;
    }
  }
  seq(0, false); return out;
}
function svgChars(svg: string): [string, number][] {
  const items: { ch: string; size: number }[] = [];
  for (const t of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const fs_ = Number(/font-size="([\d.]+)"/.exec(t[1])?.[1] ?? 0);
    for (const sp of t[2].matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)) for (const ch of sp[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")) items.push({ ch, size: fs_ });
  }
  const al = items.filter(x => /[\p{L}\p{N}]/u.test(x.ch));
  const base = Math.max(0, ...al.map(x => x.size));
  return al.map(x => [x.ch, x.size < base * 0.8 ? 1 : 0]);
}
const key = (a: [string, number][]) => { const m = new Map<string, number>(); for (const [c, l] of a) { if (!/[\p{L}\p{N}]/u.test(c)) continue; const k = c + (l > 0 ? "'" : ""); m.set(k, (m.get(k) ?? 0) + 1); } return m; };
let checked = 0; const flags: string[] = [];
for (const it of d.items) {
  if (!it.svg || it.status !== "latex") continue; checked++;
  const a = key(walk(it.latex)), b = key(svgChars(it.svg)); const diff: string[] = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) if ((a.get(k) ?? 0) !== (b.get(k) ?? 0)) diff.push(`${k}:${a.get(k) ?? 0}≠${b.get(k) ?? 0}`);
  if (diff.length) flags.push(`${it.i} ${it.q} | ${it.latex} | ${diff.join(" ")}`);
}
console.log(JSON.stringify({ checked, flagged: flags.length })); flags.forEach(f => console.log(f));
