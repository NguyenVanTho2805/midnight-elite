// BU-03 P1 — công thức Word kiểu OMML (<m:oMath>) → LaTeX. THUẦN: không DB, không mạng, không phụ thuộc thư viện XML.
// Nhận một nút DOM bất kỳ có hình dạng "giống DOM" (xmldom, trình duyệt đều khớp `XmlNodeLike`) nên chạy được cả ở test tsx.
// Không bao giờ ném lỗi ra ngoài: công thức hỏng/quá sâu → trả nhãn `⟦công thức⟧` để gia sư sửa tay (câu còn nhãn này không phát hành được).
// Công thức MathType OLE (Equation.DSMT4 — Azota/Toán 12) KHÔNG phải OMML, không đi qua tệp này (P1a chỉ gắn nhãn; xem azotaDocx.ts).

export const FORMULA_PLACEHOLDER = "⟦công thức⟧";

export interface XmlNodeLike {
  nodeType: number;
  nodeName: string;
  localName?: string | null;
  nodeValue?: string | null;
  textContent?: string | null;
  childNodes: ArrayLike<XmlNodeLike>;
  getAttribute?(name: string): string | null;
}

const MAX_DEPTH = 40;
const MAX_LEN = 5_000;

const ln = (n: XmlNodeLike): string => (n.localName || n.nodeName.split(":").pop() || "").toString();
const kids = (n: XmlNodeLike): XmlNodeLike[] => Array.from(n.childNodes).filter(c => c.nodeType === 1);
const kid = (n: XmlNodeLike, name: string): XmlNodeLike | undefined => kids(n).find(c => ln(c) === name);
const kidsNamed = (n: XmlNodeLike, name: string): XmlNodeLike[] => kids(n).filter(c => ln(c) === name);
/** Giá trị thuộc tính `val` của phần tử con `name` (m:chr m:val="∑"); thuộc tính có tiền tố nên thử cả `m:val` và `val`. */
function propVal(parent: XmlNodeLike | undefined, name: string): string | null {
  const el = parent ? kid(parent, name) : undefined;
  if (!el || !el.getAttribute) return null;
  return el.getAttribute("m:val") ?? el.getAttribute("val") ?? el.getAttribute("w:val") ?? "";
}
function hasProp(parent: XmlNodeLike | undefined, name: string): boolean {
  const el = parent ? kid(parent, name) : undefined;
  if (!el) return false;
  const v = el.getAttribute ? (el.getAttribute("m:val") ?? el.getAttribute("val")) : null;
  return v === null || v === "" || !/^(0|false|off)$/i.test(v); // phần tử không val = bật
}

const SYMBOLS: Record<string, string> = {
  "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ", "ε": "\\varepsilon ", "ϵ": "\\epsilon ", "ζ": "\\zeta ", "η": "\\eta ", "θ": "\\theta ", "ϑ": "\\vartheta ",
  "ι": "\\iota ", "κ": "\\kappa ", "λ": "\\lambda ", "μ": "\\mu ", "ν": "\\nu ", "ξ": "\\xi ", "π": "\\pi ", "ρ": "\\rho ", "σ": "\\sigma ", "τ": "\\tau ", "υ": "\\upsilon ",
  "φ": "\\varphi ", "ϕ": "\\phi ", "χ": "\\chi ", "ψ": "\\psi ", "ω": "\\omega ",
  "Γ": "\\Gamma ", "Δ": "\\Delta ", "∆": "\\Delta ", "Θ": "\\Theta ", "Λ": "\\Lambda ", "Ξ": "\\Xi ", "Π": "\\Pi ", "Σ": "\\Sigma ", "Φ": "\\Phi ", "Ψ": "\\Psi ", "Ω": "\\Omega ",
  "∞": "\\infty ", "≤": "\\le ", "≥": "\\ge ", "⩽": "\\le ", "⩾": "\\ge ", "≠": "\\ne ", "≈": "\\approx ", "≡": "\\equiv ", "±": "\\pm ", "∓": "\\mp ", "×": "\\times ", "÷": "\\div ", "·": "\\cdot ", "⋅": "\\cdot ", "∙": "\\cdot ",
  "→": "\\to ", "←": "\\leftarrow ", "↔": "\\leftrightarrow ", "⇒": "\\Rightarrow ", "⇐": "\\Leftarrow ", "⇔": "\\Leftrightarrow ", "⟹": "\\Rightarrow ", "⟺": "\\Leftrightarrow ",
  "∈": "\\in ", "∉": "\\notin ", "∋": "\\ni ", "⊂": "\\subset ", "⊃": "\\supset ", "⊆": "\\subseteq ", "⊇": "\\supseteq ", "∪": "\\cup ", "∩": "\\cap ", "∅": "\\emptyset ", "∖": "\\setminus ",
  "∀": "\\forall ", "∃": "\\exists ", "∂": "\\partial ", "∇": "\\nabla ", "∠": "\\angle ", "⊥": "\\perp ", "∥": "\\parallel ", "∼": "\\sim ", "≅": "\\cong ", "∝": "\\propto ", "∘": "\\circ ",
  "°": "^{\\circ}", "′": "'", "″": "''", "…": "\\ldots ", "⋯": "\\cdots ", "−": "-", "–": "-", "√": "\\sqrt{}", "ℝ": "\\mathbb{R}", "ℕ": "\\mathbb{N}", "ℤ": "\\mathbb{Z}", "ℚ": "\\mathbb{Q}", "ℂ": "\\mathbb{C}",
  "∑": "\\sum ", "∏": "\\prod ", "∫": "\\int ", "∬": "\\iint ", "∭": "\\iiint ", "∮": "\\oint ", "⋃": "\\bigcup ", "⋂": "\\bigcap ",
  "⁡": "", "​": "", " ": "~", "‖": "\\| ",
};
const LATEX_ESC: Record<string, string> = { "%": "\\%", "&": "\\&", "#": "\\#", "$": "\\$", "_": "\\_", "{": "\\{", "}": "\\}", "~": "\\~{}", "^": "\\^{}", "\\": "\\backslash " };
const FUNCS = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "coth", "log", "ln", "lg", "exp", "lim", "max", "min", "sup", "inf", "det", "gcd", "deg", "dim", "ker", "arg", "mod"]);
const NARY: Record<string, string> = { "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "∬": "\\iint", "∭": "\\iiint", "∮": "\\oint", "⋃": "\\bigcup", "⋂": "\\bigcap", "⨁": "\\bigoplus" };
const ACCENT: Record<string, string> = { "̂": "\\hat", "^": "\\hat", "̃": "\\tilde", "~": "\\tilde", "¯": "\\bar", "̅": "\\bar", "̄": "\\bar", "→": "\\vec", "⃗": "\\vec", "˙": "\\dot", "̇": "\\dot", "¨": "\\ddot", "̈": "\\ddot", "̌": "\\check", "́": "\\acute", "̀": "\\grave" };
const OPEN: Record<string, string> = { "(": "(", "[": "[", "{": "\\{", "|": "|", "‖": "\\|", "⟨": "\\langle ", "⌊": "\\lfloor ", "⌈": "\\lceil " };
const CLOSE: Record<string, string> = { ")": ")", "]": "]", "}": "\\}", "|": "|", "‖": "\\|", "⟩": "\\rangle ", "⌋": "\\rfloor ", "⌉": "\\rceil " };
/** Ký tự ngoặc của m:dPr → vế \left/\right. Thiếu thuộc tính = ngoặc tròn mặc định; chuỗi rỗng = không ngoặc ("."). */
function delimOne(ch: string | null, side: "l" | "r"): string {
  if (ch === null) return side === "l" ? "(" : ")";
  if (ch === "") return ".";
  return (side === "l" ? OPEN[ch] : CLOSE[ch]) ?? ".";
}

function textToLatex(t: string): string {
  let out = "";
  for (const ch of t) out += SYMBOLS[ch] ?? LATEX_ESC[ch] ?? ch;
  return out;
}

class Bail extends Error {}

function braces(s: string): string { return s.length === 1 && /[A-Za-z0-9]/.test(s) ? s : `{${s}}`; }

function kids2(n: XmlNodeLike, d: number): string {
  let out = "";
  for (const c of Array.from(n.childNodes)) out += node(c, d + 1);
  return out;
}
/** Nội dung của phần tử con `name` (m:e, m:num, m:sup…) dạng LaTeX; không có → "". */
function sub(n: XmlNodeLike, name: string, d: number): string {
  const el = kid(n, name);
  return el ? kids2(el, d).trim() : "";
}

function node(n: XmlNodeLike, d: number): string {
  if (d > MAX_DEPTH) throw new Bail("sâu");
  if (n.nodeType === 3) return ""; // chữ lẻ ngoài m:t (khoảng trắng giữa thẻ) bỏ qua
  if (n.nodeType !== 1) return "";
  const name = ln(n);
  switch (name) {
    case "oMath": case "oMathPara": case "e": case "num": case "den": case "deg": case "lim": case "fName": case "sup": case "sub": case "oMathParaPr":
      return name === "oMathParaPr" ? "" : kids2(n, d);
    case "r": {
      const rpr = kid(n, "rPr");
      const t = kidsNamed(n, "t").map(x => x.textContent ?? "").join("");
      if (!t) return "";
      if (hasProp(rpr, "nor")) return `\\text{${t.replace(/[\\{}$%&#_^~]/g, c => LATEX_ESC[c] ?? c)}}`;
      if (propVal(rpr, "sty") === "p" && /^\p{L}{2,}$/u.test(t)) return FUNCS.has(t) ? `\\${t} ` : `\\mathrm{${t}}`;
      return textToLatex(t);
    }
    case "t": return textToLatex(n.textContent ?? "");
    case "f": {
      const num = sub(n, "num", d), den = sub(n, "den", d);
      const type = propVal(kid(n, "fPr"), "type");
      if (type === "lin" || type === "skw") return `${braces(num)}/${braces(den)}`;
      if (type === "noBar") return `\\binom{${num}}{${den}}`;
      return `\\frac{${num}}{${den}}`;
    }
    case "rad": {
      const e = sub(n, "e", d), deg = sub(n, "deg", d);
      return hasProp(kid(n, "radPr"), "degHide") || !deg ? `\\sqrt{${e}}` : `\\sqrt[${deg}]{${e}}`;
    }
    case "sSup": return `{${sub(n, "e", d)}}^{${sub(n, "sup", d)}}`;
    case "sSub": return `{${sub(n, "e", d)}}_{${sub(n, "sub", d)}}`;
    case "sSubSup": return `{${sub(n, "e", d)}}_{${sub(n, "sub", d)}}^{${sub(n, "sup", d)}}`;
    case "sPre": return `{}_{${sub(n, "sub", d)}}^{${sub(n, "sup", d)}}{${sub(n, "e", d)}}`;
    case "nary": {
      const pr = kid(n, "naryPr");
      const chr = propVal(pr, "chr");
      const op = NARY[chr === null ? "∫" : chr] ?? (chr ? textToLatex(chr) : "");
      const lo = hasProp(pr, "subHide") ? "" : sub(n, "sub", d), hi = hasProp(pr, "supHide") ? "" : sub(n, "sup", d);
      return `${op}${lo ? `_{${lo}}` : ""}${hi ? `^{${hi}}` : ""}{${sub(n, "e", d)}}`;
    }
    case "d": {
      const pr = kid(n, "dPr");
      const l = delimOne(propVal(pr, "begChr"), "l"), r = delimOne(propVal(pr, "endChr"), "r");
      const sepRaw = propVal(pr, "sepChr");
      const sep = sepRaw === null ? "|" : sepRaw;
      const parts = kidsNamed(n, "e").map(e => kids2(e, d).trim());
      return `\\left${l}${parts.join(sep === "|" ? "\\middle|" : sep === "," ? "," : textToLatex(sep))}\\right${r}`;
    }
    case "func": {
      const fn = sub(n, "fName", d).replace(/\s+/g, "");
      const arg = sub(n, "e", d);
      const bare = fn.replace(/^\\mathrm\{(.*)\}$/, "$1").replace(/^\\/, "");
      const head = FUNCS.has(bare) ? `\\${bare}` : fn.startsWith("\\") ? fn : `\\operatorname{${fn}}`;
      return `${head} ${arg}`;
    }
    case "limLow": {
      const e = sub(n, "e", d), lim = sub(n, "lim", d);
      const bare = e.replace(/^\\mathrm\{(.*)\}$/, "$1").replace(/^\\/, "").trim();
      return FUNCS.has(bare) ? `\\${bare}_{${lim}}` : `\\underset{${lim}}{${e}}`;
    }
    case "limUpp": return `\\overset{${sub(n, "lim", d)}}{${sub(n, "e", d)}}`;
    case "acc": {
      const chr = propVal(kid(n, "accPr"), "chr");
      const cmd = ACCENT[chr === null ? "^" : chr] ?? "\\hat";
      return `${cmd}{${sub(n, "e", d)}}`;
    }
    case "bar": return propVal(kid(n, "barPr"), "pos") === "bot" ? `\\underline{${sub(n, "e", d)}}` : `\\overline{${sub(n, "e", d)}}`;
    case "borderBox": return `\\boxed{${sub(n, "e", d)}}`;
    case "groupChr": return sub(n, "e", d);
    case "box": case "phant": return sub(n, "e", d);
    case "m": {
      const rows = kidsNamed(n, "mr").map(mr => kidsNamed(mr, "e").map(e => kids2(e, d).trim()).join(" & "));
      return `\\begin{matrix}${rows.join(" \\\\ ")}\\end{matrix}`;
    }
    case "eqArr": {
      const rows = kidsNamed(n, "e").map(e => kids2(e, d).trim());
      return `\\begin{aligned}${rows.join(" \\\\ ")}\\end{aligned}`;
    }
    case "rPr": case "fPr": case "radPr": case "naryPr": case "dPr": case "accPr": case "barPr": case "ctrlPr": case "argPr": case "eqArrPr": case "mPr": case "groupChrPr": case "limLowPr": case "limUppPr": case "boxPr": case "borderBoxPr": case "phantPr": case "sSupPr": case "sSubPr": case "sSubSupPr": case "sPrePr": case "funcPr": case "mr_pr":
      return "";
    default:
      return kids2(n, d); // thẻ lạ: lấy phần chữ bên trong thay vì ném
  }
}

/** OMML → LaTeX (KHÔNG có dấu $ bao ngoài). Ném `Error` nếu hỏng — dùng `ommlToLatexSafe` ở nơi cần "không ném". */
export function ommlToLatex(root: XmlNodeLike): string {
  const out = node(root, 0).replace(/\s+/g, " ").trim();
  if (!out) throw new Bail("rỗng");
  if (out.length > MAX_LEN) throw new Bail("quá dài");
  return out;
}

/** Không bao giờ ném: hỏng/rỗng/quá sâu → { ok:false, latex: "⟦công thức⟧" }. */
export function ommlToLatexSafe(root: XmlNodeLike): { ok: boolean; latex: string } {
  try { return { ok: true, latex: ommlToLatex(root) }; }
  catch { return { ok: false, latex: FORMULA_PLACEHOLDER }; }
}
