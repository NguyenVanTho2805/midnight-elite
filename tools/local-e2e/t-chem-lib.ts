// BU-03 — CHỮ HOÁ HỌC qua đường nhập Word. THUẦN (không DB, không mạng; .docx dựng bằng jszip tại chỗ, công thức MathType dựng bằng mathtype-fixtures).
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-chem-lib.ts
// Phạm vi: (1) chữ chỉ số dưới/trên CỦA CHẠY CHỮ Word (w:vertAlign) → Unicode H₂O, CO₂, Ca²⁺, SO₄²⁻, C₆H₁₂O₆, Cₙ…; (2) mũi tên phản ứng → ⇌ giữ nguyên;
// (3) công thức MathType hoá học: kiểu "Text" → \text{} đứng, kiểu "Variable" → in nghiêng như bản Word, ⇌/mũi tên có chữ = chưa kiểm → ảnh dự phòng; (4) KaTeX \mathrm{} dựng đúng (đứng, không in nghiêng).
// Ca phá cố ý (sửa mã → ca tương ứng đỏ):
//   - azotaDocx.ts SUP: bỏ "–" (U+2013) → ca 'SO₄²– (gạch ngang)' đỏ; SUB: bỏ chữ cái (n,x,…) → ca 'CₙH₂ₙ₊₂' đỏ; bỏ dòng `wrapped` (luôn bọc thêm ngoặc) → ca 'X_(aq)' đỏ;
//   - aiExamImport.ts: xoá đoạn 'Ký hiệu hoá học' hoặc đổi \\\\mathrm thành \\mathrm (mất backslash) → ca 'Prompt AI' đỏ;
//   - scriptText bỏ `|| r.formula` bảo vệ công thức / bỏ nhánh dự phòng (mất ký tự lạ) → ca 'không mất chữ' đỏ.
import JSZip from "jszip";
import katex from "katex";
import { check, section, done } from "./h";
import { readDocx } from "@/lib/azotaDocxRead";
import { parseAzotaBlocks, type DocBlock } from "@/lib/azotaDocx";
import { decodeMathTypeOle } from "@/lib/mathtype/mtef";
import { SYSTEM_INSTRUCTION } from "@/lib/aiExamImport";
import { chr, line, num, oleOf, sub, sup, sym, text, tmpl, vars, emptyLine, type Bytes } from "./mathtype-fixtures";

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R = (t: string, v?: "sup" | "sub") => `<w:r>${v ? `<w:rPr><w:vertAlign w:val="${v === "sup" ? "superscript" : "subscript"}"/></w:rPr>` : ""}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const P = (...x: string[]) => `<w:p>${x.join("")}</w:p>`;
async function essay(paras: string[]): Promise<string[]> {
  const z = new JSZip(); z.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  z.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${P(R("PHẦN III. Tự luận. Thí sinh trả lời từ câu 1 đến câu " + paras.length + "."))}${paras.map((p, i) => P(R(`Câu ${i + 1}. `)) .replace("</w:p>", "") + p + "</w:p>").join("")}</w:body></w:document>`);
  const read = await readDocx(await z.generateAsync({ type: "nodebuffer" }));
  return parseAzotaBlocks(read.blocks).questions.map(q => q.text);
}
const SUPB = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ", SUPA = "0123456789+-=()ni", SUBB = "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₕₖₗₘₙₚₛₜ", SUBA = "0123456789+-=()aeoxhklmnpst";
const unscript = (s: string) => [...s].map(c => (SUPB.includes(c) ? SUPA[[...SUPB].indexOf(c)] : SUBB.includes(c) ? SUBA[[...SUBB].indexOf(c)] : c)).join("");

(async () => {
  section("Chạy chữ Word: chỉ số dưới/trên → Unicode (đọc bằng readDocx + parseAzotaBlocks thật)");
  const T = await essay([
    R("Phân tử H") + R("2", "sub") + R("O và CO") + R("2", "sub") + R("; glucose C") + R("6", "sub") + R("H") + R("12", "sub") + R("O") + R("6", "sub") + R("."),
    R("Ion Ca") + R("2+", "sup") + R(", Fe") + R("3+", "sup") + R(", SO") + R("4", "sub") + R("2−", "sup") + R(", PO") + R("4", "sub") + R("3-", "sup") + R(", NH") + R("4", "sub") + R("+", "sup") + R("."),
    R("Ion SO") + R("4", "sub") + R("2–", "sup") + R(" (gạch ngang U+2013 như Word thường gõ)"),
    R("Ankan C") + R("n", "sub") + R("H") + R("2n+2", "sub") + R(", A") + R("max", "sub") + R(", x") + R("n", "sup"),
    R("6CO") + R("2", "sub") + R(" + 6H") + R("2", "sub") + R("O → C") + R("6", "sub") + R("H") + R("12", "sub") + R("O") + R("6", "sub") + R(" + 6O") + R("2", "sub") + R("; N") + R("2", "sub") + R(" + 3H") + R("2", "sub") + R(" ⇌ 2NH") + R("3", "sub"),
    R("Trạng thái X") + R("(aq)", "sub") + R(", Y") + R("q", "sub") + R(", z") + R("a", "sup"),
  ]);
  const body = (i: number) => (T[i] ?? "").replace(/^Câu \d+\.\s*/, "");
  check("đọc được 6 câu", T.length === 6, T);
  check("H₂O, CO₂, C₆H₁₂O₆", body(0) === "Phân tử H₂O và CO₂; glucose C₆H₁₂O₆.", body(0));
  check("ion Ca²⁺ Fe³⁺ SO₄²⁻ PO₄³⁻ NH₄⁺", body(1) === "Ion Ca²⁺, Fe³⁺, SO₄²⁻, PO₄³⁻, NH₄⁺.", body(1));
  check("SO₄²– (gạch ngang U+2013) → ²⁻, không ra ^(2–)", body(2).startsWith("Ion SO₄²⁻ ") && !body(2).includes("^("), body(2));
  check("CₙH₂ₙ₊₂, Aₘₐₓ, xⁿ (chữ cái chỉ số)", body(3) === "Ankan CₙH₂ₙ₊₂, Aₘₐₓ, xⁿ", body(3));
  check("phương trình: → và ⇌ giữ nguyên, chỉ số đủ", body(4) === "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂; N₂ + 3H₂ ⇌ 2NH₃", body(4));
  check("ký tự không có dạng Unicode (q, a trên) → ^(…)/_(…) đọc được, không mất chữ, không ngoặc đôi", body(5) === "Trạng thái X_(aq), Y_(q), z^(a)", body(5));
  check("KHÔNG MẤT CHỮ: bỏ dấu chỉ số Unicode thì ra đúng chuỗi gõ (H2O, Ca2+, SO42-, C6H12O6, CnH2n+2…)", unscript(body(1)) === "Ion Ca2+, Fe3+, SO42-, PO43-, NH4+." && unscript(body(3)) === "Ankan CnH2n+2, Amax, xn" && unscript(body(0)) === "Phân tử H2O và CO2; glucose C6H12O6.", [unscript(body(0)), unscript(body(1)), unscript(body(3))]);

  section("DocBlock dựng tay: chữ trong công thức (formula) KHÔNG bị đổi; chạy rỗng/khoảng trắng không vỡ");
  {
    const blocks: DocBlock[] = [
      { kind: "p", runs: [{ text: "PHẦN III. Tự luận. Thí sinh trả lời từ câu 1 đến câu 1." }] },
      { kind: "p", runs: [{ text: "Câu 1. Nhóm " }, { text: "OH", sub: false }, { text: "2", sub: true }, { text: " ", sub: true }, { text: "", sub: true }, { text: "$x^{2}$", formula: "omml", latex: "x^{2}", sup: true }] },
    ];
    const q = parseAzotaBlocks(blocks).questions[0];
    check("chạy sub có khoảng trắng/rỗng: ra ₂ + khoảng trắng; công thức giữ $x^{2}$ nguyên (không đổi thành ²)", q?.text.includes("OH₂") && q.text.includes("$x^{2}$"), q?.text);
  }

  section("Công thức MathType hoá học (MTEF dựng tay) → LaTeX");
  const L = (c: Bytes) => { const d = decodeMathTypeOle(oleOf(c)); return d.ok ? { latex: d.latex, unv: d.warnings.includes("unverified_structure") } : { latex: "FAIL:" + (d as { reason: string }).reason, unv: false }; };
  const T1 = (s: string) => text(1, s);
  const h2o = L([T1("H"), sub(num("2")), T1("O")].flat()), co2 = L([T1("CO"), sub(num("2"))].flat()), ca = L([T1("Ca"), sup([num("2"), sym(0x2b)].flat())].flat());
  const so4 = L([T1("SO"), sub(num("4")), sup([num("2"), sym(0x2212)].flat())].flat()), glu = L([T1("C"), sub(num("6")), T1("H"), sub(num("12")), T1("O"), sub(num("6"))].flat());
  check("H₂O kiểu Text → \\text{H}_{2}\\text{O} (chữ đứng)", h2o.latex === "\\text{H}_{2}\\text{O}" && !h2o.unv, h2o);
  check("CO₂ → \\text{CO}_{2}", co2.latex === "\\text{CO}_{2}", co2);
  check("Ca²⁺ → \\text{Ca}^{2+}", ca.latex === "\\text{Ca}^{2+}" && !ca.unv, ca);
  check("SO₄²⁻ → \\text{SO}_{4}^{2-}", so4.latex === "\\text{SO}_{4}^{2-}", so4);
  check("C₆H₁₂O₆ → từng nguyên tố có chỉ số riêng", glu.latex === "\\text{C}_{6}\\text{H}_{12}\\text{O}_{6}", glu);
  check("kiểu Variable (in nghiêng ở Word) → H_{2}O: giữ in nghiêng như bản gốc, không tự đổi thành đứng", L([vars("H"), sub(num("2")), vars("O")].flat()).latex === "H_{2}O");
  const arr = L([T1("A"), sym(0x2192), T1("B")].flat()), eq = L([T1("N"), sub(num("2")), sym(0x2b), T1("3H"), sub(num("2")), sym(0x21cc), T1("2NH"), sub(num("3"))].flat());
  const lab = L([T1("A"), tmpl(14, 4, line(T1("xt")), emptyLine(), chr(22, 0x2192)), T1("B")].flat());
  check("mũi tên → : \\to, chắc", arr.latex === "\\text{A}\\to \\text{B}" && !arr.unv, arr);
  check("⇌ (cân bằng): ra \\rightleftharpoons nhưng CHƯA KIỂM bằng mẫu thật → cờ unverified (đi ảnh dự phòng, không tự tin)", eq.latex.includes("\\rightleftharpoons") && eq.unv, eq);
  check("mũi tên có chữ trên (xúc tác) \\xrightarrow{\\text{xt}}: cũng chưa kiểm → cờ unverified", lab.latex.includes("\\xrightarrow{\\text{xt}}") && lab.unv, lab);

  section("KaTeX dựng đúng: \\mathrm{} đứng, không in nghiêng; không có \\mathrm thì chữ bị nghiêng (lý do cần)");
  const FORM = ["\\mathrm{H_2O}", "\\mathrm{CO_2}", "\\mathrm{Ca^{2+}}", "\\mathrm{SO_4^{2-}}", "\\mathrm{C_6H_{12}O_6}", "\\mathrm{6CO_2+6H_2O\\to C_6H_{12}O_6+6O_2}", "\\mathrm{N_2+3H_2\\rightleftharpoons 2NH_3}", "\\mathrm{CaCO_3\\xrightarrow{t^\\circ}CaO+CO_2\\uparrow}", "\\text{H}_{2}\\text{O}", "\\text{Ca}^{2+}", "\\text{SO}_{4}^{2-}"];
  for (const f of FORM) {
    let ok = false, html = ""; try { html = katex.renderToString(f, { throwOnError: true, strict: "error" }); ok = true; } catch { /* ok=false */ }
    check(`${f}: dựng được (strict) và không có chữ in nghiêng (mathnormal)`, ok && !html.includes("mathnormal"), ok ? undefined : "lỗi dựng");
  }
  check("PHÁ: không bọc \\mathrm thì H_2O dựng chữ nghiêng (mathnormal) — đúng lý do phải bọc", katex.renderToString("H_2O", { throwOnError: true }).includes("mathnormal"));
  check("mọi LaTeX hoá học do bộ giải MathType ra đều dựng được ở KaTeX strict", [h2o, co2, ca, so4, glu, arr, eq, lab].every(r => { try { katex.renderToString(r.latex, { throwOnError: true, strict: "error" }); return true; } catch { return false; } }));

  section("Prompt AI (aiExamImport) có quy tắc ký hiệu hoá học — CHỈ kiểm chuỗi prompt; CHƯA kiểm với khoá Gemini thật (máy này không có GEMINI_API_KEY)");
  {
    const rule = SYSTEM_INSTRUCTION.split("\n").find(l => l.startsWith("Ký hiệu hoá học")) ?? "";
    check("có đoạn 'Ký hiệu hoá học'", rule.length > 0);
    check("nêu ví dụ Unicode H₂O, CO₂, Ca²⁺, SO₄²⁻, C₆H₁₂O₆ và mũi tên → ⇌", ["H₂O", "CO₂", "Ca²⁺", "SO₄²⁻", "C₆H₁₂O₆", "→", "⇌"].every(x => rule.includes(x)), rule);
    check("nêu \\mathrm{H_2O} trong $...$ (backslash còn nguyên sau khi qua template literal) và cấm in nghiêng", rule.includes("$\\mathrm{H_2O}$") && rule.includes("KHÔNG in nghiêng"), rule);
    check("dặn giữ chỉ số trên/dưới, không viết lại H2O/Ca2+", rule.includes("giữ NGUYÊN chỉ số trên/dưới") && rule.includes("H2O") && rule.includes("Ca2+"));
    check("PHÁ: ví dụ \\mathrm trong prompt dựng được ở KaTeX strict, không nghiêng", ["\\mathrm{H_2O}", "\\mathrm{Ca^{2+}}", "\\mathrm{SO_4^{2-}}", "\\mathrm{CO_2}"].every(f => !katex.renderToString(f, { throwOnError: true, strict: "error" }).includes("mathnormal")));
    check("quy tắc LaTeX toán cũ còn nguyên (không bị ghi đè)", SYSTEM_INSTRUCTION.includes("Công thức toán: giữ nguyên dạng LaTeX"));
  }

  await done();
})();
