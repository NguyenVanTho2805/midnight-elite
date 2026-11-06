// BU-03-MATHTYPE — chuẩn hoá LaTeX CHỈ để so sánh cấu trúc với TeX gốc (công cụ kiểm kho mẫu): cây token, bỏ khoảng trắng, left/right, text, ngoặc nhóm dư.
type T = string | { g: T[] };
const SYN: Record<string, string> = { stackrel: "overset", bot: "perp", widehat: "hat", widetilde: "tilde", bar: "overline", bmod: "mod", Bbb: "mathbb", mathcal: "mathcal",  le: "leq", ge: "geq", ne: "neq", rightarrow: "to", longrightarrow: "to", Longrightarrow: "Rightarrow", dots: "ldots", lbrace: "{", rbrace: "}", Bbb: "mathbb", land: "wedge", lor: "vee", lnot: "neg", iff: "Leftrightarrow", implies: "Rightarrow", dfrac: "frac", tfrac: "frac", varnothing: "emptyset", lt: "<", gt: ">", mid: "|", vert: "|", Vert: "\\|", cdotp: "cdot", textbackslash: "backslash", mathit: "", mathrm: "", mathsf: "", textit: "", textrm: "", text: "", operatorname: "", mathnormal: "", boldsymbol: "", bm: "", mathbf: "" };
const DROP = new Set(["left", "right", ",", " ", ";", "!", ":", "quad", "qquad", "hspace", "displaystyle", "limits", "nolimits", "big", "Big", "bigg", "Bigg", "bigl", "bigr", "Bigl", "Bigr", "biggl", "biggr", "Biggl", "Biggr", "nonumber", "mathop", "mathbin", "mathrel", "mathord"]);
export function tokenize(s: string): string[] {
  const out: string[] = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c) || c === "~") { i++; continue; }
    if (c === "\\") {
      const m = /^\\([A-Za-z]+)/.exec(s.slice(i, i + 40));
      if (m) { out.push("\\" + m[1]); i += m[0].length; } else { out.push("\\" + (s[i + 1] ?? "")); i += 2; }
      continue;
    }
    out.push(c); i++;
  }
  return out;
}
function parseGroup(tk: string[], p: { i: number }): T[] {
  const res: T[] = [];
  while (p.i < tk.length) {
    const t = tk[p.i++];
    if (t === "{") res.push({ g: parseGroup(tk, p) });
    else if (t === "}") return res;
    else res.push(t);
  }
  return res;
}
function clean(list: T[]): T[] {
  const out: T[] = [];
  for (let k = 0; k < list.length; k++) {
    const t = list[k];
    if (typeof t !== "string") { out.push({ g: clean(t.g) }); continue; }
    if (t.startsWith("\\")) {
      let name = t.slice(1);
      if (DROP.has(name)) continue;
      if (name in SYN) { name = SYN[name]; if (!name) continue; }
      if (name === "begin" || name === "end") { const nx = list[k + 1]; if (nx && typeof nx !== "string") { k++; const e = nx.g.join(""); if (e === "array" || e === "align" || e === "aligned" || e === "cases" || e === "matrix" || e === "pmatrix" || e === "bmatrix" || e === "split" || e === "gathered" || e==="eqnarray") { if (name === "begin" && e === "array") { const sp = list[k + 1]; if (sp && typeof sp !== "string") k++; } continue; } } continue; }
      out.push(name.length === 1 && !/[A-Za-z]/.test(name) ? name : "\\" + name); continue;
    }
    if (t === "&") continue;
    if (t === "'") { out.push("^", { g: ["\\prime"] }); continue; }
    out.push(t);
  }
  return out;
}

const ARG2 = new Set(["\\frac", "\\binom", "\\overset", "\\underset"]);
const ARG1 = new Set(["\\sqrt", "\\overline", "\\underline", "\\vec", "\\overrightarrow", "\\overleftarrow", "\\overleftrightarrow", "\\hat", "\\bar", "\\tilde", "\\widehat", "\\widetilde", "\\dot", "\\ddot", "\\xrightarrow", "\\xleftarrow", "\\mathbb", "\\mathcal", "\\boxed", "\\cancel"]);
const SYN2: Record<string, string> = { "\\vec": "\\overrightarrow" };
function seq(list: T[]): string {
  const l = clean(list); const items: string[] = [];
  const argOf = (k: number): [string, number] => { // trả [chuỗi, số phần tử tiêu thụ]
    const a = l[k]; if (a === undefined) return ["", 0];
    let inner: string;
    if (typeof a === "string") { if (a === "[" ) { return [a, 1]; } inner = a; }
    else inner = seq(a.g);
    return [/\s/.test(inner) ? "{" + inner + "}" : inner, 1];
  };
  for (let k = 0; k < l.length; k++) {
    const t = l[k];
    if (typeof t !== "string") { items.push(seq(t.g)); continue; }
    if (t === "^" || t === "_") { const [a, n] = argOf(k + 1); items.push(t + a); k += n; continue; }
    if (ARG1.has(t) || ARG2.has(t)) {
      let head = SYN2[t] ?? t; k++;
      if (t === "\\sqrt" && l[k] === "[") { let o = "["; k++; while (k < l.length && l[k] !== "]") { o += typeof l[k] === "string" ? l[k] : "{" + seq((l[k] as any).g) + "}"; k++; } head += o + "]"; k++; }
      const [a, n] = argOf(k); let out = head + " " + a; k += n - 1;
      if (ARG2.has(t)) { const [b, m] = argOf(k + 1); out += " " + b; k += m; }
      items.push(out); continue;
    }
    items.push(t);
  }
  const fin: string[] = [];
  for (let k = 0; k < items.length; k++) { const a = items[k], b = items[k + 1]; if (a[0] === "^" && b?.[0] === "_") { fin.push(b, a); k++; } else fin.push(a); }
  return fin.join(" ").replace(/\s+/g, " ").trim();
}
export function normTex(s: string): string { return seq(parseGroup(tokenize(s.replace(/\\\\\s*\\end/g, "\\end").replace(/\\bmod\b/g, "mod").replace(/\\mod\b/g, "mod").replace(/\\(mathrm|text)\{\s*mod\s*\}/g, "mod")), { i: 0 })); }
