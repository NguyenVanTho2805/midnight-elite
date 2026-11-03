// BU-03 P1 — công thức Word OMML → LaTeX (src/lib/ommlLatex.ts). THUẦN: xmldom chỉ dùng để dựng nút đầu vào trong bài; lib không phụ thuộc XML.
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-omml-latex-lib.ts
// Ca phá cố ý (sửa mã → ca đỏ):
//   - bỏ `if (d > MAX_DEPTH) throw` → ca "lồng 60 tầng → nhãn ⟦công thức⟧" đỏ (hoặc tràn ngăn xếp);
//   - ommlToLatexSafe không bắt lỗi → các ca "hỏng/rỗng không ném" đỏ;
//   - trong `f` đổi \\frac thành \\over → ca phân số đỏ; bỏ LATEX_ESC → ca "% & _ { }" đỏ;
//   - ở `nary` bỏ nhận subHide/supHide → ca tích phân không cận đỏ.
import { DOMParser } from "@xmldom/xmldom";
import { check, section, done } from "./h";
import { FORMULA_PLACEHOLDER, ommlToLatex, ommlToLatexSafe, type XmlNodeLike } from "@/lib/ommlLatex";

const M = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const r = (t: string) => `<m:r><m:t>${t}</m:t></m:r>`;
const root = (x: string) => new DOMParser().parseFromString(`<m:oMath ${M}>${x}</m:oMath>`, "text/xml").documentElement as unknown as XmlNodeLike;
const tex = (x: string) => ommlToLatexSafe(root(x));

(async () => {
  section("Cấu trúc cơ bản");
  check("phân số 1/2", tex(`<m:f><m:num>${r("1")}</m:num><m:den>${r("2")}</m:den></m:f>`).latex === "\\frac{1}{2}");
  check("căn bậc hai (degHide) và căn bậc ba", tex(`<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${r("x")}</m:e></m:rad>`).latex === "\\sqrt{x}" && tex(`<m:rad><m:deg>${r("3")}</m:deg><m:e>${r("x")}</m:e></m:rad>`).latex === "\\sqrt[3]{x}");
  check("mũ, chỉ số dưới, vừa mũ vừa chỉ số", tex(`<m:sSup><m:e>${r("x")}</m:e><m:sup>${r("2")}</m:sup></m:sSup>`).latex === "{x}^{2}" && tex(`<m:sSub><m:e>${r("a")}</m:e><m:sub>${r("n")}</m:sub></m:sSub>`).latex === "{a}_{n}" && tex(`<m:sSubSup><m:e>${r("x")}</m:e><m:sub>${r("i")}</m:sub><m:sup>${r("2")}</m:sup></m:sSubSup>`).latex === "{x}_{i}^{2}");
  check("tổng Σ có cận", tex(`<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub>${r("i=1")}</m:sub><m:sup>${r("n")}</m:sup><m:e>${r("i")}</m:e></m:nary>`).latex === "\\sum_{i=1}^{n}{i}");
  check("tích phân mặc định (không chr) có cận 0..1", tex(`<m:nary><m:naryPr><m:supHide m:val="0"/></m:naryPr><m:sub>${r("0")}</m:sub><m:sup>${r("1")}</m:sup><m:e>${r("x")}</m:e></m:nary>`).latex === "\\int_{0}^{1}{x}");
  check("PHÁ: tích phân ẩn cận (subHide/supHide=1) không để lại _{} ^{} rỗng", tex(`<m:nary><m:naryPr><m:chr m:val="∫"/><m:subHide m:val="1"/><m:supHide m:val="1"/></m:naryPr><m:sub/><m:sup/><m:e>${r("f(x)dx")}</m:e></m:nary>`).latex === "\\int{f(x)dx}");
  check("tổ hợp \\binom (noBar) và phân số ngang a/b (lin)", tex(`<m:f><m:fPr><m:type m:val="noBar"/></m:fPr><m:num>${r("n")}</m:num><m:den>${r("k")}</m:den></m:f>`).latex === "\\binom{n}{k}" && tex(`<m:f><m:fPr><m:type m:val="lin"/></m:fPr><m:num>${r("a")}</m:num><m:den>${r("b")}</m:den></m:f>`).latex === "a/b");

  section("Ngoặc, ma trận, hệ phương trình, hàm, giới hạn");
  check("ngoặc tròn mặc định", tex(`<m:d><m:e>${r("a")}</m:e></m:d>`).latex === "\\left(a\\right)");
  check("giá trị tuyệt đối |x|", tex(`<m:d><m:dPr><m:begChr m:val="|"/><m:endChr m:val="|"/></m:dPr><m:e>${r("x")}</m:e></m:d>`).latex === "\\left|x\\right|");
  check("ma trận 2×2 trong ngoặc tròn", tex(`<m:d><m:e><m:m><m:mr><m:e>${r("1")}</m:e><m:e>${r("2")}</m:e></m:mr><m:mr><m:e>${r("3")}</m:e><m:e>${r("4")}</m:e></m:mr></m:m></m:e></m:d>`).latex === "\\left(\\begin{matrix}1 & 2 \\\\ 3 & 4\\end{matrix}\\right)");
  check("hệ phương trình: ngoặc nhọn trái, bên phải rỗng → \\right.", tex(`<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr><m:e><m:eqArr><m:e>${r("x+y=1")}</m:e><m:e>${r("x-y=3")}</m:e></m:eqArr></m:e></m:d>`).latex === "\\left\\{\\begin{aligned}x+y=1 \\\\ x-y=3\\end{aligned}\\right.");
  check("ngăn cách tuỳ chọn ';' giữa hai biểu thức", tex(`<m:d><m:dPr><m:sepChr m:val=";"/></m:dPr><m:e>${r("1")}</m:e><m:e>${r("2")}</m:e></m:d>`).latex === "\\left(1;2\\right)");
  check("hàm sin x và lim x→0", tex(`<m:func><m:fName>${r("sin")}</m:fName><m:e>${r("x")}</m:e></m:func>`).latex === "\\sin x" && tex(`<m:limLow><m:e>${r("lim")}</m:e><m:lim>${r("x→0")}</m:lim></m:limLow>`).latex === "\\lim_{x\\to 0}");
  check("dấu véc-tơ và gạch trên", tex(`<m:acc><m:accPr><m:chr m:val="→"/></m:accPr><m:e>${r("AB")}</m:e></m:acc>`).latex === "\\vec{AB}" && tex(`<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${r("AB")}</m:e></m:bar>`).latex === "\\overline{AB}");

  section("Chữ, ký hiệu");
  check("chữ Hy Lạp và so sánh: α+β≤π", tex(r("α+β≤π")).latex === "\\alpha +\\beta \\le \\pi");
  check("PHÁ: ký tự đặc biệt của LaTeX được thoát (% & _ { })", tex(r("50% & x_1 {a}")).latex === "50\\% \\& x\\_1 \\{a\\}");
  check("chữ thường (m:nor) vào \\text", tex(`<m:r><m:rPr><m:nor/></m:rPr><m:t>cm²</m:t></m:r>`).latex === "\\text{cm²}");
  check("thẻ lạ không làm hỏng: lấy chữ bên trong", tex(`<m:foo>${r("z")}</m:foo>`).latex === "z");
  check("lồng nhau: tổng của phân số", tex(`<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub>${r("k=1")}</m:sub><m:sup>${r("n")}</m:sup><m:e><m:f><m:num>${r("1")}</m:num><m:den><m:sSup><m:e>${r("k")}</m:e><m:sup>${r("2")}</m:sup></m:sSup></m:den></m:f></m:e></m:nary>`).latex === "\\sum_{k=1}^{n}{\\frac{1}{{k}^{2}}}");

  section("Hỏng → nhãn, không ném");
  const empty = tex(""), deep = tex("<m:sSup><m:e>".repeat(60) + r("x") + "</m:e><m:sup/></m:sSup>".repeat(60));
  check("công thức rỗng → { ok:false, nhãn ⟦công thức⟧ }", !empty.ok && empty.latex === FORMULA_PLACEHOLDER, empty);
  check("PHÁ: lồng 60 tầng (vượt giới hạn) → nhãn, không tràn ngăn xếp", !deep.ok && deep.latex === FORMULA_PLACEHOLDER, deep.latex.slice(0, 40));
  check("ommlToLatex (bản không an toàn) ném khi rỗng, bản Safe không ném", (() => { try { ommlToLatex(root("")); return false; } catch { return true; } })() && (() => { try { ommlToLatexSafe(root("")); return true; } catch { return false; } })());
  check("nút lạ không phải phần tử (chỉ văn bản) → không ném", (() => { try { const d = new DOMParser().parseFromString("<a>chữ</a>", "text/xml"); return ommlToLatexSafe(d.documentElement as unknown as XmlNodeLike).latex.length > 0; } catch { return false; } })());
  check("công thức quá dài (> 5000 ký tự) → nhãn", !tex(r("x".repeat(6000))).ok);

  await done();
})();
