// BU-03-MATHTYPE — cây MTEF → LaTeX. THUẦN. Mọi thứ không nằm trong bảng dưới đây ném MtefFail (cả công thức thất bại; không bỏ ký tự, không đoán).
//
// NGUỒN SỰ THẬT: không phải trí nhớ về tài liệu MTEF mà là MẪU THẬT. Thứ tự ô, ý nghĩa bit biến thể, hướng căn ma trận… đều được sửa theo dữ liệu thật:
//   - chuẩn 1: công thức có "TeX Input Language" (FUTURE 102) do chính MathType ghi trong OLE — so với LaTeX sinh ra sau khi chuẩn hoá;
//   - chuẩn 2: ảnh xem trước WMF đi kèm (chuỗi chữ-số, phông, cỡ chữ) — tệp lệch TeX gốc được điều tra từng cụm.
// Mỗi cấu trúc có mục trong MATHTYPE_STRUCTURES: `verified` = đã đối chiếu với mẫu thật (số mẫu ghi trong `evidence`); `!verified` = viết theo tài liệu hoặc quá ít mẫu,
// KHÔNG có bằng chứng → decode gắn cờ "unverified_structure" để phía tích hợp dùng ảnh dự phòng.
// Các điều đã SỬA so với bản viết theo tài liệu (mẫu thật bác bỏ): thứ tự ô tích phân/tổng (thân, DƯỚI, TRÊN, ký hiệu — không phải trên rồi dưới), hướng căn ma trận
// (hj 0=trái, 1=giữa, 2=phải — không phải 1,2,3), bit biến thể toán tử lớn (0x10 cận dưới, 0x20 cận trên, 0x40 cận nằm trên/dưới), giới hạn lim (biến thể 0x10 = cận dưới).
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

// ── Danh mục cấu trúc ────────────────────────────────────────────────────────────────────────────
/** `evidence`: số luồng KHÁC NHAU trong kho mẫu (xem tools/local-e2e/mathtype-corpus.ts). Chưa có bằng chứng → verified:false. */
export const MATHTYPE_STRUCTURES: Record<string, { verified: boolean; evidence: string }> = {
  "char:latin": { verified: true, evidence: "308340 luồng khác nhau trong kho mẫu thật; 36928 có TeX gốc, 36691 khớp" },
  "char:greek": { verified: true, evidence: "20994 luồng khác nhau trong kho mẫu thật; 2821 có TeX gốc, 2768 khớp" },
  "char:symbol": { verified: true, evidence: "188918 luồng khác nhau trong kho mẫu thật; 25245 có TeX gốc, 25108 khớp" },
  "char:space": { verified: true, evidence: "22116 luồng khác nhau trong kho mẫu thật; 215 có TeX gốc, 211 khớp" },
  "char:accented": { verified: true, evidence: "280 luồng khác nhau trong kho mẫu thật; 71 có TeX gốc, 70 khớp" },
  "char:vector_font": { verified: false, evidence: "56 luồng khác nhau trong kho mẫu thật; 38 có TeX gốc, 38 khớp (chỉ so được chữ cái; TeX gốc không phân biệt in đậm → độ đậm chưa kiểm)" },
  "frac": { verified: true, evidence: "67527 luồng khác nhau trong kho mẫu thật; 8147 có TeX gốc, 8082 khớp" },
  "sqrt": { verified: true, evidence: "21651 luồng khác nhau trong kho mẫu thật; 2354 có TeX gốc, 2318 khớp" },
  "root_n": { verified: true, evidence: "1231 luồng khác nhau trong kho mẫu thật; 171 có TeX gốc, 169 khớp" },
  "script_sub": { verified: true, evidence: "34719 luồng khác nhau trong kho mẫu thật; 5128 có TeX gốc, 5108 khớp" },
  "script_sup": { verified: true, evidence: "52106 luồng khác nhau trong kho mẫu thật; 8264 có TeX gốc, 8194 khớp" },
  "script_subsup": { verified: true, evidence: "4259 luồng khác nhau trong kho mẫu thật; 630 có TeX gốc, 627 khớp" },
  "fence:paren": { verified: true, evidence: "92312 luồng khác nhau trong kho mẫu thật; 3682 có TeX gốc, 3651 khớp" },
  "fence:bracket": { verified: true, evidence: "5280 luồng khác nhau trong kho mẫu thật; 264 có TeX gốc, 261 khớp" },
  "fence:brace": { verified: true, evidence: "2129 luồng khác nhau trong kho mẫu thật; 37 có TeX gốc, 37 khớp" },
  "fence:bar": { verified: true, evidence: "3094 luồng khác nhau trong kho mẫu thật; 177 có TeX gốc, 177 khớp" },
  "fence:half": { verified: true, evidence: "12093 luồng khác nhau trong kho mẫu thật; 894 có TeX gốc, 879 khớp" },
  "fence:other": { verified: false, evidence: "1 luồng khác nhau trong kho mẫu thật; 0 có TeX gốc, 0 khớp; ngoặc nhọn góc: ≤1 mẫu, không có TeX gốc" },
  "interval": { verified: false, evidence: "2641 luồng khác nhau trong kho mẫu thật; 43 có TeX gốc, 42 khớp (97,7%, dưới ngưỡng 98%); 1 lệch: dấu đóng ) trong KiN so với ] trong TeX gốc ([0;+∞) — chưa xác định bên nào sai" },
  "vec_arrow": { verified: true, evidence: "8685 luồng khác nhau trong kho mẫu thật; 1109 có TeX gốc, 1104 khớp" },
  "vec_other": { verified: false, evidence: "17 luồng khác nhau trong kho mẫu thật; 0 có TeX gốc, 0 khớp; T31.1/3/10: ít mẫu, không có TeX gốc" },
  "hat": { verified: true, evidence: "4096 luồng khác nhau trong kho mẫu thật; 477 có TeX gốc, 468 khớp" },
  "tilde_wide": { verified: false, evidence: "0 luồng khác nhau trong kho mẫu thật; 0 có TeX gốc, 0 khớp; T32.0: không có TeX gốc" },
  "arc": { verified: false, evidence: "80 luồng khác nhau trong kho mẫu thật; 0 có TeX gốc, 0 khớp; T34.0 (cung ⌢): không có TeX gốc" },
  "overline": { verified: false, evidence: "2957 luồng khác nhau trong kho mẫu thật; 37 có TeX gốc, 30 khớp (81%, dưới ngưỡng 98%); 7 lệch đều do TeX gốc KHÔNG có gạch trên (MathType bỏ \\overline khi sinh TeX Input) nên KiN có thể đúng nhưng không có bằng chứng độc lập" },
  "underline": { verified: false, evidence: "3 luồng khác nhau trong kho mẫu thật; 0 có TeX gốc, 0 khớp; T12.0: không có TeX gốc" },
  "embell:prime": { verified: true, evidence: "15177 luồng khác nhau trong kho mẫu thật; 77 có TeX gốc, 77 khớp" },
  "embell:vec": { verified: true, evidence: "2223 luồng khác nhau trong kho mẫu thật; 768 có TeX gốc, 765 khớp" },
  "embell:bar": { verified: true, evidence: "1405 luồng khác nhau trong kho mẫu thật; 420 có TeX gốc, 420 khớp" },
  "embell:dot": { verified: false, evidence: "7 luồng khác nhau trong kho mẫu thật; 3 có TeX gốc, 3 khớp (dưới ngưỡng 5 luồng)" },
  "embell:other": { verified: false, evidence: "300 luồng khác nhau trong kho mẫu thật; 4 có TeX gốc, 3 khớp; EMBELL 3,4,6,8,9,12,13,18,24: ≤3 mẫu" },
  "integral": { verified: true, evidence: "5261 luồng khác nhau trong kho mẫu thật; 711 có TeX gốc, 710 khớp" },
  "integral_op": { verified: false, evidence: "66 luồng khác nhau trong kho mẫu thật; 0 có TeX gốc, 0 khớp; T21.x (∫ không thân): không có TeX gốc" },
  "integral_multi": { verified: false, evidence: "0 luồng khác nhau trong kho mẫu thật; 0 có TeX gốc, 0 khớp; ∬ ∭ ∮: không có mẫu" },
  "sum": { verified: true, evidence: "57 luồng khác nhau trong kho mẫu thật; 16 có TeX gốc, 16 khớp" },
  "sum_limits_style": { verified: false, evidence: "53 luồng khác nhau trong kho mẫu thật; 16 có TeX gốc, 16 khớp; cận ∑ nằm trên/dưới (bit 0x40): TeX gốc không phân biệt" },
  "sum_op": { verified: false, evidence: "3 luồng khác nhau trong kho mẫu thật; 0 có TeX gốc, 0 khớp; T22.x (∑ không thân): không có TeX gốc" },
  "bigunion": { verified: false, evidence: "1 luồng khác nhau trong kho mẫu thật; 1 có TeX gốc, 1 khớp (dưới ngưỡng 5 luồng)" },
  "limit": { verified: true, evidence: "5378 luồng khác nhau trong kho mẫu thật; 687 có TeX gốc, 676 khớp" },
  "limit_over": { verified: true, evidence: "240 luồng khác nhau trong kho mẫu thật; 11 có TeX gốc, 11 khớp" },
  "arrow_labeled": { verified: false, evidence: "239 luồng khác nhau trong kho mẫu thật; 9 có TeX gốc, 8 khớp (89%, dưới ngưỡng 98%); 1 lệch: TeX gốc ghi thêm ô dưới rỗng [ ] (hiển thị như nhau) nhưng mẫu quá ít để coi là đã kiểm" },
  "hbrace": { verified: true, evidence: "62 luồng khác nhau trong kho mẫu thật; 14 có TeX gốc, 14 khớp" },
  "hbrace_over": { verified: false, evidence: "0 luồng khác nhau trong kho mẫu thật; 0 có TeX gốc, 0 khớp; dấu ngoặc ngang phía trên: không có mẫu" },
  "pile": { verified: true, evidence: "9239 luồng khác nhau trong kho mẫu thật; 262 có TeX gốc, 259 khớp" },
  "pile_align": { verified: false, evidence: "7 luồng khác nhau trong kho mẫu thật; 0 có TeX gốc, 0 khớp; PILE căn giữa/phải (ha 2,3): không có TeX gốc" },
  "matrix": { verified: true, evidence: "2767 luồng khác nhau trong kho mẫu thật; 729 có TeX gốc, 715 khớp" },
  "matrix_right": { verified: true, evidence: "19 luồng khác nhau trong kho mẫu thật; 7 có TeX gốc, 7 khớp" },
};

interface Cx { warn: Set<string>; used: Set<string>; unv: Set<string>; syms: Set<string> }
/**
 * NGƯỠNG "ĐÃ KIỂM" DUY NHẤT cho cấu trúc (MATHTYPE_STRUCTURES), ký hiệu (SYM_VERIFIED) và chữ có dấu (ACCENT_VERIFIED):
 * ≥ VERIFIED_MIN_MATCHED luồng KHÁC NHAU có TeX gốc (do chính MathType ghi) khớp sau chuẩn hoá VÀ tỉ lệ khớp/có-TeX-gốc ≥ VERIFIED_MIN_RATE.
 * Mỗi luồng lệch phải được điều tra và giải thích trong `evidence`; không đạt → verified:false (đi ảnh dự phòng). tools/local-e2e/mathtype-corpus.ts áp đúng ngưỡng này.
 */
export const VERIFIED_MIN_MATCHED = 5;
export const VERIFIED_MIN_RATE = 0.98;
export const meetsVerifiedThreshold = (withTex: number, matched: number): boolean => matched >= VERIFIED_MIN_MATCHED && withTex > 0 && matched / withTex >= VERIFIED_MIN_RATE;

const mark = (cx: Cx, id: string) => {
  cx.used.add(id);
  const s = MATHTYPE_STRUCTURES[id];
  if (!s) throw new Error("structure id lạ: " + id);
  if (!s.verified) { cx.unv.add(id); cx.warn.add("unverified_structure"); }
};

const MAX_DEPTH = 40;

// ── Bảng ký tự ───────────────────────────────────────────────────────────────────────────────────
const GREEK: Record<string, string> = { "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "varepsilon", "ϵ": "epsilon", "ζ": "zeta", "η": "eta", "θ": "theta", "ϑ": "vartheta", "ι": "iota", "κ": "kappa", "λ": "lambda", "μ": "mu", "ν": "nu", "ξ": "xi", "π": "pi", "ρ": "rho", "σ": "sigma", "τ": "tau", "υ": "upsilon", "φ": "varphi", "ϕ": "phi", "χ": "chi", "ψ": "psi", "ω": "omega", "Γ": "Gamma", "Δ": "Delta", "Θ": "Theta", "Λ": "Lambda", "Ξ": "Xi", "Π": "Pi", "Σ": "Sigma", "Φ": "Phi", "Ψ": "Psi", "Ω": "Omega" };
// chữ Hy Lạp không có lệnh LaTeX riêng (giống chữ Latin) → chữ Latin đứng
const GREEK_LATIN: Record<string, string> = { "Α": "\\mathrm{A}", "Β": "\\mathrm{B}", "Ε": "\\mathrm{E}", "Ζ": "\\mathrm{Z}", "Η": "\\mathrm{H}", "Ι": "\\mathrm{I}", "Κ": "\\mathrm{K}", "Μ": "\\mathrm{M}", "Ν": "\\mathrm{N}", "Ο": "\\mathrm{O}", "Ρ": "\\mathrm{P}", "Τ": "\\mathrm{T}", "Χ": "\\mathrm{X}", "ο": "o" };
/** Ký hiệu theo mã Unicode (mtcode), không phụ thuộc typeface: ý nghĩa do Unicode quyết định. */
const SYM: Record<string, string> = {
  "2212": "-", "3d": "=", "2b": "+", "3c": "<", "3e": ">", "b0": "\\circ ", "2208": "\\in ", "221e": "\\infty ", "2264": "\\leq ", "2265": "\\geq ", "2248": "\\approx ", "2260": "\\neq ",
  "2200": "\\forall ", "2032": "\\prime ", "b1": "\\pm ", "d7": "\\times ", "22c5": "\\cdot ", "b7": "\\cdot ", "2192": "\\to ", "21d2": "\\Rightarrow ", "21d4": "\\Leftrightarrow ",
  "222a": "\\cup ", "2229": "\\cap ", "2282": "\\subset ", "2286": "\\subseteq ", "2209": "\\notin ", "2203": "\\exists ", "2205": "\\emptyset ", "2223": "\\mid ", "2225": "\\parallel ",
  "22a5": "\\perp ", "2220": "\\angle ", "2026": "\\ldots ", "22ef": "\\cdots ", "f7": "\\div ", "2236": ":",
  "2190": "\\leftarrow ", "2194": "\\leftrightarrow ", "21cc": "\\rightleftharpoons ", "2191": "\\uparrow ", "2193": "\\downarrow ", "21d0": "\\Leftarrow ", "2202": "\\partial ", "2207": "\\nabla ",
  "2234": "\\therefore ", "2235": "\\because ", "2261": "\\equiv ", "223c": "\\sim ", "221d": "\\propto ", "2283": "\\supset ", "2227": "\\wedge ", "2228": "\\vee ", "ac": "\\neg ", "2245": "\\cong ",
  "2218": "\\circ ", "2243": "\\simeq ", "22ee": "\\vdots ", "22f1": "\\ddots ", "2284": "\\not\\subset ", "2217": "\\ast ", "2295": "\\oplus ", "2297": "\\otimes ", "2022": "\\bullet ", "25b3": "\\triangle ",
  "2113": "\\ell ", "223d": "\\backsim ", "2213": "\\mp ", "2221": "\\measuredangle ", "2250": "\\doteq ", "25cb": "\\bigcirc ", "2016": "\\| ", "2216": "\\setminus ", "22c6": "\\star ", "2197": "\\nearrow ",
  "21a6": "\\mapsto ", "3f5": "\\epsilon ", "2211": "\\sum ", "222b": "\\int ", "131": "\\imath ", "b5": "\\mu ", "2a": "*", "5c": "\\backslash ", "7e": "\\sim ", "7c": "|", "21b7": "\\curvearrowright ",
};
/**
 * Ký hiệu đạt ngưỡng chung (VERIFIED_MIN_MATCHED luồng, VERIFIED_MIN_RATE) trong kho mẫu — đo bằng mathtype-corpus.ts: "khớp" = cùng số lần lệnh LaTeX của ký hiệu trong KiN và trong TeX gốc.
 * Còn lại trong SYM = "chưa kiểm" (gắn cờ → ảnh dự phòng). Hạ khỏi bản trước: ℓ(2113) 3 luồng, ∫ rời (222b) 0, | (7c) 0. Thêm: ℕ(2115) 107/107, ℝ(211d) 236/236, ℤ(2124) 270/270 (trước đây luôn coi là đã kiểm mà không có số đo).
 */
export const SYM_VERIFIED = new Set<string>(["2a", "2b", "3c", "3d", "3e", "5c", "7e", "b0", "b1", "d7", "2016", "2022", "2026", "2032", "2192", "21d2", "21d4", "2200", "2205", "2208", "2209", "2211", "2212", "221e", "2223", "2225", "2228", "2229", "222a", "2248", "2260", "2261", "2264", "2265", "2282", "22a5", "22c5", "22ef", "2115", "211d", "2124"]);
const EXTRA: Record<string, string> = { "2124": "\\mathbb{Z}", "211d": "\\mathbb{R}", "2115": "\\mathbb{N}", "211a": "\\mathbb{Q}", "2102": "\\mathbb{C}" };
const FUNCS = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "lg", "lim", "max", "min", "arcsin", "arccos", "arctan", "exp", "det", "gcd", "sinh", "cosh", "tanh", "mod"]);
const LIM_NAMES = new Set(["lim", "max", "min", "sup", "inf"]);
const ESC: Record<string, string> = { "%": "\\%", "&": "\\&", "#": "\\#", "_": "\\_", "{": "\\{", "}": "\\}", "$": "\\$" };

const hex = (n: number | undefined) => (n ?? 0).toString(16);
const bad = (tf: number, code: number | undefined): never => fail(`unsupported_char:${tf}:${hex(code)}`);
const isLatin = (c: string) => /^[A-Za-z]$/.test(c);
/** Chữ Latin có dấu (Latin-1 Supplement, Latin Extended-A/B, Latin Extended Additional — gồm chữ Việt). */
const isAccented = (c: string) => /^[À-ÖØ-öø-ɏḀ-ỿ]$/u.test(c);

/** Chữ có dấu. CHỈ nhận chữ đã thấy trong công thức khớp TeX gốc; chữ Việt khác (ư, ơ, ạ, ế…) chưa có bằng chứng → thất bại, không đoán. */
export const ACCENT_VERIFIED = new Set(["e0", "ec", "f3", "ea"]); // đạt ngưỡng chung (VERIFIED_MIN_*): à 37/37, ì 12/12, ó 11/11, ê 6/6 luồng có TeX gốc; ú chỉ 4 → hạ (xem mathtype-corpus.ts)
export const ACCENT_SEEN = new Set(["e1", "ed", "f4", "e2", "f9", "fa"]);     // dưới ngưỡng (ú: 4 luồng có TeX gốc; còn lại 1–2): ra LaTeX nhưng gắn cờ
function accentedText(c: string, h: string, tf: number, cx: Cx): string {
  cx.syms.add("acc:" + h);
  if (ACCENT_VERIFIED.has(h)) { mark(cx, "char:accented"); return `\\text{${c}}`; }
  if (ACCENT_SEEN.has(h)) { cx.used.add("char:accented"); cx.unv.add("char:" + h); cx.warn.add("unverified_structure"); return `\\text{${c}}`; }
  return bad(tf, c.codePointAt(0));
}

/** Mã ký tự thật: mtcode (Unicode) nếu có; nếu không, mã 8 bit coi là Latin-1 CHỈ khi typeface 1,2,3,8. */
function codeOf(n: Char): number {
  if (n.mt !== undefined) return n.mt;
  if (n.c8 !== undefined && (n.tf === 1 || n.tf === 2 || n.tf === 3 || n.tf === 8)) return n.c8;
  return bad(n.tf, n.c8);
}

/** Ký hiệu/Hy Lạp theo mã Unicode, dùng chung cho mọi typeface "chữ & ký hiệu". */
function universal(tf: number, c: string, h: string, cx: Cx): string | null {
  if (GREEK[c]) { mark(cx, "char:greek"); return "\\" + GREEK[c] + " "; }
  if (GREEK_LATIN[c]) { mark(cx, "char:greek"); return GREEK_LATIN[c]; }
  if (EXTRA[h]) {
    cx.syms.add("sym:" + h);
    if (SYM_VERIFIED.has(h)) mark(cx, "char:symbol");
    else { cx.used.add("char:symbol"); cx.unv.add("char:" + h); cx.warn.add("unverified_structure"); }
    return EXTRA[h];
  }
  if (SYM[h] !== undefined) {
    cx.syms.add("sym:" + h);
    if (SYM_VERIFIED.has(h)) mark(cx, "char:symbol");
    else { cx.used.add("char:symbol"); cx.unv.add("char:" + h); cx.warn.add("unverified_structure"); }
    return SYM[h];
  }
  return null;
}

function ch(n: Char, cx: Cx): string {
  const code = codeOf(n);
  if (code < 0 || code > 0x10ffff) return bad(n.tf, code);
  const c = String.fromCodePoint(code), h = hex(code);
  switch (n.tf) {
    case 8: if (/^[0-9.,]$/.test(c)) { mark(cx, "char:latin"); return c; } if (c === "%") { mark(cx, "char:latin"); return "\\%"; } return universal(8, c, h, cx) ?? bad(8, code);
    case 3: {
      if (isLatin(c)) { mark(cx, "char:latin"); return c; }
      if (c === "'") { mark(cx, "char:latin"); return "'"; }
      if (isAccented(c)) return accentedText(c, h, n.tf, cx);
      return universal(3, c, h, cx) ?? bad(3, code);
    }
    case 4: case 5: return universal(n.tf, c, h, cx) ?? bad(n.tf, code);
    case 6: return universal(6, c, h, cx) ?? bad(6, code);
    case 7: if (/^[A-Za-z0-9]$/.test(c)) { mark(cx, "char:vector_font"); return `\\mathbf{${c}}`; } return bad(7, code);
    case 11: return universal(11, c, h, cx) ?? bad(11, code);
    case 24: if (code >= 0xef00 && code <= 0xef0f) { mark(cx, "char:space"); return "\\,"; } return bad(24, code);
    case 1: case 2: {
      if (c === " " || c === " ") { mark(cx, "char:latin"); return "\\ "; }
      if (isLatin(c)) { mark(cx, "char:latin"); return c; }
      if (/^[0-9;:,.!?()/'[\]|=+<>-]$/.test(c)) { mark(cx, "char:latin"); return c; }
      if (ESC[c]) { mark(cx, "char:latin"); return ESC[c]; }
      if (isAccented(c)) return accentedText(c, h, n.tf, cx);
      if (c === "\u2013" || c === "\u2019") { cx.used.add("char:punct"); cx.unv.add("char:" + h); cx.warn.add("unverified_structure"); return `\\text{${c}}`; }
      return universal(n.tf, c, h, cx) ?? bad(n.tf, code);
    }
    default:
      // typeface ÂM (-1, -2: kiểu chữ người dùng định nghĩa): chỉ nhận ký hiệu có nghĩa cố định theo Unicode; chữ/số ASCII không rõ in nghiêng hay đứng → thất bại.
      if (n.tf < 0) {
        if (c === " ") { mark(cx, "char:latin"); return "\\ "; }
        if (/^[;:,.!?()/'[\]=+<>-]$/.test(c)) { mark(cx, "char:latin"); return c; }
        const u = /^[A-Za-z0-9]$/.test(c) ? null : universal(n.tf, c, h, cx);
        if (u !== null) return u;
      }
      return bad(n.tf, code);
  }
}

const runLetter = (n: MNode): boolean => n.t === "CHAR" && (n.tf === 1 || n.tf === 2) && n.mt !== undefined && n.emb.length === 0 && (isLatin(String.fromCodePoint(n.mt)) || isAccented(String.fromCodePoint(n.mt)));
const digitChar = (n: MNode | undefined): boolean => !!n && n.t === "CHAR" && n.tf === 8 && n.emb.length === 0 && n.mt !== undefined && n.mt >= 48 && n.mt <= 57;

function line(k: MNode[], i: number): Line {
  const s = k[i];
  if (!s || s.t !== "LINE") return fail("corrupt");
  return s;
}
/** Một "ô" của template có thể là LINE (thường) hoặc PILE/MATRIX đứng thẳng (mẫu thật: hệ phương trình trong ngoặc nhọn). */
function slot(k: MNode[], i: number, d: number, cx: Cx): string {
  const s = k[i];
  if (!s) return fail("corrupt");
  if (s.t === "LINE") return s.empty ? "" : seq(s.k, d + 1, cx);
  if (s.t === "PILE" || s.t === "MATRIX") return seq([s], d + 1, cx);
  return fail("corrupt");
}
const emptySlot = (k: MNode[], i: number): boolean => {
  const s = k[i];
  if (!s) return true;
  if (s.t !== "LINE") return false;
  if (s.empty || s.k.length === 0) return true;
  return s.k.every(x => x.t === "CHAR" && x.tf === 24 && x.emb.length === 0); // chỉ có khoảng trắng → coi là rỗng
};
const lineChars = (k: MNode[], i: number): Char[] | null => {
  const s = k[i];
  if (!s || s.t !== "LINE" || s.empty) return null;
  return s.k.every(x => x.t === "CHAR") ? (s.k as Char[]) : null;
};

/** Gom chữ Latin liền nhau cùng typeface (hàm sin/cos…, đơn vị cm…, chữ Việt). Trả [chuỗi, số phần tử đã dùng]. */
function letterRun(list: MNode[], i: number, cx: Cx): [string, number] {
  const first = list[i] as Char;
  let j = i, w = "", accented = false;
  while (j < list.length) {
    const x = list[j] as Char;
    if (!runLetter(x) || x.tf !== first.tf || (j > i && (x.o & 2))) break;
    const c = String.fromCodePoint(x.mt as number); if (!isLatin(c)) { accented = true; accentedText(c, hex(x.mt), x.tf, cx); } // ném nếu chưa có bằng chứng
    w += c; j++;
  }
  if (!accented) mark(cx, "char:latin");
  if (!accented && FUNCS.has(w) && (first.o & 2)) return [`\\${w} `, j - i];
  return [first.tf === 1 || accented ? `\\text{${w}}` : `\\mathrm{${w}}`, j - i];
}

const EMBELL: Record<number, [string, string]> = { 2: ["\\dot", "embell:dot"], 3: ["\\ddot", "embell:other"], 4: ["\\dddot", "embell:other"], 24: ["\\ddddot", "embell:other"], 8: ["\\tilde", "embell:other"], 9: ["\\hat", "embell:other"], 11: ["\\vec", "embell:vec"], 12: ["\\overleftarrow", "embell:other"], 13: ["\\overleftrightarrow", "embell:other"], 17: ["\\bar", "embell:bar"] };
const EMBELL_PRIME: Record<number, [string, string]> = { 5: ["\\prime", "embell:prime"], 6: ["\\prime\\prime", "embell:other"], 18: ["\\prime\\prime\\prime", "embell:other"] };

function embellished(n: Char, cx: Cx): { s: string; sup: boolean } {
  let s = ch(n, cx), sup = false;
  if (!n.emb.length) return { s, sup };
  for (const e of n.emb) {
    if (EMBELL[e]) { mark(cx, EMBELL[e][1]); s = `${EMBELL[e][0]}{${s}}`; }
    else if (EMBELL_PRIME[e]) { mark(cx, EMBELL_PRIME[e][1]); if (sup) return fail("double_script"); s = `${s}^{${EMBELL_PRIME[e][0]}}`; sup = true; }
    else return fail("embell");
  }
  return { s, sup };
}

function seq(list: MNode[], d: number, cx: Cx): string {
  if (d > MAX_DEPTH) fail("limit");
  let out = "", i = 0, hasAtom = false, sup = false, sub = false, lastStart = 0, lastBlock = false;
  const atom = (s: string, sp = false, sb = false, block = false) => { lastStart = out.length; out += s; hasAtom = true; sup = sp; sub = sb; lastBlock = block; };
  const script = (kind: "sup" | "sub", body: string) => {
    if ((kind === "sup" && sup) || (kind === "sub" && sub)) fail("double_script");
    if (!hasAtom) { out += "{}"; hasAtom = true; lastStart = 0; }
    else if (lastBlock) { out = out.slice(0, lastStart) + "{" + out.slice(lastStart) + "}"; lastBlock = false; } // chỉ số áp lên CẢ khối (tích phân, lim…), không rơi vào ký tự cuối
    out += kind === "sup" ? `^{${body}}` : `_{${body}}`;
    if (kind === "sup") sup = true; else sub = true;
  };
  while (i < list.length) {
    const n = list[i];
    if (runLetter(n)) { const [s, used] = letterRun(list, i, cx); atom(s); i += used; continue; }
    if (n.t === "CHAR") {
      const e = embellished(n, cx);
      // dấu phẩy thập phân kiểu Việt giữa hai chữ số → {,} (không tách khoảng)
      if (n.tf === 8 && n.mt === 44 && digitChar(list[i - 1]) && digitChar(list[i + 1])) atom("{,}");
      else atom(e.s, e.sup);
      i++; continue;
    }
    if (n.t === "TMPL" && (n.sel === 27 || n.sel === 28 || n.sel === 29)) {
      if (n.v !== 0) fail(`unsupported_template:${n.sel}.${n.v}`);
      if (n.sel === 27) { mark(cx, "script_sub"); if (n.k.length < 1) fail("corrupt"); script("sub", slot(n.k, 0, d, cx)); }
      else if (n.sel === 28) { mark(cx, "script_sup"); if (n.k.length < 2) fail("corrupt"); script("sup", slot(n.k, 1, d, cx)); }
      else { mark(cx, "script_subsup"); if (n.k.length < 2) fail("corrupt"); script("sub", slot(n.k, 0, d, cx)); script("sup", slot(n.k, 1, d, cx)); }
      i++; continue;
    }
    if (n.t === "TMPL") { const r = tmpl(n, d, cx); atom(r.s, r.sup, r.sub, !!r.block); i++; continue; }
    if (n.t === "PILE") { atom(pile(n, d, cx)); i++; continue; }
    if (n.t === "MATRIX") { atom(matrix(n, d, cx)); i++; continue; }
    fail("corrupt");
  }
  return out;
}

function pile(n: Extract<MNode, { t: "PILE" }>, d: number, cx: Cx): string {
  // mẫu thật: ha=1 (căn trái) ↔ TeX \begin{align} với "&" đầu dòng. ha 2,3: viết theo tài liệu; ha ≥ 4 (căn theo dấu '=' / tab): chưa hỗ trợ.
  const al = n.ha === 1 ? "l" : n.ha === 2 ? "c" : n.ha === 3 ? "r" : null;
  if (!al) return fail("unsupported_record:4");
  if (!n.k.length) return fail("corrupt");
  mark(cx, n.ha === 1 ? "pile" : "pile_align");
  const rows = n.k.map((_, i) => slot(n.k, i, d, cx));
  return `\\begin{array}{${al}}${rows.join("\\\\")}\\end{array}`;
}
function matrix(n: Extract<MNode, { t: "MATRIX" }>, d: number, cx: Cx): string {
  // mẫu thật: hj 0 ↔ TeX array{l} / align; hj 1 ↔ array{c}; hj 2 ↔ array{r}. (Bản cũ ghi 1=l,2=c,3=r là SAI.)
  const al = n.hj === 0 ? "l" : n.hj === 1 ? "c" : n.hj === 2 ? "r" : null;
  if (!al || n.rows < 1 || n.cols < 1) return fail("unsupported_record:5");
  if (n.rp.some(x => x !== 0) || n.cp.some(x => x !== 0)) return fail("unsupported_record:5"); // đường kẻ giữa ô: chưa hỗ trợ
  if (n.k.length !== n.rows * n.cols) return fail("corrupt");
  mark(cx, n.hj === 2 ? "matrix_right" : "matrix");
  const rows: string[] = [];
  for (let r = 0; r < n.rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < n.cols; c++) cells.push(slot(n.k, r * n.cols + c, d, cx));
    rows.push(cells.join("&"));
  }
  return `\\begin{array}{${al.repeat(n.cols)}}${rows.join("\\\\")}\\end{array}`;
}

// ── Ngoặc ───────────────────────────────────────────────────────────────────────────────────────
/** Ký tự ngoặc (typeface 22) → lệnh LaTeX. Mã thật: ( ) [ ] { } và EC07/EC08 (thanh đứng trái/phải). */
const FENCE_L: Record<number, string> = { 0x28: "(", 0x5b: "[", 0x7b: "\\{", 0xec07: "|", 0x2329: "\\langle " };
const FENCE_R: Record<number, string> = { 0x29: ")", 0x5d: "]", 0x7d: "\\}", 0xec08: "|", 0x232a: "\\rangle " };
const FENCE_SEL: Record<number, [number, number, string]> = { 0: [0x2329, 0x232a, "fence:other"], 1: [0x28, 0x29, "fence:paren"], 2: [0x7b, 0x7d, "fence:brace"], 3: [0x5b, 0x5d, "fence:bracket"], 4: [0xec07, 0xec08, "fence:bar"] };

function fenceChar(k: MNode[], i: number): number {
  const c = k[i];
  if (!c || c.t !== "CHAR" || c.tf !== 22 || c.mt === undefined) return fail("corrupt");
  return c.mt;
}
/** Ký hiệu toán tử lớn ở ô cuối: CHAR trực tiếp (T15..T20) hoặc LINE chứa đúng một CHAR (T21, T22). */
function naryCode(k: MNode[]): number {
  let c: MNode | undefined = k[3];
  if (c && c.t === "LINE" && !c.empty && c.k.length === 1) c = c.k[0];
  if (!c || c.t !== "CHAR" || c.mt === undefined) return fail("corrupt");
  return c.mt;
}

interface TR { s: string; sup: boolean; sub: boolean; block?: boolean }
function tmpl(n: Tmpl, d: number, cx: Cx): TR {
  const k = n.k;
  const R = (s: string, sup = false, sb = false, block = false): TR => ({ s, sup, sub: sb, block });
  const bad_t = (): never => fail(`unsupported_template:${n.sel}.${n.v}`);
  // ── ngoặc (0..7): ô = thân, [ngoặc trái nếu bit 1], [ngoặc phải nếu bit 2]. Ký tự ngoặc trong ô PHẢI khớp selector, nếu không thất bại (không đoán).
  if (n.sel <= 7) {
    const known = FENCE_SEL[n.sel];
    if (!known) return bad_t(); // sel 5,6,7 (thanh đôi, sàn, trần): chưa có mẫu → không đoán ký tự
    if (n.v & ~3) bad_t();
    const L = n.v & 1, Rr = n.v & 2;
    if (k.length !== 1 + (L ? 1 : 0) + (Rr ? 1 : 0)) bad_t();
    let l = ".", r = ".", idx = 1;
    if (L) { if (fenceChar(k, idx++) !== known[0]) bad_t(); l = FENCE_L[known[0]]; }
    if (Rr) { if (fenceChar(k, idx++) !== known[1]) bad_t(); r = FENCE_R[known[1]]; }
    mark(cx, known[2] === "fence:other" ? "fence:other" : n.v === 3 ? known[2] : "fence:half");
    return R(`\\left${l}${slot(k, 0, d, cx)}\\right${r}`);
  }
  switch (n.sel) {
    case 9: { // khoảng: thân, ngoặc trái, ngoặc phải — ký tự ngoặc nằm TRONG ô (mẫu thật: [a;b) và (a;b])
      if (k.length !== 3) bad_t();
      const lc = fenceChar(k, 1), rc = fenceChar(k, 2);
      const lm: Record<number, string> = { 0x28: "(", 0x5b: "[" }, rm: Record<number, string> = { 0x29: ")", 0x5d: "]" };
      if (!lm[lc] || !rm[rc]) bad_t();
      mark(cx, "interval");
      return R(`\\left${lm[lc]}${slot(k, 0, d, cx)}\\right${rm[rc]}`);
    }
    case 11:
      if (n.v !== 0 || k.length < 2) bad_t();
      mark(cx, "frac");
      return R(`\\frac{${slot(k, 0, d, cx)}}{${slot(k, 1, d, cx)}}`);
    case 10:
      if (n.v === 0) { if (k.length < 1 || (k[1] && !emptySlot(k, 1))) bad_t(); mark(cx, "sqrt"); return R(`\\sqrt{${slot(k, 0, d, cx)}}`); }
      if (n.v === 1) { if (k.length < 2 || emptySlot(k, 1)) bad_t(); mark(cx, "root_n"); return R(`\\sqrt[${slot(k, 1, d, cx)}]{${slot(k, 0, d, cx)}}`); }
      return bad_t();
    case 12: case 13:
      if (n.v !== 0 || k.length < 1) bad_t();
      mark(cx, n.sel === 12 ? "underline" : "overline");
      return R(`${n.sel === 12 ? "\\underline" : "\\overline"}{${slot(k, 0, d, cx)}}`);
    case 14: { // mũi tên có chữ trên/dưới (hoá học, "suy ra"): ô = [chữ trên, chữ dưới, ký tự mũi tên]
      if (k.length !== 3) bad_t();
      const code = fenceChar(k, 2);
      const cmd = code === 0x2192 ? "\\xrightarrow" : code === 0x2190 ? "\\xleftarrow" : bad_t();
      const top = emptySlot(k, 0) ? "" : slot(k, 0, d, cx), bottom = emptySlot(k, 1) ? "" : slot(k, 1, d, cx);
      mark(cx, "arrow_labeled");
      return R(`${cmd}${bottom ? `[${bottom}]` : ""}{${top}}`);
    }
    case 15: case 16: case 17: case 18: case 19: case 20: case 21: case 22: return naryOp(n, d, cx);
    case 23: { // giới hạn: ô = [thân, dưới, trên]; bit 0x10 = có cận dưới, 0x20 = có cận trên
      if (k.length !== 3 || (n.v & ~0x30)) bad_t();
      const low = emptySlot(k, 1) ? "" : slot(k, 1, d, cx), up = emptySlot(k, 2) ? "" : slot(k, 2, d, cx);
      if ((low && !(n.v & 0x10)) || (up && !(n.v & 0x20))) bad_t();
      const bodyCh = lineChars(k, 0);
      const w = bodyCh && bodyCh.length && bodyCh.every(c => runLetter(c) && (c.mt as number) < 128) ? bodyCh.map(c => String.fromCharCode(c.mt as number)).join("") : "";
      if (w && LIM_NAMES.has(w)) {
        mark(cx, "limit");
        return R(`\\${w}\\limits${low ? `_{${low}}` : ""}${up ? `^{${up}}` : ""} `, !!up, !!low, true);
      }
      // thân không phải tên giới hạn: ký tự/biểu thức có chữ ghi phía trên/dưới (mũi tên có điều kiện, mũi tên vectơ trên chữ)
      if (emptySlot(k, 0)) bad_t();
      mark(cx, "limit_over");
      let s = slot(k, 0, d, cx);
      if (low) s = `\\underset{${low}}{${s}}`;
      if (up) s = `\\overset{${up}}{${s}}`;
      return R(s);
    }
    case 24: { // dấu ngoặc ngang: ô = [thân, chữ, ký tự]. fe38 = ngoặc DƯỚI (\underbrace{thân}_{chữ})
      if (n.v !== 0 || k.length !== 3) bad_t();
      const code = fenceChar(k, 2);
      const lab = emptySlot(k, 1) ? "" : slot(k, 1, d, cx);
      if (code === 0xfe38) { mark(cx, "hbrace"); return R(`\\underbrace{${slot(k, 0, d, cx)}}${lab ? `_{${lab}}` : ""}`, false, !!lab); }
      if (code === 0xfe37) { mark(cx, "hbrace_over"); return R(`\\overbrace{${slot(k, 0, d, cx)}}${lab ? `^{${lab}}` : ""}`, !!lab, false); }
      return bad_t();
    }
    case 31: { // vectơ. Ô: thân, ký tự mũi tên (typeface 22). 20d7 = →, 20d6 = ←, 20e1 = ↔, 20d1 = nửa mũi tên
      if (k.length !== 2) bad_t();
      const code = fenceChar(k, 1);
      let cmd: string | undefined, id = "vec_other";
      if (n.v === 2 && code === 0x20d7) { cmd = "\\overrightarrow"; id = "vec_arrow"; }
      else if (n.v === 1 && code === 0x20d6) cmd = "\\overleftarrow";
      else if (n.v === 3 && code === 0x20e1) cmd = "\\overleftrightarrow";
      else if (n.v === 10 && code === 0x20d1) cmd = "\\overset{\\rightharpoonup}";
      if (!cmd) bad_t();
      mark(cx, id);
      return R(`${cmd}{${slot(k, 0, d, cx)}}`);
    }
    case 32: case 33: { // ~ và ^ rộng. Ô: thân, ký tự (302 = ̂ , 303 = ̃)
      if (n.v !== 0 || k.length !== 2) bad_t();
      const code = fenceChar(k, 1);
      if ((n.sel === 33 && code !== 0x302) || (n.sel === 32 && code !== 0x303)) bad_t();
      mark(cx, n.sel === 33 ? "hat" : "tilde_wide");
      const body = slot(k, 0, d, cx);
      const one = /^[A-Za-z]$/.test(body);
      return R(n.sel === 32 ? (one ? `\\tilde{${body}}` : `\\widetilde{${body}}`) : (one ? `\\hat{${body}}` : `\\widehat{${body}}`));
    }
    case 34: {
      if (n.v !== 0 || k.length !== 2 || fenceChar(k, 1) !== 0x2322) bad_t();
      mark(cx, "arc");
      return R(`\\overset{\\frown}{${slot(k, 0, d, cx)}}`);
    }
    default: return bad_t();
  }
}

/** Toán tử lớn (tích phân, tổng, tích, hợp, giao…). Ô thật: [thân, cận DƯỚI, cận TRÊN, ký hiệu]. Bit biến thể: 0x10 có cận dưới, 0x20 có cận trên, 0x40 cận nằm trên/dưới. */
function naryOp(n: Tmpl, d: number, cx: Cx): TR {
  const k = n.k, bad_t = (): never => fail(`unsupported_template:${n.sel}.${n.v}`);
  if (k.length !== 4 || (n.v & ~0x7f)) bad_t();
  const code = naryCode(k);
  const BY_CODE: Record<number, [string, string]> = { 0x222b: ["\\int", "int"], 0x222c: ["\\iint", "int2"], 0x222d: ["\\iiint", "int2"], 0x222e: ["\\oint", "int2"], 0x2211: ["\\sum", "sum"], 0x220f: ["\\prod", "sum"], 0x2210: ["\\coprod", "sum"], 0x222a: ["\\bigcup", "union"], 0x2229: ["\\bigcap", "union"], 0x22c3: ["\\bigcup", "union"], 0x22c2: ["\\bigcap", "union"] };
  const info = BY_CODE[code];
  if (!info) return bad_t();
  // selector và ký hiệu phải nhất quán, nếu không thất bại
  const BY_SEL: Record<number, number[]> = { 15: [0x222b, 0x222c, 0x222d, 0x222e], 16: [0x2211], 17: [0x220f], 18: [0x2210], 19: [0x222a, 0x22c3], 20: [0x2229, 0x22c2] };
  if (BY_SEL[n.sel] && !BY_SEL[n.sel].includes(code)) bad_t();
  const kind = info[1];
  const isOp = n.sel === 21 || n.sel === 22;
  if (isOp && !emptySlot(k, 0)) bad_t();
  if (n.sel === 21 && kind !== "int" && kind !== "int2") bad_t();
  if (n.sel === 22 && (kind === "int" || kind === "int2")) bad_t();
  const low = emptySlot(k, 1) ? "" : slot(k, 1, d, cx), up = emptySlot(k, 2) ? "" : slot(k, 2, d, cx);
  if ((low && !(n.v & 0x10)) || (up && !(n.v & 0x20))) bad_t();
  const over = !!(n.v & 0x40);
  if (kind === "int") mark(cx, isOp ? "integral_op" : "integral");
  else if (kind === "int2") mark(cx, "integral_multi");
  else if (kind === "sum") mark(cx, isOp ? "sum_op" : "sum");
  else mark(cx, "bigunion");
  if (over && (low || up) && kind !== "int") mark(cx, "sum_limits_style");
  const mod = (low || up) ? (over ? "\\limits" : (kind === "int" || kind === "int2" ? "" : "\\nolimits")) : "";
  const body = isOp ? "" : slot(k, 0, d, cx);
  return R2(`${info[0]}${mod}${low ? `_{${low}}` : ""}${up ? `^{${up}}` : ""} ${body}`);
}
const R2 = (s: string): TR => ({ s, sup: false, sub: false, block: true });

/** `symbols`: ký hiệu/chữ có dấu đã dùng ("sym:<hex>" / "acc:<hex>") — chỉ để công cụ kiểm thống kê bằng chứng. */
export interface EmitResult { latex: string; warnings: string[]; structures: string[]; unverified: string[]; symbols: string[] }
export function emitLatex(top: MNode): EmitResult {
  if (top.t !== "LINE" && top.t !== "PILE" && top.t !== "MATRIX") fail("corrupt");
  const cx: Cx = { warn: new Set(), used: new Set(), unv: new Set(), syms: new Set() };
  const latex = top.t === "LINE" ? seq(top.k, 0, cx) : seq([top], 0, cx);
  return { latex, warnings: [...cx.warn], structures: [...cx.used].sort(), unverified: [...cx.unv].sort(), symbols: [...cx.syms].sort() };
}

/** CHỈ DÙNG TRONG CÔNG CỤ KIỂM: LaTeX của một ký tự đơn (hoặc mã lỗi). */
export function charLatexForTool(tf: number, mt: number | undefined, c8?: number): string {
  try { const n = { t: "CHAR", o: 0, tf, mt, c8, emb: [] } as Char; return ch(n, { warn: new Set(), used: new Set(), unv: new Set(), syms: new Set() }); } catch (e) { return e instanceof MtefFail ? "FAIL:" + e.reason : "FAIL"; }
}

/** CHỈ DÙNG TRONG CÔNG CỤ KIỂM: lệnh LaTeX mà "sym:<hex>" / "acc:<hex>" được đổi thành (để đếm số lần xuất hiện trong TeX gốc). */
export function symbolLatexForTool(id: string): string | null {
  const [kind, h] = id.split(":");
  if (kind === "acc") return `\\text{${String.fromCodePoint(parseInt(h, 16))}}`;
  return EXTRA[h] ?? SYM[h] ?? null;
}

/** CHỈ DÙNG TRONG CÔNG CỤ KIỂM: lệnh LaTeX mà bộ giải phát ra cho một ký tự Unicode (chữ Hy Lạp/ký hiệu), hoặc null nếu không phải ký hiệu có bảng. */
export function tokenForCharForTool(ch: string): string | null {
  const h = hex(ch.codePointAt(0));
  if (GREEK[ch]) return "\\" + GREEK[ch];
  if (EXTRA[h]) return EXTRA[h];
  if (SYM[h] !== undefined) return SYM[h].trim();
  return null;
}
/** CHỈ DÙNG TRONG CÔNG CỤ KIỂM: mọi lệnh LaTeX ứng viên (để suy ngược glyph nào ứng với lệnh nào). */
export function allTokensForTool(): string[] {
  return [...new Set([...Object.values(GREEK).map(g => "\\" + g), ...Object.values(EXTRA), ...Object.values(SYM).map(v => v.trim())])];
}
