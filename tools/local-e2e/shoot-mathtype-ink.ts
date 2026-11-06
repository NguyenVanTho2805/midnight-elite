// Công cụ kiểm (không phải test, không ghi nội dung đề ra repo): đối chiếu "mực" — đa tập ký tự chữ/số/ký hiệu trong LaTeX KiN giải với ký tự trong SVG vẽ từ ảnh WMF của Word.
// Hai nguồn độc lập (MTEF trong .bin vs bản vẽ xem trước của Word). Lệch đa tập = nghi sai → in ra để xem bằng mắt.
// Chạy: npx tsx tools/local-e2e/shoot-mathtype-ink.ts <real.json> [ra-flag.json]
import fs from "node:fs";
const [inp, outp] = process.argv.slice(2);
const GREEK: Record<string, string> = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", theta: "θ", vartheta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varphi: "φ", omega: "ω", Delta: "Δ", Omega: "Ω", Pi: "Π", Sigma: "Σ", Phi: "Φ", Gamma: "Γ", Lambda: "Λ", eta: "η", kappa: "κ", nu: "ν", xi: "ξ", chi: "χ", psi: "ψ", zeta: "ζ" };
const SYM: Record<string, string> = { infty: "∞", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", in: "∈", pm: "±", cdot: "⋅", times: "×", perp: "⊥", parallel: "∥", approx: "≈", cup: "∪", cap: "∩", subset: "⊂", notin: "∉", to: "→", rightarrow: "→", Rightarrow: "⇒", Leftrightarrow: "⇔", angle: "∠", circ: "∘", degree: "°", prime: "'", dots: "…", ldots: "…", cdots: "…" };
const FN = ["sin", "cos", "tan", "cot", "log", "ln", "lim", "max", "min", "exp", "det", "sup", "inf", "arcsin", "arccos", "arctan", "sec", "csc"];
const SKIP = new Set(["left", "right", "frac", "dfrac", "sqrt", "begin", "end", "limits", "nolimits", "displaystyle", "int", "sum", "prod", "overrightarrow", "overline", "vec", "hat", "bar", "widehat", "text", "mathrm", "mathbb", "mathbf", "operatorname", "overset", "underset", "stackrel", "array", "quad", "qquad", "big", "Big", "mid", "bigg"]);
function inkOfLatex(s: string): string[] {
  const out: string[] = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      const m = /^\\([A-Za-z]+)/.exec(s.slice(i)); if (!m) { const n = s[i + 1]; if (n === "{" || n === "}" || n === "|") out.push(n === "|" ? "|" : ""); i += 2; continue; }
      const n = m[1]; i += m[0].length;
      if (FN.includes(n)) { out.push(...n.split("")); continue; }
      if (GREEK[n]) { out.push(GREEK[n]); continue; }
      if (SYM[n]) { out.push(SYM[n]); continue; }
      if (n === "mathbb") { const mm = /^\{(\w)\}/.exec(s.slice(i)); if (mm) { out.push({ R: "ℝ", Z: "ℤ", N: "ℕ", Q: "ℚ", C: "ℂ" }[mm[1] as "R"] ?? mm[1]); i += mm[0].length; } continue; }
      if (n === "begin" || n === "end") { const mm = /^\{[^}]*\}(\{[^}]*\})?/.exec(s.slice(i)); if (mm) i += mm[0].length; continue; }
      if (n === "left" || n === "right") { const nx = s[i] === " " ? s[++i] : s[i]; if (nx === "\\") { /* \{ \} \| */ const k = s[i + 1]; out.push(k === "|" ? "|" : ""); i += 2; } else if (nx && nx !== ".") { out.push(nx === "[" || nx === "]" || nx === "(" || nx === ")" || nx === "|" ? nx : ""); i++; } else i++; continue; }
      continue;
    }
    if ("{}^_&$ ".includes(c)) { i++; continue; }
    out.push(c === "-" ? "−" : c === "′" ? "'" : c); i++;
  }
  return out;
}
function inkOfSvg(svg: string): string[] {
  const out: string[] = [];
  for (const m of svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)) for (const ch of m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").normalize("NFC")) out.push(ch === "-" ? "−" : ch === "′" || ch === "’" ? "'" : ch);
  return out;
}
const KEEP = /[\p{L}\p{N}=+<>≤≥≠∞∈π±′'×⋅∪∩∠∥⊥≈→⇒⇔−,;.|∘°…]/u;
const base = (a: string[]) => a.map(x => x.normalize("NFC")).filter(x => KEEP.test(x) && x !== " ");
const ms = (a: string[]) => { const m = new Map<string, number>(); for (const x of a) m.set(x, (m.get(x) ?? 0) + 1); return m; };
const d = JSON.parse(fs.readFileSync(inp, "utf8"));
const flags: any[] = []; let checked = 0;
for (const it of d.items) {
  if (!it.svg || it.status !== "latex") continue;
  checked++;
  const a = ms(base(inkOfLatex(it.latex))), b = ms(base(inkOfSvg(it.svg)));
  const diff: string[] = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) if ((a.get(k) ?? 0) !== (b.get(k) ?? 0)) diff.push(`${k}:${a.get(k) ?? 0}≠${b.get(k) ?? 0}`);
  if (diff.length) flags.push({ i: it.i, q: it.q, latex: it.latex, diff });
}
console.log(JSON.stringify({ checked, flagged: flags.length }));
if (outp) fs.writeFileSync(outp, JSON.stringify(flags, null, 1));
for (const f of flags.slice(0, 400)) console.log(f.i, f.q, "|", f.latex, "|", f.diff.join(" "));
