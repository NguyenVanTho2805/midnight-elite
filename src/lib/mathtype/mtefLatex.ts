// BU-03-MATHTYPE — cây MTEF → LaTeX. THUẦN. Mọi thứ không nằm trong bảng dưới đây ném MtefFail (cả công thức thất bại; không bỏ ký tự, không đoán).
// KIỂM BẰNG MẪU THẬT (299 công thức Toán 12): ngoặc tròn/vuông (sel 1,3 var 3), căn bậc 2 (10.0), phân số (11.0), chỉ số dưới (27.0), mũ (28.0), ký tự typeface 1,2,3,4,6,8,11,22,24.
// CHƯA KIỂM BẰNG MẪU THẬT (viết theo tài liệu MTEF 5, test bằng byte tự dựng + KaTeX): ngoặc 0,2,4–7 và biến thể 1/2, căn bậc n, gạch trên/dưới, mũi tên 14, tích phân 15,
// tổng/tích/hợp/giao 16–22, giới hạn 23, vectơ 31, ~ ^ 32–33, cung 34, SUBSUP 29, PILE, MATRIX, EMBELL, typeface 7, và các ký hiệu bổ sung. Khi dùng, `warnings` có "unverified_structure".
import type { MathTypeFailReason } from "./mtef";

export class MtefFail extends Error { constructor(public reason: MathTypeFailReason) { super(reason); } }
const fail = (r: MathTypeFailReason): never => { throw new MtefFail(r); };

export type MNode =
  | { t: "LINE"; empty: boolean; k: MNode[] }
  | { t: "CHAR"; o: number; tf: number; mt?: number; c8?: number; c16?: number; emb: number[] }
  | { t: "TMPL"; sel: number; v: number; to: number; k: MNode[] }
  | { t: "PILE"; ha: number; va: number; k: MNode[] }
  | { t: "MATRIX"; va: number; hj: number; vj: number; rows: number; cols: number; rp: number[]; cp: number[]; k: MNode[] }
  | { t: "EMBELL"; code: number };
type Char = Extract<MNode, { t: "CHAR" }>;
type Line = Extract<MNode, { t: "LINE" }>;
type Tmpl = Extract<MNode, { t: "TMPL" }>;

const MAX_DEPTH = 40;
interface Cx { warn: Set<string> }
const unverified = (cx: Cx) => { cx.warn.add("unverified_structure"); };

const GREEK: Record<string, string> = { "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "varepsilon", "ϵ": "epsilon", "ζ": "zeta", "η": "eta", "θ": "theta", "ϑ": "vartheta", "ι": "iota", "κ": "kappa", "λ": "lambda", "μ": "mu", "ν": "nu", "ξ": "xi", "π": "pi", "ρ": "rho", "σ": "sigma", "τ": "tau", "υ": "upsilon", "φ": "varphi", "ϕ": "phi", "χ": "chi", "ψ": "psi", "ω": "omega", "Γ": "Gamma", "Δ": "Delta", "Θ": "Theta", "Λ": "Lambda", "Ξ": "Xi", "Π": "Pi", "Σ": "Sigma", "Φ": "Phi", "Ψ": "Psi", "Ω": "Omega" };
const SYM: Record<string, string> = {
  "2212": "-", "3d": "=", "2b": "+", "3c": "<", "3e": ">", "b0": "\\circ ", "2208": "\\in ", "221e": "\\infty ", "2264": "\\leq ", "2265": "\\geq ", "2248": "\\approx ", "2260": "\\neq ",
  "2200": "\\forall ", "2032": "\\prime ", "b1": "\\pm ", "d7": "\\times ", "22c5": "\\cdot ", "b7": "\\cdot ", "2192": "\\to ", "21d2": "\\Rightarrow ", "21d4": "\\Leftrightarrow ",
  "222a": "\\cup ", "2229": "\\cap ", "2282": "\\subset ", "2286": "\\subseteq ", "2209": "\\notin ", "2203": "\\exists ", "2205": "\\emptyset ", "2223": "\\mid ", "2225": "\\parallel ",
  "22a5": "\\perp ", "2220": "\\angle ", "2026": "\\ldots ", "22ef": "\\cdots ", "f7": "\\div ", "2236": ":",
  // bổ sung (chưa kiểm bằng mẫu thật):
  "2190": "\\leftarrow ", "2194": "\\leftrightarrow ", "21cc": "\\rightleftharpoons ", "2191": "\\uparrow ", "2193": "\\downarrow ", "21d0": "\\Leftarrow ", "2202": "\\partial ", "2207": "\\nabla ",
  "2234": "\\therefore ", "2235": "\\because ", "2261": "\\equiv ", "223c": "\\sim ", "221d": "\\propto ", "2283": "\\supset ", "2227": "\\wedge ", "2228": "\\vee ", "ac": "\\neg ", "2245": "\\cong ",
};
const SYM_UNVERIFIED = new Set(["2190", "2194", "21cc", "2191", "2193", "21d0", "2202", "2207", "2234", "2235", "2261", "223c", "221d", "2283", "2227", "2228", "ac", "2245"]);
const EXTRA: Record<string, string> = { "2124": "\\mathbb{Z}", "211d": "\\mathbb{R}", "2115": "\\mathbb{N}", "211a": "\\mathbb{Q}", "2102": "\\mathbb{C}" };
const FUNCS = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "lg", "lim", "max", "min", "arcsin", "arccos", "arctan", "exp", "det", "gcd", "sinh", "cosh", "tanh"]);
const LIM_NAMES = new Set(["lim", "max", "min", "sup", "inf"]);
const ESC: Record<string, string> = { "%": "\\%", "&": "\\&", "#": "\\#", "_": "\\_", "{": "\\{", "}": "\\}", "$": "\\$" };
const PAIRS: [string, string][] = [["\\langle ", "\\rangle "], ["(", ")"], ["\\{", "\\}"], ["[", "]"], ["|", "|"], ["\\|", "\\|"], ["\\lfloor ", "\\rfloor "], ["\\lceil ", "\\rceil "]];
const EMBELL: Record<number, string> = { 2: "\\dot", 3: "\\ddot", 4: "\\dddot", 24: "\\ddddot", 8: "\\tilde", 9: "\\hat", 11: "\\vec", 12: "\\overleftarrow", 13: "\\overleftrightarrow", 17: "\\bar" };
const EMBELL_PRIME: Record<number, string> = { 5: "\\prime", 6: "\\prime\\prime", 18: "\\prime\\prime\\prime" };

const hex = (n: number | undefined) => (n ?? 0).toString(16);
const bad = (tf: number, code: number | undefined): never => fail(`unsupported_char:${tf}:${hex(code)}`);
const isLatin = (c: string) => /^[A-Za-z]$/.test(c);

/** Mã ký tự thật: mtcode (Unicode) nếu có; nếu không, mã 8 bit coi là Latin-1 CHỈ khi typeface 1,2,3,8. */
function codeOf(n: Char): number {
  if (n.mt !== undefined) return n.mt;
  if (n.c8 !== undefined && (n.tf === 1 || n.tf === 2 || n.tf === 3 || n.tf === 8)) return n.c8;
  return bad(n.tf, n.c8);
}

function ch(n: Char, cx: Cx): string {
  const code = codeOf(n);
  if (code < 0 || code > 0x10ffff) return bad(n.tf, code);
  const c = String.fromCodePoint(code), h = hex(code);
  switch (n.tf) {
    case 8: if (/^[0-9.,]$/.test(c)) return c; return bad(8, code);
    case 3: if (isLatin(c)) return c; if (GREEK[c]) return "\\" + GREEK[c] + " "; return bad(3, code);
    case 4: case 5: if (GREEK[c]) return "\\" + GREEK[c] + " "; return bad(n.tf, code);
    case 6: {
      if (SYM[h] !== undefined) { if (SYM_UNVERIFIED.has(h)) unverified(cx); return SYM[h]; }
      return bad(6, code);
    }
    case 7: if (isLatin(c)) { unverified(cx); return `\\mathbf{${c}}`; } return bad(7, code);
    case 11: if (EXTRA[h]) return EXTRA[h]; return bad(11, code);
    case 24: if (code >= 0xef00 && code <= 0xef0f) return "\\,"; return bad(24, code);
    case 1: case 2: {
      if (c === " " || c === " ") return "\\ ";
      if (isLatin(c)) return c;
      if (/^[0-9;:,.!?()/'[\]|=+<>-]$/.test(c)) return c;
      if (ESC[c]) return ESC[c];
      return bad(n.tf, code);
    }
    default: return bad(n.tf, code);
  }
}

const letterChar = (n: MNode): boolean => n.t === "CHAR" && (n.tf === 1 || n.tf === 2) && n.mt !== undefined && n.emb.length === 0 && n.mt < 128 && isLatin(String.fromCharCode(n.mt));
const digitChar = (n: MNode | undefined): boolean => !!n && n.t === "CHAR" && n.tf === 8 && n.emb.length === 0 && n.mt !== undefined && n.mt >= 48 && n.mt <= 57;

function line(k: MNode[], i: number): Line {
  const s = k[i];
  if (!s || s.t !== "LINE") return fail("corrupt");
  return s;
}
const slot = (k: MNode[], i: number, d: number, cx: Cx): string => { const s = line(k, i); return s.empty ? "" : seq(s.k, d + 1, cx); };
const emptySlot = (k: MNode[], i: number): boolean => { const s = k[i]; return !!s && s.t === "LINE" && (s.empty || s.k.length === 0); };

/** Gom chữ Latin liền nhau cùng typeface (hàm sin/cos…, đơn vị cm…). Trả [chuỗi, số phần tử đã dùng]. */
function letterRun(list: MNode[], i: number): [string, number] {
  const first = list[i] as Char;
  let j = i, w = "";
  while (j < list.length) {
    const x = list[j] as Char;
    if (!letterChar(x) || x.tf !== first.tf || (j > i && (x.o & 2))) break;
    w += String.fromCharCode(x.mt as number); j++;
  }
  return [FUNCS.has(w) ? `\\${w} ` : first.tf === 1 ? `\\text{${w}}` : `\\mathrm{${w}}`, j - i];
}

function embellished(n: Char, cx: Cx): { s: string; sup: boolean } {
  let s = ch(n, cx), sup = false;
  if (!n.emb.length) return { s, sup };
  unverified(cx);
  for (const e of n.emb) {
    if (EMBELL[e]) s = `${EMBELL[e]}{${s}}`;
    else if (EMBELL_PRIME[e]) { if (sup) return fail("double_script"); s = `${s}^{${EMBELL_PRIME[e]}}`; sup = true; }
    else return fail("embell");
  }
  return { s, sup };
}

function seq(list: MNode[], d: number, cx: Cx): string {
  if (d > MAX_DEPTH) fail("limit");
  let out = "", i = 0, hasAtom = false, sup = false, sub = false;
  const atom = (s: string, sp = false, sb = false) => { out += s; hasAtom = true; sup = sp; sub = sb; };
  const script = (kind: "sup" | "sub", body: string) => {
    if ((kind === "sup" && sup) || (kind === "sub" && sub)) fail("double_script");
    if (!hasAtom) { out += "{}"; hasAtom = true; }
    out += kind === "sup" ? `^{${body}}` : `_{${body}}`;
    if (kind === "sup") sup = true; else sub = true;
  };
  while (i < list.length) {
    const n = list[i];
    if (letterChar(n)) { const [s, used] = letterRun(list, i); atom(s); i += used; continue; }
    if (n.t === "CHAR") {
      const e = embellished(n, cx);
      // dấu phẩy thập phân kiểu Việt giữa hai chữ số → {,} (không tách khoảng)
      if (n.tf === 8 && n.mt === 44 && digitChar(list[i - 1]) && digitChar(list[i + 1])) atom("{,}");
      else atom(e.s, e.sup);
      i++; continue;
    }
    if (n.t === "TMPL" && (n.sel === 27 || n.sel === 28 || n.sel === 29)) {
      if (n.v !== 0) fail(`unsupported_template:${n.sel}.${n.v}`);
      if (n.sel === 27) { if (n.k.length < 1) fail("corrupt"); script("sub", slot(n.k, 0, d, cx)); }
      else if (n.sel === 28) { if (n.k.length < 2) fail("corrupt"); script("sup", slot(n.k, 1, d, cx)); }
      else { unverified(cx); if (n.k.length < 2) fail("corrupt"); script("sub", slot(n.k, 0, d, cx)); script("sup", slot(n.k, 1, d, cx)); }
      i++; continue;
    }
    if (n.t === "TMPL") { const r = tmpl(n, d, cx); atom(r.s, r.sup, r.sub); i++; continue; }
    if (n.t === "PILE") { unverified(cx); atom(pile(n, d, cx)); i++; continue; }
    if (n.t === "MATRIX") { unverified(cx); atom(matrix(n, d, cx)); i++; continue; }
    fail("corrupt");
  }
  return out;
}

function pile(n: Extract<MNode, { t: "PILE" }>, d: number, cx: Cx): string {
  const al = n.ha === 1 ? "l" : n.ha === 2 ? "c" : n.ha === 3 ? "r" : null;
  if (!al) return fail("unsupported_record:4");
  if (!n.k.length) return fail("corrupt");
  const rows = n.k.map((_, i) => slot(n.k, i, d, cx));
  return `\\begin{array}{${al}}${rows.join("\\\\")}\\end{array}`;
}
function matrix(n: Extract<MNode, { t: "MATRIX" }>, d: number, cx: Cx): string {
  const al = n.hj === 1 ? "l" : n.hj === 2 ? "c" : n.hj === 3 ? "r" : null;
  if (!al || n.rows < 1 || n.cols < 1) return fail("unsupported_record:5");
  if (n.rp.some(x => x !== 0) || n.cp.some(x => x !== 0)) return fail("unsupported_record:5"); // đường kẻ giữa ô: chưa hỗ trợ
  if (n.k.length !== n.rows * n.cols) return fail("corrupt");
  const rows: string[] = [];
  for (let r = 0; r < n.rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < n.cols; c++) cells.push(slot(n.k, r * n.cols + c, d, cx));
    rows.push(cells.join("&"));
  }
  return `\\begin{array}{${al.repeat(n.cols)}}${rows.join("\\\\")}\\end{array}`;
}

/** Ký tự toán tử trong ô cuối của tích phân/tổng. */
function opChar(k: MNode[], i: number): number {
  const c = k[i];
  if (!c || c.t !== "CHAR" || c.mt === undefined) return fail("corrupt");
  return c.mt;
}
/** Cận trên/dưới theo SỐ Ô (ô rỗng không phát). Ô: thân, [trên], [dưới], ký tự. */
function limits(n: Tmpl, d: number, cx: Cx, sumBits: boolean): { up: string; low: string; hasUp: boolean; hasLow: boolean } {
  const cnt = n.k.length;
  let up = false, low = false;
  if (cnt === 2) { /* không cận */ }
  else if (cnt === 4) { up = true; low = true; }
  else if (cnt === 3 && sumBits && (n.v & 3) === 1) low = true; // chỉ cận dưới
  else if (cnt === 3 && sumBits && (n.v & 3) === 2) up = true;  // chỉ cận trên
  else return fail(`unsupported_template:${n.sel}.${n.v}`);
  let idx = 1;
  let upS = "", lowS = "";
  if (up) upS = slot(n.k, idx++, d, cx);
  if (low) lowS = slot(n.k, idx++, d, cx);
  return { up: upS, low: lowS, hasUp: up && upS !== "", hasLow: low && lowS !== "" };
}

function tmpl(n: Tmpl, d: number, cx: Cx): { s: string; sup: boolean; sub: boolean } {
  const k = n.k;
  const R = (s: string, sup = false, sub = false) => ({ s, sup, sub });
  const bad_t = () => fail(`unsupported_template:${n.sel}.${n.v}`);
  if (n.sel <= 7) {
    if (n.v & ~3) bad_t();
    const L = n.v & 1, Rr = n.v & 2;
    if (k.length !== 1 + (L ? 1 : 0) + (Rr ? 1 : 0)) bad_t();
    for (let i = 1; i < k.length; i++) if (k[i].t !== "CHAR") fail("corrupt");
    if (!((n.sel === 1 || n.sel === 3) && n.v === 3)) unverified(cx);
    return R(`\\left${L ? PAIRS[n.sel][0] : "."}${slot(k, 0, d, cx)}\\right${Rr ? PAIRS[n.sel][1] : "."}`);
  }
  switch (n.sel) {
    case 11:
      if (n.v !== 0 || k.length < 2) bad_t();
      return R(`\\frac{${slot(k, 0, d, cx)}}{${slot(k, 1, d, cx)}}`);
    case 10:
      if (n.v === 0) { if (k.length < 1 || (k[1] && !emptySlot(k, 1))) bad_t(); return R(`\\sqrt{${slot(k, 0, d, cx)}}`); }
      if (n.v === 1) { unverified(cx); if (k.length < 2 || emptySlot(k, 1)) bad_t(); return R(`\\sqrt[${slot(k, 1, d, cx)}]{${slot(k, 0, d, cx)}}`); }
      return bad_t();
    case 12: case 13:
      unverified(cx);
      if (n.v !== 0 || k.length < 1) bad_t();
      return R(`${n.sel === 12 ? "\\underline" : "\\overline"}{${slot(k, 0, d, cx)}}`);
    case 14: { // mũi tên có chữ trên/dưới (hoá học). Ô: [trên nếu bit 4], [dưới nếu bit 8], ký tự mũi tên.
      unverified(cx);
      if (n.v & ~(4 | 8)) bad_t();
      const top = !!(n.v & 4), bottom = !!(n.v & 8);
      if (k.length !== (top ? 1 : 0) + (bottom ? 1 : 0) + 1) bad_t();
      let i = 0; const t = top ? slot(k, i++, d, cx) : "", b = bottom ? slot(k, i++, d, cx) : "";
      const code = opChar(k, i);
      const cmd = code === 0x2192 ? "\\xrightarrow" : code === 0x2190 ? "\\xleftarrow" : code === 0x21cc ? "\\xrightleftharpoons" : bad_t();
      return R(`${cmd}${bottom ? `[${b}]` : ""}{${t}}`);
    }
    case 15: { // tích phân. Ô: thân, [trên, dưới], ký tự ∫
      unverified(cx);
      if (n.v & ~0x10f) bad_t();
      const code = opChar(k, k.length - 1);
      const sym = code === 0x222e ? "\\oint " : code === 0x222b ? ({ 1: "\\int ", 2: "\\iint ", 3: "\\iiint " } as Record<number, string>)[n.v & 3] : undefined;
      if (!sym) bad_t();
      const l = limits(n, d, cx, false);
      return R(`${sym}${l.hasLow ? `_{${l.low}}` : ""}${l.hasUp ? `^{${l.up}}` : ""}${slot(k, 0, d, cx)}`, l.hasUp, l.hasLow);
    }
    case 16: case 17: case 18: case 19: case 20: case 21: case 22: { // ∑ ∏ ∐ ∪ ∩ và dạng toán tử tự chọn
      unverified(cx);
      if (n.v & ~0x43) bad_t();
      const code = opChar(k, k.length - 1);
      const byCode: Record<number, string> = { 0x2211: "\\sum ", 0x220f: "\\prod ", 0x2210: "\\coprod ", 0x22c3: "\\bigcup ", 0x22c2: "\\bigcap ", 0x222b: "\\int ", 0x222e: "\\oint " };
      const bySel: Record<number, string> = { 16: "\\sum ", 17: "\\prod ", 18: "\\coprod ", 19: "\\bigcup ", 20: "\\bigcap " };
      const sym = n.sel >= 21 ? byCode[code] : bySel[n.sel];
      if (!sym) bad_t();
      const l = limits(n, d, cx, true);
      return R(`${sym}${l.hasLow ? `_{${l.low}}` : ""}${l.hasUp ? `^{${l.up}}` : ""}${slot(k, 0, d, cx)}`, l.hasUp, l.hasLow);
    }
    case 23: { // giới hạn: thân (tên hàm), dưới, [trên]
      unverified(cx);
      if ((n.v !== 0 && n.v !== 1) || (k.length !== 2 && k.length !== 3)) bad_t();
      const body = line(k, 0).k;
      if (!body.length || !body.every(letterChar)) bad_t();
      const w = body.map(x => String.fromCharCode((x as Char).mt as number)).join("");
      if (!LIM_NAMES.has(w)) bad_t();
      const low = slot(k, 1, d, cx), up = k.length === 3 ? slot(k, 2, d, cx) : "";
      return R(`\\${w}${low ? `_{${low}}` : ""}${up ? `^{${up}}` : ""} `, !!up, !!low);
    }
    case 31: { // vectơ. Ô: thân, ký tự mũi tên
      unverified(cx);
      if (k.length !== 2 || k[1].t !== "CHAR") bad_t();
      const cmd = n.v === 2 ? "\\overrightarrow" : n.v === 1 ? "\\overleftarrow" : n.v === 3 ? "\\overleftrightarrow" : bad_t();
      return R(`${cmd}{${slot(k, 0, d, cx)}}`);
    }
    case 32: case 33: {
      unverified(cx);
      if (n.v !== 0 || k.length !== 2 || k[1].t !== "CHAR") bad_t();
      const body = slot(k, 0, d, cx);
      const one = /^[A-Za-z]$/.test(body);
      return R(n.sel === 32 ? (one ? `\\tilde{${body}}` : `\\widetilde{${body}}`) : (one ? `\\hat{${body}}` : `\\widehat{${body}}`));
    }
    case 34:
      unverified(cx);
      if (n.v !== 0 || k.length !== 2 || k[1].t !== "CHAR") bad_t();
      return R(`\\overset{\\frown}{${slot(k, 0, d, cx)}}`);
    default: return bad_t();
  }
}

export function emitLatex(top: MNode): { latex: string; warnings: string[] } {
  if (top.t !== "LINE") fail("corrupt");
  const cx: Cx = { warn: new Set() };
  const latex = seq((top as Line).k, 0, cx);
  return { latex, warnings: [...cx.warn] };
}
