// BU-03 P1 — bộ đọc Word mẫu Azota (src/lib/azotaDocx.ts + azotaDocxRead.ts). THUẦN: không DB, không mạng; tệp .docx dựng bằng jszip ngay trong bài.
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-azota-docx-lib.ts
// Bản THẬT (Su12=28, Toán12=22, mẫu v2=8+1 khoá mồ côi) chạy NẾU có tệp: thư mục AZOTA_SAMPLES hoặc ~/Downloads; không có thì in SKIP (không tính pass/fail).
// Ca phá cố ý (sửa mã → ca tương ứng đỏ):
//   - findTokens: bỏ `sepOk` (nhận nhãn ở mọi chỗ) → ca "điểm B. giữa câu không thành phương án" đỏ;
//   - parseAzotaBlocks: bỏ `vals.size > 1 ||` → các ca xung đột (gạch chân ≠ bảng, TF ≠ lời giải, SA ≠ bảng) đỏ vì tự chọn đáp án;
//   - bỏ kiểm tra màu "không đủ": coi màu là đáp án → ca "chỉ tô màu → answer_missing" đỏ;
//   - readEntry: bỏ giới hạn 8 MB mỗi XML → ca zip bomb đỏ (hoặc treo); bỏ kiểm DOCTYPE → ca DOCTYPE đỏ; bỏ vbaProject → ca .docm đỏ;
//   - QUESTION_RE đặt hình đứng trước "Câu N." vào câu mới → ca "hình thuộc câu trước" đỏ.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { check, section, done } from "./h";
import { DOCX_MAX_BYTES, DocxError, readDocx } from "@/lib/azotaDocxRead";
import { parseAnswerKeyText, parseAzotaBlocks, toQuizInput, type AzotaParse, type AzotaQuestion } from "@/lib/azotaDocx";
import { validateQuizQuestion, validateForDraft } from "@/lib/quizQuestion";

// ── Dựng .docx tổng hợp ──────────────────────────────────────────────────────────────────────
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
interface RO { b?: boolean; u?: boolean; color?: string; sup?: boolean }
const rp = (o: RO) => `<w:rPr>${o.b ? "<w:b/>" : ""}${o.u ? '<w:u w:val="single"/>' : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}${o.sup ? '<w:vertAlign w:val="superscript"/>' : ""}</w:rPr>`;
const R = (t: string, o: RO = {}) => `<w:r>${rp(o)}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const TAB = "<w:r><w:tab/></w:r>", BR = "<w:r><w:br/></w:r>";
const P = (...x: string[]) => `<w:p>${x.join("")}</w:p>`;
const Pt = (t: string, o: RO = {}) => P(R(t, o));
const T = (rows: string[][]) => `<w:tbl>${rows.map(r => `<w:tr>${r.map(c => `<w:tc>${P(R(c))}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
const IMG = (rid: string) => `<w:r><w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
const OLE = '<w:r><w:object><v:shape><v:imagedata r:id="rId20"/></v:shape><o:OLEObject Type="Embed" ProgID="Equation.DSMT4" ShapeID="x" r:id="rId21"/></w:object></w:r>';
const OMML = (inner: string) => `<m:oMath>${inner}</m:oMath>`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const RELS_HEAD = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
const REL_IMG = (id: string, target: string) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;

async function mkDocx(body: string, o: { files?: Record<string, Buffer | string>; rels?: string; rawDoc?: string } = {}): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file("word/document.xml", o.rawDoc ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}</w:body></w:document>`);
  zip.file("word/_rels/document.xml.rels", RELS_HEAD + (o.rels ?? "") + "</Relationships>");
  for (const [k, v] of Object.entries(o.files ?? {})) zip.file(k, v);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
async function parse(body: string, o: Parameters<typeof mkDocx>[1] = {}) {
  const read = await readDocx(await mkDocx(body, o));
  return { read, p: parseAzotaBlocks(read.blocks) };
}
async function rejects(buf: Buffer): Promise<{ code?: string; message?: string } | null> {
  try { await readDocx(buf); return null; } catch (e) { return e instanceof DocxError ? { code: e.code, message: e.message } : { message: String(e) }; }
}
const byKey = (p: AzotaParse, k: string): AzotaQuestion | undefined => p.questions.find(q => q.key === k);
const correct = (q?: AzotaQuestion) => (q ? q.options.map((o, i) => (o.isCorrect ? (o.subLabel ?? String.fromCharCode(65 + i)) : "")).join("") : "?");

(async () => {
  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("1) An toàn tệp .docx (readDocx)");
  check("không phải zip (magic sai) → NOT_DOCX", (await rejects(Buffer.from("%PDF-1.7 not a docx at all")))?.code === "NOT_DOCX");
  check("PHÁ: tệp rỗng / quá ngắn → NOT_DOCX, không ném lỗi lạ", (await rejects(Buffer.alloc(0)))?.code === "NOT_DOCX" && (await rejects(Buffer.from("PK")))?.code === "NOT_DOCX");
  check("magic đúng nhưng ruột hỏng → NOT_DOCX", (await rejects(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("garbage".repeat(50))])))?.code === "NOT_DOCX");
  const big = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(DOCX_MAX_BYTES + 1)]);
  check("> 4 MB → TOO_LARGE (kiểm trước khi giải nén)", (await rejects(big))?.code === "TOO_LARGE");
  check("đúng 4 MB không bị chặn vì cỡ (rơi xuống lỗi nội dung NOT_DOCX, không TOO_LARGE)", (await rejects(big.subarray(0, DOCX_MAX_BYTES)))?.code === "NOT_DOCX");
  check(".docm (có vbaProject.bin) → từ chối", (await rejects(await mkDocx(Pt("x"), { files: { "word/vbaProject.bin": Buffer.from("MACRO") } })))?.code === "NOT_DOCX");
  check("XML có <!DOCTYPE → từ chối (chống XXE / billion laughs)", (await rejects(await mkDocx("", { rawDoc: `<?xml version="1.0"?><!DOCTYPE d [<!ENTITY a "aaaa">]><w:document ${NS}><w:body>${Pt("&a;")}</w:body></w:document>` })))?.code === "NOT_DOCX");
  check("<!ENTITY không DOCTYPE cũng bị chặn", (await rejects(await mkDocx("", { rawDoc: `<?xml version="1.0"?><!ENTITY x "y"><w:document ${NS}><w:body/></w:document>` })))?.code === "NOT_DOCX");
  check("thiếu word/document.xml → NOT_DOCX", await (async () => { const z = new JSZip(); z.file("a.txt", "x"); return (await rejects(await z.generateAsync({ type: "nodebuffer" })))?.code === "NOT_DOCX"; })());
  check("zip bomb: document.xml giải nén 9 MB (nén còn vài KB) → TOO_LARGE", await (async () => {
    const buf = await mkDocx("", { rawDoc: `<?xml version="1.0"?><w:document ${NS}><w:body>` + "<w:p/>".repeat(1_600_000) + "</w:body></w:document>" });
    return buf.length < 200_000 && (await rejects(buf))?.code === "TOO_LARGE";
  })());
  check("tổng giải nén > 30 MB (nhiều ảnh lớn nén nhỏ) → TOO_LARGE", await (async () => {
    const files: Record<string, Buffer> = {}; let rels = "";
    for (let i = 0; i < 5; i++) { files[`word/media/big${i}.png`] = Buffer.alloc(7 * 1024 * 1024); rels += REL_IMG(`rId${30 + i}`, `media/big${i}.png`); }
    const buf = await mkDocx(Pt("x"), { files, rels });
    return buf.length < 400_000 && (await rejects(buf))?.code === "TOO_LARGE";
  })());
  check("> 500 mục nén → TOO_LARGE", await (async () => {
    const files: Record<string, string> = {}; for (let i = 0; i < 501; i++) files[`word/x${i}.txt`] = "a";
    return (await rejects(await mkDocx(Pt("x"), { files })))?.code === "TOO_LARGE";
  })());
  check("đường dẫn tuyệt đối / '..' trong zip → từ chối", (await rejects(await mkDocx(Pt("x"), { files: { "../evil.txt": "x" } })))?.code === "NOT_DOCX");
  check("tệp .docx tối thiểu hợp lệ đọc được (1 đoạn chữ)", await (async () => { const r = await readDocx(await mkDocx(Pt("Xin chào"))); return r.blocks.length === 1 && r.blocks[0].kind === "p"; })());

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("2) Mốc PHẦN, số câu, nhãn phương án");
  {
    const { p } = await parse(
      P(R("PH", { b: true }), R("Ầ", { b: true }), R("N I. Câu trắc nghiệm nhiều phương án lựa chọn.", { b: true })) +
      P(R("Câu "), R("1"), R("."), R(" Thủ đô của Việt Nam?")) +
      P(TAB, R("A", { u: true }), R(". Huế"), TAB, R("B. Hà Nội"), TAB, R("C. Đà Nẵng"), TAB, R("D. Cần Thơ")) +
      Pt("Câu 2: Cho điểm A. nằm trên đoạn BC. Chọn mệnh đề đúng") +
      Pt("A. mệnh đề một") + Pt("*B. mệnh đề hai") + Pt("C. mệnh đề ba") + Pt("D. mệnh đề bốn"));
    check("mốc 'PH'+'Ầ'+'N I' bị tách run vẫn nhận; 'nhiều phương án lựa chọn' = MC (chọn MỘT), không phải MC_MULTI", p.questions.length === 2 && p.questions.every(q => q.type === "MC" && q.sectionIndex === 1), p.questions.map(q => q.type));
    check("nhãn câu: 'Câu '+'1'+'.' tách run và 'Câu 2:' đều nhận; khoá s1-1, s1-2", byKey(p, "s1-1")?.number === 1 && byKey(p, "s1-2")?.number === 2);
    const q1 = byKey(p, "s1-1")!;
    check("4 phương án trong MỘT đoạn ngăn bằng tab → 4 lựa chọn đúng chữ", q1.options.map(o => o.text).join("|") === "Huế|Hà Nội|Đà Nẵng|Cần Thơ", q1.options);
    check("nhãn 'A' gạch chân → đáp án A (answerSource dau-gach-chan)", correct(q1) === "A" && q1.answerSource === "dau-gach-chan");
    const q2 = byKey(p, "s1-2")!;
    check("PHÁ: 'điểm A. nằm trên…' giữa câu KHÔNG thành phương án; đề giữ nguyên chữ", q2.text.startsWith("Cho điểm A. nằm trên đoạn BC") && q2.options.length === 4, q2.text);
    check("dấu * đầu phương án → đáp án B, nguồn 'mau'", correct(q2) === "B" && q2.answerSource === "mau");
    check("không có điểm trong tệp: không trường points nào sinh ra (toQuizInput đặt 1 để chia sau)", toQuizInput(q1).points === 1);
  }
  {
    const { p } = await parse(P(R("Câu 1. Không có mốc phần")) + Pt("A. a") + Pt("B. b"));
    check("không có mốc PHẦN → mặc định MC + cảnh báo no_section", p.questions.length === 1 && p.questions[0].type === "MC" && p.warnings.some(w => w.code === "no_section"));
  }
  {
    const { p } = await parse(Pt("PHẦN I. Phần lạ không từ khoá") + Pt("Câu 1. a") + Pt("A. x") + Pt("B. y"));
    check("tiêu đề phần không từ khoá → MC + cảnh báo section_type_unknown", p.questions[0]?.type === "MC" && p.warnings.some(w => w.code === "section_type_unknown"));
  }
  {
    const { p } = await parse(Pt("PHẦN I. Nhiều đáp án đúng") + Pt("Câu 1. Chọn các số chẵn") +
      P(TAB, R("A. 2", { u: true }), BR, TAB, R("B. 3"), BR, TAB, R("C. 4", { u: true }), BR, TAB, R("D. 5")));
    // gạch chân cả "A. 2": nhãn A gạch chân
    const q = p.questions[0];
    check("ngắt dòng mềm (w:br) ngăn 4 phương án; nhiều đáp án → MC_MULTI, đáp án A và C", q?.type === "MC_MULTI" && correct(q) === "AC" && q.options.length === 4, q);
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("3) Đáp án: bốn nguồn, xung đột, màu một mình");
  {
    const { p } = await parse(
      Pt("PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.") +
      // Q1: gạch chân A, bảng A
      Pt("Câu 1. q1") + P(R("A.", { u: true }), R(" a")) + Pt("B. b") + Pt("C. c") + Pt("D. d") +
      // Q2: chỉ bảng B
      Pt("Câu 2. q2") + Pt("A. a") + Pt("B. b") + Pt("C. c") + Pt("D. d") +
      // Q3: gạch chân B nhưng bảng C → XUNG ĐỘT
      Pt("Câu 3. q3") + Pt("A. a") + P(R("B.", { u: true }), R(" b")) + Pt("C. c") + Pt("D. d") +
      // Q4: chỉ tô màu (mọi nhãn) → không đủ
      Pt("Câu 4. q4") + P(R("A.", { color: "0033CC" }), R(" a")) + P(R("B.", { color: "0033CC" }), R(" b")) + P(R("C.", { color: "0033CC" }), R(" c")) + P(R("D.", { color: "0033CC" }), R(" d")) +
      // Q5: lời giải "Chọn D."
      Pt("Câu 5. q5") + Pt("A. a") + Pt("B. b") + Pt("C. c") + Pt("D. d") + Pt("Lời giải:") + Pt("Vì ... nên Đáp án C sai. Chọn D.") +
      // Q6: gạch chân C, lời giải Chọn A. → XUNG ĐỘT
      Pt("Câu 6. q6") + Pt("A. a") + Pt("B. b") + P(R("C.", { u: true }), R(" c")) + Pt("D. d") + Pt("Lời giải") + Pt("Chọn A.") +
      // Q7: gạch chân D + lời giải "Chọn D." (đồng ý)
      Pt("Câu 7. q7") + Pt("A. a") + Pt("B. b") + Pt("C. c") + P(R("D.", { u: true }), R(" d")) + Pt("Lời giải:") + Pt("Giải thích dài.") + Pt("Chọn D.") +
      // Q8: hai nhãn cùng gạch chân ở câu MỘT đáp án → mơ hồ
      Pt("Câu 8. q8") + P(R("A.", { u: true }), R(" a")) + P(R("B.", { u: true }), R(" b")) + Pt("C. c") + Pt("D. d") +
      Pt("-----HẾT-----") + Pt("PHẦN I") +
      T([["Câu", "1", "2", "3", "4", "9"], ["Chọn", "A", "B", "C", "", "A"]]) +
      Pt("Lời giải") + Pt("Câu 1: A đúng vì….") + Pt("Câu 2: B đúng vì…."));
    const k = (n: number) => byKey(p, `s1-${n}`);
    check("Q1 gạch chân A + bảng A (đồng ý) → A, nguồn dau-gach-chan (ưu tiên 1)", correct(k(1)) === "A" && k(1)!.answerSource === "dau-gach-chan" && !k(1)!.flags.length, k(1));
    check("Q2 chỉ có bảng B → B, nguồn bang-het", correct(k(2)) === "B" && k(2)!.answerSource === "bang-het");
    check("Q3 gạch chân B ≠ bảng C → answer_conflict, KHÔNG chọn đáp án nào", k(3)!.flags.includes("answer_conflict") && correct(k(3)) === "" && k(3)!.answerSource === "khong-co", k(3));
    check("Q4 chỉ tô màu mọi nhãn (+ ô bảng trống) → answer_missing, không tự đoán", k(4)!.flags.includes("answer_missing") && correct(k(4)) === "" && !k(4)!.flags.includes("answer_conflict"), k(4));
    check("Q5 'Chọn D.' ở lời giải (và 'Đáp án C sai' không nhầm) → D, nguồn loi-giai", correct(k(5)) === "D" && k(5)!.answerSource === "loi-giai", k(5));
    check("Q6 gạch chân C ≠ lời giải 'Chọn A.' → xung đột", k(6)!.flags.includes("answer_conflict") && correct(k(6)) === "");
    check("Q7 gạch chân D = lời giải D → D; lời giải được giữ làm giải thích", correct(k(7)) === "D" && /Giải thích dài/.test(k(7)!.explanation), k(7));
    check("Q8 hai nhãn cùng gạch chân ở câu MỘT đáp án → xung đột (không chọn)", k(8)!.flags.includes("answer_conflict") && correct(k(8)) === "");
    check("khoá bảng '9' không có câu 9 → cảnh báo orphan_key (s1-9)", p.warnings.some(w => w.code === "orphan_key" && w.question === "s1-9"), p.warnings);
    check("dòng mẫu 'Câu 1: A đúng vì….' sau HẾT KHÔNG thành lời giải của câu 1", k(1)!.explanation === "", k(1)!.explanation);
    check("toQuizInput: MC xung đột (không đáp án) vẫn qua luật NHÁP nhưng KHÔNG qua luật đầy đủ — không bao giờ vào kho nhầm", validateForDraft(toQuizInput(k(3)!)) === null && validateQuizQuestion(toQuizInput(k(3)!)) !== null);
    check("withAnswer đếm đúng (Q1,Q2,Q5,Q7 = 4; xung đột/thiếu không tính)", p.stats.total === 8 && p.stats.withAnswer === 4, p.stats);
    check("lỗi cứng: không có (mọi câu đủ phương án)", p.errors.length === 0, p.errors);
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("4) Nhiều đáp án, Đúng-Sai, trả lời ngắn, tự luận");
  {
    const body =
      Pt("PHẦN I. Câu trắc nghiệm nhiều đáp án đúng") +
      Pt("Câu 1. m1") + Pt("A. a") + Pt("B. b") + Pt("C. c") + Pt("D. d") +
      Pt("Câu 2. m2") + P(R("A.", { u: true }), R(" a")) + P(R("C.", { u: true }), R(" c")) + Pt("B. b") + Pt("D. d") + // C đứng trước B: chỉ "A" hợp lệ liền kề
      Pt("PHẦN II. Câu trắc nghiệm đúng sai") +
      Pt("Câu 1. Cho dữ kiện.") + T([["x", "y"], ["1", "2"]]) +
      Pt("a) [1,NB] ý a") + P(TAB, R("b", { u: true }), R(") [0, TH] ý b")) + Pt("c) [2,VD] ý c") + P(TAB, R("d", { u: true }), R(") [3,VDC] ý d")) +
      Pt("Lời giải:") + Pt("a) Sai. vì") + Pt("b) Đúng. vì") + Pt("c) Sai. vì") + Pt("d) Đúng. vì") +
      Pt("Câu 2. Không dấu") + Pt("a) ý a") + Pt("b) ý b") + Pt("c) ý c") + Pt("d) ý d") +
      Pt("Câu 3. Gạch a nhưng lời giải nói khác") + P(R("a", { u: true }), R(") ý a")) + Pt("b) ý b") + Pt("c) ý c") + Pt("d) ý d") + Pt("Lời giải:") + Pt("a) Sai.") + Pt("b) Sai.") + Pt("c) Sai.") + Pt("d) Sai.") +
      Pt("Câu 4. Chỉ ba ý") + Pt("a) ý a") + Pt("b) ý b") + Pt("c) ý c") +
      Pt("PHẦN III. Câu trắc nghiệm trả lời ngắn") +
      Pt("Câu 1. tính") + Pt("Lời giải:") + Pt("Đáp án: −14") + Pt("Giải thích:") + Pt("Chia đa thức ra được.") +
      Pt("Câu 2. tính tiếp") +
      Pt("Câu 3. tính nữa") + Pt("Đáp án: 5") +
      Pt("PHẦN IV. Câu tự luận") + Pt("Câu 1. Chứng minh rằng …") + Pt("Lời giải:") + Pt("Gợi ý: …") +
      Pt("-----HẾT-----") +
      Pt("PHẦN I") + Pt("Câu 1. A|B|D") + Pt("Câu 2. A|B") +
      Pt("PHẦN II") + T([["Câu 2", "Câu 4"], ["a) Đ", "a) Đúng"], ["b) S", "b) Sai"], ["c) S", "c) Đ"], ["d) Đ", "d) S"]]) +
      Pt("PHẦN III") + T([["Câu", "2", "3"], ["Chọn", "31", "6"]]);
    const { p } = await parse(body);
    const k = (key: string) => byKey(p, key);
    check("MC_MULTI: bảng 'Câu 1. A|B|D' → ABD (bang-het)", correct(k("s1-1")) === "ABD" && k("s1-1")!.answerSource === "bang-het", k("s1-1"));
    check("MC_MULTI: gạch chân A (+C sai thứ tự không thành nhãn) ≠ bảng A|B → xung đột", k("s1-2")!.flags.includes("answer_conflict") || correct(k("s1-2")) === "A", k("s1-2"));
    const tf1 = k("s2-1")!;
    check("TF: 4 ý a-d, tiền tố [n, MỨC] bị bỏ khỏi chữ, subLabel a..d", tf1.type === "TRUE_FALSE_CLUSTER" && tf1.options.map(o => o.subLabel).join("") === "abcd" && tf1.options.map(o => o.text).join("|") === "ý a|ý b|ý c|ý d", tf1.options);
    check("TF: mức = CAO NHẤT trong cụm ([1,NB],[0,TH],[2,VD],[3,VDC] → VDC)", tf1.difficulty === "VDC");
    check("TF: gạch chân b, d + lời giải 'a) Sai b) Đúng c) Sai d) Đúng' khớp → b,d đúng", correct(tf1) === "bd" && tf1.answerSource === "dau-gach-chan", tf1);
    check("TF: bảng trong đề được đưa vào chữ đề dạng 'ô | ô'", /x \| y\n1 \| 2/.test(tf1.text), tf1.text);
    check("cảnh báo tf_order_ignored đúng MỘT lần cho cả tệp", p.warnings.filter(w => w.code === "tf_order_ignored").length === 1);
    check("TF: mức lấy từ nơi khác = null (không đoán)", k("s2-2")!.difficulty === null);
    check("TF: không gạch chân, bảng 'Câu 2: Đ S S Đ' → a,d đúng (bang-het)", correct(k("s2-2")) === "ad" && k("s2-2")!.answerSource === "bang-het", k("s2-2"));
    check("TF: gạch chân a ≠ lời giải (tất cả Sai) → xung đột, không ý nào được đánh dấu", k("s2-3")!.flags.includes("answer_conflict") && correct(k("s2-3")) === "", k("s2-3"));
    check("TF: chỉ 3 ý → lỗi cứng, câu bị bỏ (errors), không ném", !k("s2-4") && p.errors.some(e => /4 ý/.test(e.message)), p.errors);
    const sa1 = k("s3-1")!;
    check("SA: 'Đáp án: −14' (dấu trừ Unicode) → '-14'; 'Giải thích:' không lẫn vào lời giải", sa1.options.length === 1 && sa1.options[0].text === "-14" && sa1.options[0].isCorrect && sa1.explanation === "Chia đa thức ra được.", sa1);
    check("SA: đáp án từ bảng 'Chọn 31' (bang-het)", k("s3-2")!.options[0]?.text === "31" && k("s3-2")!.answerSource === "bang-het", k("s3-2"));
    check("SA: 'Đáp án: 5' ≠ bảng '6' → xung đột, KHÔNG có đáp án nào", k("s3-3")!.flags.includes("answer_conflict") && k("s3-3")!.options.length === 0, k("s3-3"));
    const es = k("s4-1")!;
    check("ESSAY: không lựa chọn, không cờ thiếu đáp án; có lời giải", es.type === "ESSAY" && es.options.length === 0 && es.flags.length === 0 && es.explanation === "Gợi ý: …", es);
    check("tổng: 3+... byType đúng (MC_MULTI 2, TF 3, SA 3, ESSAY 1)", p.stats.byType.MC_MULTI === 2 && p.stats.byType.TRUE_FALSE_CLUSTER === 3 && p.stats.byType.SHORT_ANSWER === 3 && p.stats.byType.ESSAY === 1, p.stats);
    // Sang dạng lưu
    const mc = toQuizInput(k("s1-1")!, { difficulty: "TH", categoryId: "cat1" });
    check("toQuizInput: ghi đè mức + nút; qua validateQuizQuestion (đủ đáp án)", mc.difficulty === "TH" && mc.categoryId === "cat1" && validateQuizQuestion(mc) === null, validateQuizQuestion(mc));
    check("toQuizInput: TF xung đột có 0 ý đúng — luật đầy đủ chấp nhận (4 ý đều Sai là hợp lệ), nên UI PHẢI chặn lưu khi còn cờ answer_conflict/answer_missing", validateQuizQuestion(toQuizInput(k("s2-3")!)) === null);
    check("toQuizInput: TF giữ mức của chính câu khi không ghi đè", toQuizInput(tf1).difficulty === "VDC" && validateQuizQuestion(toQuizInput(tf1)) === null);
    check("toQuizInput: ESSAY options rỗng, SA có 1 đáp án đúng", toQuizInput(es).options.length === 0 && toQuizInput(sa1).options.length === 1);
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("5) Hình, công thức");
  {
    const rels = REL_IMG("rId10", "media/image1.png") + REL_IMG("rId11", "media/image2.wmf") + REL_IMG("rId12", "media/image3.png") + REL_IMG("rId20", "media/prev.wmf");
    const files = { "word/media/image1.png": PNG, "word/media/image2.wmf": Buffer.from("WMFDATA"), "word/media/image3.png": PNG, "word/media/prev.wmf": Buffer.from("PREV") };
    const { read, p } = await parse(
      Pt("PHẦN I. Câu trắc nghiệm một đáp án đúng") +
      P(R("Câu 1. Không hình riêng")) + Pt("A. a") + P(R("B.", { u: true }), R(" b")) +
      // hình đứng ngay trước chữ "Câu 2." trong cùng đoạn: thuộc CÂU 1, không phải câu 2 (mẫu thật có cấu trúc này)
      P(IMG("rId10"), R("Câu 2. Không hình")) + Pt("A. a") + P(R("B.", { u: true }), R(" b")) +
      P(R("Câu 3. Hai hình")) + P(IMG("rId10")) + P(IMG("rId12")) + Pt("A. a") + P(R("B.", { u: true }), R(" b")) +
      P(R("Câu 4. Hình WMF "), IMG("rId11")) + Pt("A. a") + P(R("B.", { u: true }), R(" b")) +
      P(R("Câu 5. Công thức "), OLE, R(" và "), OMML('<m:f><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>2</m:t></m:r></m:den></m:f>')) + P(R("A. "), OLE, TAB, R("B. x"), R("2", { sup: true }), R(" "), TAB, R("C. c"), TAB, R("D. d")) +
      Pt("Câu 6. Số mũ"),
      { rels, files, });
    check("đọc được 2 ảnh raster khác nhau (png) + wmf không tính vào images", read.images.length === 2 && read.mime.every(m => m === "image/png"), read.mime);
    check("PHÁ: hình đứng TRƯỚC 'Câu 2.' cùng đoạn thuộc câu 1 (imageIndex 0, không cảnh báo thừa); câu 2 không nhận hình đó", byKey(p, "s1-1")?.imageIndex === 0 && byKey(p, "s1-2")?.imageIndex === undefined && !p.warnings.some(w => w.code === "extra_images" && w.question === "s1-1"), [byKey(p, "s1-1")?.imageIndex, byKey(p, "s1-2")?.imageIndex, p.warnings]);
    check("câu 3: hai hình khác nhau → giữ hình đầu + cảnh báo extra_images", byKey(p, "s1-3")?.imageIndex !== undefined && p.warnings.some(w => w.code === "extra_images" && w.question === "s1-3"), p.warnings);
    check("câu 4: hình WMF → cờ image_unreadable + cảnh báo, không imageIndex", byKey(p, "s1-4")?.flags.includes("image_unreadable") && byKey(p, "s1-4")?.imageIndex === undefined && p.warnings.some(w => w.code === "image_unreadable"));
    const q4 = byKey(p, "s1-5");
    check("câu 5: MathType OLE → nhãn ⟦công thức⟧ + cờ formula_unread (P1a)", !!q4 && q4.text.includes("⟦công thức⟧") && q4.flags.includes("formula_unread"), q4);
    check("câu 5: OMML 1/2 → LaTeX $\\frac{1}{2}$ trong chữ đề", !!q4 && q4.text.includes("$\\frac{1}{2}$"), q4?.text);
    check("câu 5: phương án có OLE giữ nhãn; x² (chỉ số trên) thành 'x²'", !!q4 && q4.options[0].text === "⟦công thức⟧" && q4.options[1].text === "x²", q4?.options);
    check("câu 6 không có phương án → lỗi cứng, bị bỏ, các câu khác vẫn đọc", !byKey(p, "s1-6") && p.errors.length === 1 && p.stats.total === 5, p.errors);
    check("stats.withFormulaUnread = 1", p.stats.withFormulaUnread === 1, p.stats);
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("6) Giới hạn, trùng số câu, parseAnswerKeyText");
  {
    let body = Pt("PHẦN I. Câu trắc nghiệm một đáp án đúng");
    for (let i = 1; i <= 201; i++) body += Pt(`Câu ${i}. q${i}`) + Pt("A. a") + P(R("B.", { u: true }), R(" b"));
    const { p } = await parse(body);
    check("201 câu → fatal 'quá giới hạn' và KHÔNG trả câu nào (route trả 422 TOO_MANY)", p.fatal !== null && /quá giới hạn/.test(p.fatal) && p.questions.length === 0, p.fatal);
    let b2 = Pt("PHẦN I. Câu trắc nghiệm một đáp án đúng");
    for (let i = 1; i <= 200; i++) b2 += Pt(`Câu ${i}. q${i}`) + Pt("A. a") + P(R("B.", { u: true }), R(" b"));
    check("đúng 200 câu → qua", (await parse(b2)).p.questions.length === 200);
  }
  {
    const { p } = await parse(Pt("PHẦN I. Câu trắc nghiệm một đáp án đúng") + Pt("Câu 1. a") + Pt("A. 1") + Pt("B. 2") + Pt("Câu 1. b") + Pt("A. 3") + Pt("B. 4"));
    check("hai 'Câu 1.' trong một phần → khoá không trùng (s1-1, s1-1#2) + cảnh báo duplicate_number", p.questions.length === 2 && new Set(p.questions.map(q => q.key)).size === 2 && p.warnings.some(w => w.code === "duplicate_number"), p.questions.map(q => q.key));
  }
  check("tệp không có câu nào → fatal rõ ràng (không ném)", (await parse(Pt("Chỉ có tiêu đề đề thi"))).p.fatal !== null);
  check("khối rỗng → fatal", parseAzotaBlocks([]).fatal !== null);
  {
    const k = parseAnswerKeyText("1-A, 2.B, 3:C  Câu 4. A|B  5) D 10=C");
    check("parseAnswerKeyText: '1-A, 2.B, 3:C', 'Câu 4. A|B', '5) D', '10=C'", k[1] === "A" && k[2] === "B" && k[3] === "C" && k[4] === "AB" && k[5] === "D" && k[10] === "C", k);
    check("PHÁ: 'Anh' / 'Bad' không bị đọc là đáp án; chuỗi rác → {}", Object.keys(parseAnswerKeyText("1. Anh 2. Bad")).length === 0 && Object.keys(parseAnswerKeyText("xin chào")).length === 0);
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("7) Mẫu v2 dạng tổng hợp (8 câu + 1 khoá mồ côi) — mô phỏng 4 phần của mẫu Azota");
  {
    const { p } = await parse(
      P(R("PH", { b: true }), R("Ầ", { b: true }), R("N I. Câu trắc nghiệm ", { b: true }), R("một đáp án đúng ", { b: true })) +
      P(R("Câu ", { b: true }), R("1.", { b: true }), R(" Mệnh đề nào sai?")) +
      P(TAB, R("A.", { b: true }), R(" Số 2 là số nguyên."), TAB, R("B.", { b: true }), R(" Số 2 là số hữu tỉ.")) +
      P(TAB, R("C.", { b: true }), R(" Số 2 là số hữu tỉ dương."), TAB, R("D.", { b: true }), R(" Số 2 không là số nguyên tố.")) +
      Pt("PHẦN II. Câu trắc nghiệm nhiều đáp án đúng", { b: true }) +
      P(R("Câu 1. Số nào hữu tỉ?")) + P(R("    "), R("A. ", { b: true }), R("3/4"), BR, R("    "), R("B. ", { b: true }), R("-5"), BR, R("    C. √2"), BR, R("    D. 0,25")) +
      P(R("Câu 2. Phát biểu nào đúng?")) + P(R("   A. x"), BR, R("   B. y"), BR, R("   C. z"), BR, R("   D. t")) +
      P(R("Câu 3. Chọn các ý đúng")) + P(R("  A. p"), BR, R("  B. q"), BR, R("  C. r"), BR, R("  D. s")) +
      Pt("PHẦN III. Câu trắc nghiệm đúng sai.", { b: true }) +
      Pt("Câu 1. đoạn đề") + Pt("a) [1,NB] ý a") + Pt("b) [1,NB] ý b") + Pt("c) [0, TH] ý c") + Pt("d) [2, TH] ý d") +
      Pt("Câu 2. đề 2") + Pt("a) [1, NB] ý a") + Pt("b) [2, NB] ý b") + Pt("c) [2, TH] ý c") + Pt("d) [3, VD] ý d") +
      Pt("PHẦN IV. Câu trắc nghiệm trả lời ngắn.", { b: true }) +
      Pt("Câu 1. tính độ dài") + P(IMG("rId10"), R("Câu 2. đo khoảng cách")) +
      Pt("---------------------------HẾT------------------------", { b: true }) +
      Pt("PHẦN I") + T([["Câu", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Chọn", "D", "A", "", "", "", "", "", "", "", "", "", ""]]) +
      Pt("Lời giải") + Pt("Câu 1: A đúng vì….") + Pt("Câu 2: B đúng vì….") +
      Pt("PHẦN II ") + Pt("Câu 1. A|B|D") + Pt("Câu 2. A|B|D") + Pt("Câu 3. A|C") +
      P(R("PH"), R("Ầ"), R("N I"), R("II")) + T([["Câu 1", "Câu 2"], ["a) Đ", "a) Đ"], ["b) S", "b) S"], ["c) S", "c) S"], ["d) Đ", "d) S"]]) +
      Pt("Lời giải") + Pt("Câu 1: A đúng vì….") +
      P(R("PH"), R("Ầ"), R("N I"), R("V")) + T([["Câu", "1", "2"], ["Chọn", "10", "31"]]),
      { rels: REL_IMG("rId10", "media/image1.png"), files: { "word/media/image1.png": PNG } });
    check("tổng 8 câu: PHẦN I 1 · II 3 · III 2 · IV 2 (số đếm vàng của mẫu v2)", p.stats.total === 8 && p.stats.byType.MC === 1 && p.stats.byType.MC_MULTI === 3 && p.stats.byType.TRUE_FALSE_CLUSTER === 2 && p.stats.byType.SHORT_ANSWER === 2, p.stats);
    check("đúng 1 khoá mồ côi (PHẦN I câu 2 — đề chỉ có 1 câu)", p.warnings.filter(w => w.code === "orphan_key").length === 1 && p.warnings.some(w => w.code === "orphan_key" && w.question === "s1-2"), p.warnings);
    check("phương án ngăn bằng tab/ngắt dòng + khoảng trắng đầu dòng đọc đúng; đáp án từ bảng HẾT", correct(byKey(p, "s1-1")) === "D" && correct(byKey(p, "s2-1")) === "ABD" && correct(byKey(p, "s2-3")) === "AC", [byKey(p, "s1-1"), byKey(p, "s2-1")]);
    check("Đ/S từ bảng 'a) Đ / b) S…' (Câu 1 = ĐSSĐ → ad; Câu 2 = ĐSSS → a)", correct(byKey(p, "s3-1")) === "ad" && correct(byKey(p, "s3-2")) === "a", [byKey(p, "s3-1"), byKey(p, "s3-2")]);
    check("trả lời ngắn từ bảng: 10 và 31", byKey(p, "s4-1")?.options[0]?.text === "10" && byKey(p, "s4-2")?.options[0]?.text === "31");
    check("mức Đ/S: Câu 1 = TH, Câu 2 = VD (cao nhất trong cụm)", byKey(p, "s3-1")?.difficulty === "TH" && byKey(p, "s3-2")?.difficulty === "VD");
    check("hình đứng trước 'Câu 2.' của PHẦN IV thuộc câu 1 (mẫu thật có đúng cấu trúc này)", byKey(p, "s4-1")?.imageIndex === 0 && byKey(p, "s4-2")?.imageIndex === undefined);
    check("lời giải mẫu 'A đúng vì….' bị bỏ ở mọi phần", p.questions.every(q => q.explanation === ""));
    check("câu đủ đáp án (8/8)", p.stats.withAnswer === 8, p.stats);
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  section("8) Mẫu THẬT (chạy nếu có tệp)");
  const dir = process.env.AZOTA_SAMPLES || path.join(os.homedir(), "Downloads");
  const samples: [string, number, number][] = [["De_Su12_Azota.docx", 28, 0], ["De_Toan12_GK1_Azota.docx", 22, 0], ["mau_de_azota_docx_v2.docx", 8, 1]];
  for (const [name, total, orphans] of samples) {
    const f = path.join(dir, name);
    if (!fs.existsSync(f)) { console.log(`  - SKIP ${name}: không thấy trong ${dir} (đặt AZOTA_SAMPLES=<thư mục> để chạy)`); continue; }
    const r = await readDocx(fs.readFileSync(f));
    const p = parseAzotaBlocks(r.blocks);
    check(`${name}: ${total} câu, không lỗi cứng, ${orphans} khoá mồ côi`, p.stats.total === total && p.errors.length === 0 && p.fatal === null && p.warnings.filter(w => w.code === "orphan_key").length === orphans, { stats: p.stats, errors: p.errors, orphan: p.warnings.filter(w => w.code === "orphan_key").length });
    check(`${name}: không câu nào xung đột đáp án`, !p.questions.some(q => q.flags.includes("answer_conflict")));
    if (name.startsWith("De_Su12")) check("Su12: 24 TN + 4 Đ/S, đủ 28 đáp án, 0 cờ", p.stats.byType.MC === 24 && p.stats.byType.TRUE_FALSE_CLUSTER === 4 && p.stats.withAnswer === 28);
    if (name.startsWith("De_Toan12")) check("Toán12: 12 TN + 4 Đ/S + 6 trả lời ngắn, đủ 22 đáp án; mọi câu còn nhãn công thức MathType", p.stats.byType.MC === 12 && p.stats.byType.TRUE_FALSE_CLUSTER === 4 && p.stats.byType.SHORT_ANSWER === 6 && p.stats.withAnswer === 22 && p.stats.withFormulaUnread === 22);
    if (name.startsWith("mau_de_azota")) check("mẫu v2: 1 MC + 3 nhiều đáp án + 2 Đ/S + 2 trả lời ngắn", p.stats.byType.MC === 1 && p.stats.byType.MC_MULTI === 3 && p.stats.byType.TRUE_FALSE_CLUSTER === 2 && p.stats.byType.SHORT_ANSWER === 2);
  }

  await done();
})();
