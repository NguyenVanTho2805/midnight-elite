// BU-03 MathType/Azota — bài PHÁ độc lập (kiểm thử viên viết, không phải tác giả mã). THUẦN: không DB, không mạng, không cần máy chủ dev; docx dựng bằng jszip tại chỗ.
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-mathtype-adversarial.ts
// Mỗi mục nhắm MỘT giả định của mã (ngưỡng Dice 0,90 / 30 ký tự, ghép theo PHẦN + thứ tự, mục sau HẾT, tên mốc "LỜI GIẢI CHI TIẾT", chỉ số Unicode, nhãn PHIẾU TRẢ LỜI,
// token ảnh {{ctimg}}, docx hỏng, OLE hỏng). Ca đỏ = giả định bị phá; chú thích "PHÁT HIỆN" nêu mức P1/P2/P3 trong báo cáo kiểm thử.
import JSZip from "jszip";
import { check, section, done } from "./h";
import { parseAzotaBlocks, toQuizInput, type DocBlock, type DocRun, type AzotaParse, type AzotaQuestion } from "@/lib/azotaDocx";
import { readDocx, DocxError } from "@/lib/azotaDocxRead";
import { coerceQuestionInput } from "@/lib/quizQuestion";
import { renderMathText } from "@/components/MathText";
import { makeFormulaImgToken, sanitizeFormulaImgTokens, FORMULA_MAX_TOKENS_PER_FIELD } from "@/lib/mathtype/formulaImg";
import { decodeMathTypeOle } from "@/lib/mathtype/mtef";
import { oleOf, line, frac, num, vars, tmpl } from "./mathtype-fixtures";

const T = (t: string): DocRun => ({ text: t });
const U = (t: string): DocRun => ({ text: t, underline: true });
const P = (...runs: (string | DocRun)[]): DocBlock => ({ kind: "p", runs: runs.map(r => (typeof r === "string" ? T(r) : r)) });
const TBL = (...rows: string[][]): DocBlock => ({ kind: "table", rows: rows.map(r => r.map(c => ({ paragraphs: [[T(c)]] }))) });

const H1 = "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu 4. Mỗi câu hỏi thí sinh chỉ chọn một phương án.";
const H2 = "PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu 1. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.";
const H3 = "PHẦN III. Tự luận. Thí sinh trả lời từ câu 1 đến câu 1.";

const optsLine = (opts: string[], u: number | null): DocBlock => {
  const runs: DocRun[] = [];
  opts.forEach((t, k) => { const sep = k < 3 ? "\t" : ""; if (k === u) runs.push(U("ABCD"[k]), T(`. ${t}${sep}`)); else runs.push(T(`${"ABCD"[k]}. ${t}${sep}`)); });
  return { kind: "p", runs };
};
const letters = (q: AzotaQuestion | undefined): string => (q ? q.options.map((o, i) => (o.isCorrect ? "ABCD"[i] : "")).join("") : "?");
const flagsOf = (q: AzotaQuestion | undefined) => q?.flags ?? [];
const warnCodes = (p: AzotaParse) => p.warnings.map(w => w.code);

// Bốn câu MC có đầu đề DÀI, khác nhau rõ.
const MCS = [
  { stem: "Cho hàm số $f(x)=x^{3}-3x+2$ liên tục trên đoạn $[0;2]$. Tìm giá trị lớn nhất của hàm số trên đoạn đó theo yêu cầu của đề bài.", opts: ["$4$.", "$2$.", "$0$.", "$-1$."] },
  { stem: "Một vật chuyển động thẳng đều với vận tốc không đổi, quãng đường đi được sau mỗi giờ là như nhau; hãy chọn phát biểu đúng nhất sau đây.", opts: ["Gia tốc bằng không.", "Gia tốc khác không.", "Vận tốc đổi chiều.", "Quãng đường giảm."] },
  { stem: "Trong không gian với hệ tọa độ Oxyz, mặt cầu tâm $I(1;2;3)$ bán kính bằng $5$ có phương trình nào sau đây trong các phương án đã cho?", opts: ["Phương án một.", "Phương án hai.", "Phương án ba.", "Phương án bốn."] },
  { stem: "Số nghiệm thực phân biệt của phương trình lôgarit sau đây trên tập số thực là bao nhiêu khi giải theo điều kiện xác định của hàm số?", opts: ["Một.", "Hai.", "Ba.", "Bốn."] },
];
function examMC(extra: DocBlock[] = [], tail: DocBlock[] = []): DocBlock[] {
  const b: DocBlock[] = [P("ĐỀ THỬ"), P(H1)];
  MCS.forEach((q, i) => b.push(P(`Câu ${i + 1}.\t${q.stem}`), optsLine(q.opts, null)));
  b.push(...extra);
  return [...b, ...tail];
}
const solMC = (i: number, u: number | null, body: string[] = ["ZZSOL lời giải."]): DocBlock[] => [P(MCS[i].stem), optsLine(MCS[i].opts, u), P("Lời giải"), ...body.map(x => P(x))];

(async () => {
  // ───────────────────────────────────────────────────────────────────────────────────────
  section("A1) Đề KHÔNG có lời giải, không gạch chân → mọi câu answer_missing, không có cờ answer_from_solution, không bịa đáp án");
  {
    const r = parseAzotaBlocks(examMC());
    check("4 câu, 0 đáp án, đều answer_missing", r.questions.length === 4 && r.stats.withAnswer === 0 && r.questions.every(q => flagsOf(q).includes("answer_missing") && letters(q) === ""), r.stats);
    check("không có cảnh báo solution_*", !warnCodes(r).some(c => c.startsWith("solution_")), warnCodes(r));
  }

  section("A2) Hai câu GẦN GIỐNG (khác một ký tự chữ) + lời giải XÁO thứ tự → không được gán đáp án chéo");
  {
    // khác nhau ĐÚNG MỘT chữ cái (x → y); không có chữ số khác nhau → qua cổng số, Dice cặp ký tự rất cao
    const mk = (v: string) => `Cho hàm số $y=f(${v})$ có đồ thị như hình vẽ bên dưới, hãy xác định số điểm cực trị của hàm số đã cho trên toàn bộ tập xác định của nó ${v}.`;
    const o = ["Một điểm.", "Hai điểm.", "Ba điểm.", "Bốn điểm."];
    const q1 = { stem: mk("x"), opts: o }, q2 = { stem: mk("t"), opts: o };
    const exam: DocBlock[] = [P(H1), P(`Câu 1.\t${q1.stem}`), optsLine(o, null), P(`Câu 2.\t${q2.stem}`), optsLine(o, null)];
    const ent = (q: { stem: string; opts: string[] }, u: number): DocBlock[] => [P(q.stem), optsLine(q.opts, u), P("Lời giải"), P("Ta có kết quả.")];
    // Lời giải của câu 2 (đáp án D) đứng TRƯỚC lời giải của câu 1 (đáp án B)
    const r = parseAzotaBlocks([...exam, P("LỜI GIẢI CHI TIẾT"), P(H1), ...ent(q2, 3), ...ent(q1, 1)]);
    const a1 = letters(r.questions[0]), a2 = letters(r.questions[1]);
    check("PHÁT HIỆN P2: câu 1 KHÔNG nhận đáp án D (của lời giải câu 2) — đáng lẽ bỏ/ghi chưa chắc, không ghép chéo", a1 !== "D" && a2 !== "B", { a1, a2, sol: r.solutionStats });
  }

  section("A2b) Hai câu khác nhau CHỈ ở ảnh công thức (mọi ảnh chuẩn hoá thành một ký hiệu) + lời giải xáo thứ tự");
  {
    const svg = (c: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="10pt" height="10pt" viewBox="0 0 10 10"><text y="5" font-size="4"><tspan x="1">${c}</tspan></text></svg>`;
    const t1 = makeFormulaImgToken(svg("a"))!, t2 = makeFormulaImgToken(svg("b"))!;
    const o = ["Một.", "Hai.", "Ba.", "Bốn."];
    const stem = (t: string) => `Giá trị của biểu thức sau đây bằng bao nhiêu khi tính theo đúng yêu cầu của đề bài: ${t}`;
    const ent = (t: string, u: number): DocBlock[] => [P(stem(t)), optsLine(o, u), P("Lời giải"), P("x")];
    const r = parseAzotaBlocks([P(H1), P(`Câu 1.\t${stem(t1)}`), optsLine(o, null), P(`Câu 2.\t${stem(t2)}`), optsLine(o, null), P("LỜI GIẢI CHI TIẾT"), P(H1), ...ent(t2, 3), ...ent(t1, 1)]);
    check("PHÁT HIỆN P2: câu 1 (ảnh a) KHÔNG nhận đáp án D của lời giải câu 2 (ảnh b)", letters(r.questions[0]) !== "D" && letters(r.questions[1]) !== "B", r.questions.map(letters));
  }

  section("A3) Tên mốc lời giải biến thể → hoặc nhận ra, hoặc CẢNH BÁO rõ; thân lời giải không được tràn vào câu cuối");
  {
    const variants = ["Lời giải chi tiết", "ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT", "HƯỚNG DẪN GIẢI CHI TIẾT", "LỜI GIẢI  CHI TIẾT", "LỜI GIẢI CHI TIẾT:", "LỜI GIẢI", "lời giải chi tiết"];
    for (const v of variants) {
      const blocks = [...examMC(), P("PHIẾU TRẢ LỜI"), P(v), P(H1), ...MCS.flatMap((_, i) => solMC(i, i))];
      const r = parseAzotaBlocks(blocks);
      const recognised = r.solutionStats?.matched === 4 && r.questions.every((q, i) => letters(q) === "ABCD"[i]);
      const leaked = r.questions.some(q => q.text.includes("ZZSOL") || q.options.some(o => o.text.includes("ZZSOL")));
      const warned = warnCodes(r).some(c => c.startsWith("solution_"));
      check(`"${v}": nhận ra HOẶC cảnh báo; không rò thân lời giải sang câu`, (recognised || warned) && !leaked, { recognised, warned, leaked, ans: r.questions.map(letters), w: warnCodes(r) });
    }
  }

  section("A4) Mục lời giải đặt SAU dòng HẾT → không rác, không đáp án sai; nếu bỏ qua thì phải nói");
  {
    const blocks = [...examMC(), P("-----HẾT-----"), P("LỜI GIẢI CHI TIẾT"), P(H1), ...MCS.flatMap((_, i) => solMC(i, (i + 1) % 4, ["Chọn A", "ZZSOL"]))];
    const r = parseAzotaBlocks(blocks);
    const leaked = r.questions.some(q => q.text.includes("ZZSOL") || q.options.some(o => o.text.includes("ZZSOL")));
    const used = r.solutionStats?.matched === 4;
    const correctIfUsed = !used || r.questions.every((q, i) => letters(q) === "ABCD"[(i + 1) % 4]);
    check("không rò chữ lời giải vào đề; nếu dùng thì đáp án đúng, nếu không dùng thì có cảnh báo", !leaked && correctIfUsed && (used || r.warnings.length > 0 || r.stats.withAnswer === 0), { used, ans: r.questions.map(letters), flags: r.questions.map(flagsOf), w: warnCodes(r) });
  }

  section("A5) \"PHIẾU TRẢ LỜI\" lẫn thân bài");
  {
    const lastQ = (r: AzotaParse) => r.questions[r.questions.length - 1];
    // (a) tiêu đề riêng + bảng + dòng chữ kế → không dính vào câu cuối
    let r = parseAzotaBlocks(examMC([], [P("PHIẾU TRẢ LỜI"), TBL(["1", "2"], ["A", "B"]), P("Họ và tên thí sinh: ........")]));
    check("(a) bảng + dòng 'Họ và tên' sau PHIẾU TRẢ LỜI không dính câu cuối", !lastQ(r).options.some(o => o.text.includes("Họ và tên")) && !lastQ(r).text.includes("Họ và tên"), lastQ(r).options.map(o => o.text));
    // (b) cụm từ nằm TRONG câu hỏi → giữ nguyên, không cắt cụt
    const b = examMC();
    b[b.length - 2] = P(`Câu 4.\t${MCS[3].stem} Ghi kết quả vào PHIẾU TRẢ LỜI`);
    r = parseAzotaBlocks(b);
    check("(b) 'PHIẾU TRẢ LỜI' trong câu hỏi: câu vẫn đủ 4 phương án, chữ giữ nguyên", lastQ(r).options.length === 4 && lastQ(r).text.includes("PHIẾU TRẢ LỜI"), lastQ(r).text);
    // (c) viết thường/ hoa chữ đầu → hoặc bỏ, hoặc không phá câu cuối (4 phương án nguyên)
    r = parseAzotaBlocks(examMC([], [P("Phiếu trả lời"), P("Câu 1  2  3  4")]));
    check("(c) 'Phiếu trả lời' (hoa chữ đầu) không làm hỏng 4 phương án câu cuối", lastQ(r).options.length === 4 && r.questions.length === 4, { n: lastQ(r).options.length, opts: lastQ(r).options.map(o => o.text) });
    // (d) PHIẾU TRẢ LỜI nằm GIỮA đề (giữa PHẦN I và PHẦN II) rồi bảng câu hỏi Đ/S ngay sau
    const mid = [P(H1), P(`Câu 1.\t${MCS[0].stem}`), optsLine(MCS[0].opts, 0), P("PHIẾU TRẢ LỜI"), TBL(["1"], ["A"]), P(H2),
      P("Câu 1.\tCho hàm số $f$ xác định trên $\\mathbb{R}$. Xét tính đúng sai của các mệnh đề sau."), P("a) Mệnh đề một."), P("b) Mệnh đề hai."), P("c) Mệnh đề ba."), P("d) Mệnh đề bốn.")];
    r = parseAzotaBlocks(mid);
    check("(d) PHIẾU TRẢ LỜI giữa đề không làm mất câu Đ/S sau nó", r.questions.length === 2 && r.questions[1]?.options.length === 4, r.questions.map(q => q.key));
  }

  section("A6) Gạch chân nhiễu");
  {
    const mk = (blocks: DocBlock[]) => parseAzotaBlocks([P(H1), P("Câu 1.\tChọn phát biểu đúng trong các phát biểu sau về điểm và đường thẳng."), ...blocks]);
    let r = mk([{ kind: "p", runs: [T("A. Điểm "), U("C"), T(" nằm giữa.\tB. Hai điểm.\t"), T("C. Ba điểm.\tD. Bốn điểm.")] }]);
    check("(a) chữ C gạch chân GIỮA nội dung phương án A không bị coi là nhãn đáp án", letters(r.questions[0]) === "" && flagsOf(r.questions[0]).includes("answer_missing"), letters(r.questions[0]));
    r = mk([{ kind: "p", runs: [U("A"), T(". Một.\t"), U("B"), T(". Hai.\tC. Ba.\tD. Bốn.")] }]);
    check("(b) hai nhãn gạch chân ở câu MỘT đáp án → answer_conflict, không chọn", flagsOf(r.questions[0]).includes("answer_conflict") && letters(r.questions[0]) === "", { f: flagsOf(r.questions[0]), a: letters(r.questions[0]) });
    r = mk([{ kind: "p", runs: [U("A"), T(". Một.\t"), U("B"), T(". Hai.\t"), U("C"), T(". Ba.\t"), U("D"), T(". Bốn.")] }]);
    check("(c) cả bốn nhãn gạch chân (gạch cả dòng) → answer_conflict", flagsOf(r.questions[0]).includes("answer_conflict"), flagsOf(r.questions[0]));
    // (d) gạch chân nhãn A VÀ lời giải ghi Chọn C → mâu thuẫn → không chọn
    const withSol: DocBlock[] = [P(H1), P("Câu 1.\tChọn phát biểu đúng trong các phát biểu sau về điểm và đường thẳng."), optsLine(["Một.", "Hai.", "Ba.", "Bốn."], 0), P("Lời giải"), P("Vậy Chọn C")];
    r = parseAzotaBlocks(withSol);
    check("(d) gạch chân A nhưng lời giải 'Chọn C' → answer_conflict", flagsOf(r.questions[0]).includes("answer_conflict") && letters(r.questions[0]) === "", { f: flagsOf(r.questions[0]), a: letters(r.questions[0]) });
    // (e) Đ/S: gạch chân sót một nhãn khi không có ý định đánh dấu → đáp án SUY RA từ gạch chân (thiết kế); nhưng phải gắn nguồn dau-gach-chan để gia sư thấy
    const tf: DocBlock[] = [P(H2), P("Câu 1.\tCho hàm số $f$ xác định trên $\\mathbb{R}$. Xét tính đúng sai của các mệnh đề sau."), { kind: "p", runs: [U("a"), T(") Một.")] }, P("b) Hai."), P("c) Ba."), P("d) Bốn.")];
    r = parseAzotaBlocks(tf);
    check("(e) Đ/S một nhãn gạch chân → ĐSSS với answerSource dau-gach-chan (không im lặng)", r.questions[0].answerSource === "dau-gach-chan" && r.questions[0].options.map(o => (o.isCorrect ? "Đ" : "S")).join("") === "ĐSSS", r.questions[0].answerSource);
  }

  section("A7) Lời giải thiếu một câu + xáo thứ tự → KHÔNG ghép sai (bỏ cái lệch thứ tự là chấp nhận được, nhưng phải cảnh báo)");
  {
    const blocks = [...examMC(), P("LỜI GIẢI CHI TIẾT"), P(H1), ...solMC(2, 2), ...solMC(0, 0), ...solMC(3, 3)]; // thiếu câu 2; xáo 3,1,4
    const r = parseAzotaBlocks(blocks);
    const L = r.questions.map(letters);
    check("không có đáp án sai: mỗi câu hoặc rỗng hoặc đúng (C1=A, C3=C, C4=D)", (L[0] === "" || L[0] === "A") && L[1] === "" && (L[2] === "" || L[2] === "C") && (L[3] === "" || L[3] === "D"), L);
    check("lời giải bị bỏ vì lệch thứ tự có cảnh báo solution_unmatched kèm mã câu", r.warnings.some(w => w.code === "solution_unmatched" && w.question !== ""), r.warnings.map(w => w.code + ":" + w.question));
  }

  section("A8) Body lời giải có dòng bắt đầu bằng \"Phần N\" / chữ \"Câu N.\" → không làm lệch PHẦN");
  {
    const blocks = [...examMC(), P("LỜI GIẢI CHI TIẾT"), P(H1),
      ...solMC(0, 0, ["Phần 2 của bài toán: ta xét đạo hàm.", "ZZSOL"]), ...solMC(1, 0), ...solMC(2, 0), ...solMC(3, 0)];
    const r = parseAzotaBlocks(blocks);
    check("dòng thân 'Phần 2 của bài toán' không chia đôi mục lời giải: cả 4 câu vẫn có đáp án A", r.questions.every(q => letters(q) === "A"), { ans: r.questions.map(letters), sol: r.solutionStats, w: warnCodes(r) });
  }

  section("A9) Dấu tổ hợp dựng sẵn (NFD) trong mốc \"Lời giải\" / đầu đề");
  {
    const nfd = (s: string) => s.normalize("NFD");
    const blocks = [...examMC(), P("LỜI GIẢI CHI TIẾT"), P(H1),
      ...MCS.flatMap((q, i) => [P(nfd(q.stem)), optsLine(q.opts.map(nfd), i), P(nfd("Lời giải")), P("ZZSOL")])];
    const r = parseAzotaBlocks(blocks);
    check("mốc 'Lời giải' ở dạng NFD vẫn ghép được (hoặc cảnh báo solution_unmatched)", r.questions.every((q, i) => letters(q) === "ABCD"[i]) || warnCodes(r).includes("solution_unmatched"), { ans: r.questions.map(letters), w: warnCodes(r) });
    check("đầu đề NFD + mốc NFC: vẫn ghép", (() => { const rr = parseAzotaBlocks([...examMC(), P("LỜI GIẢI CHI TIẾT"), P(H1), ...MCS.flatMap((q, i) => [P(nfd(q.stem)), optsLine(q.opts.map(nfd), i), P("Lời giải"), P("ZZSOL")])]); return rr.questions.every((q, i) => letters(q) === "ABCD"[i]); })());
  }

  section("A10) Hiệu năng: nhiều câu + nhiều lời giải (M ≠ N) không được làm treo; vượt trần 200 câu phải bị chặn SỚM");
  {
    const N = 1500;
    const bl: DocBlock[] = [P(H1)];
    const sol: DocBlock[] = [P("LỜI GIẢI CHI TIẾT"), P(H1)];
    for (let i = 0; i < N; i++) {
      const stem = `Cho dãy số thứ ${i} với công thức tổng quát $u_{n}=${i}n+${i * 7 + 3}$ và điều kiện kèm theo phía dưới đây, hãy tính số hạng thứ ${i + 5} của dãy số đó.`;
      const o = ["Một.", "Hai.", "Ba.", "Bốn."];
      bl.push(P(`Câu ${i + 1}.\t${stem}`), optsLine(o, null));
      if (i % 2 === 0) sol.push(P(stem), optsLine(o, 1), P("Lời giải"), P("x"));
    }
    const t0 = Date.now();
    const r = parseAzotaBlocks([...bl, ...sol]);
    const ms = Date.now() - t0;
    check(`PHÁT HIỆN P2: ${N} câu + ${N / 2} lời giải (M≠N) xử lý < 3 giây (đo ${ms} ms) — trần 200 câu chỉ kiểm SAU khi ghép`, ms < 3000, { ms });
    check("vượt trần 200 câu → fatal", r.fatal !== null && r.questions.length === 0, r.fatal);
  }

  // ───────────────────────────────────────────────────────────────────────────────────────
  section("B) Docx hỏng / bom / quá nhiều entry — phải từ chối bằng DocxError, nhanh, không treo");
  {
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const mk = async (files: Record<string, string | Buffer>, o: { level?: number } = {}) => {
      const z = new JSZip();
      z.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
      for (const [k, v] of Object.entries(files)) z.file(k, v);
      return z.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: o.level ?? 6 } });
    };
    const body = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>${inner}</w:body></w:document>`;
    const para = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
    const tryRead = async (name: string, buf: Buffer, want: "reject" | "ok-or-reject" = "reject", maxMs = 4000) => {
      const t0 = Date.now(); let res = "ok"; let threw: unknown = null;
      try { await readDocx(buf); } catch (e) { res = e instanceof DocxError ? e.code : "OTHER"; threw = e; }
      const ms = Date.now() - t0;
      const typed = res === "ok" || res === "NOT_DOCX" || res === "TOO_LARGE";
      check(`${name}: ${res} (${ms} ms), lỗi có kiểu DocxError, < ${maxMs} ms`, typed && ms < maxMs && (want === "ok-or-reject" || res !== "ok"), { res, ms, threw: threw instanceof Error ? threw.message.slice(0, 120) : threw });
    };
    const good = await mk({ "word/document.xml": body(para("PHẦN I. Câu trắc nghiệm. Thí sinh trả lời từ câu 1 đến câu 1.") + para("Câu 1. a") + para("A. x B. y")) });
    await tryRead("(0) docx hợp lệ vẫn đọc được", good, "ok-or-reject");
    await tryRead("(1) zip bị cắt đôi", good.subarray(0, Math.floor(good.length / 2)));
    await tryRead("(2) không phải zip", Buffer.from("PK\u0003\u0004 rác rác rác".repeat(50)));
    await tryRead("(3) zip rỗng không có word/document.xml", await mk({}));
    const many: Record<string, string> = { "word/document.xml": body(para("x")) };
    for (let i = 0; i < 1600; i++) many[`word/media/f${i}.txt`] = "x";
    await tryRead("(4) 1600 entry (> trần 1500)", await mk(many));
    await tryRead("(5) document.xml 9 MB (> trần 8 MB) nén cao", await mk({ "word/document.xml": body(para("a".repeat(9 * 1024 * 1024))) }, { level: 9 }));
    const laughs = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">]><w:document ${NS}><w:body><w:p><w:r><w:t>&lol3;</w:t></w:r></w:p></w:body></w:document>`;
    await tryRead("(6) DOCTYPE + thực thể lồng (billion laughs)", await mk({ "word/document.xml": laughs }));
    await tryRead("(7) tên entry có '../' và đường dẫn tuyệt đối", await mk({ "word/document.xml": body(para("x")), "../../evil.txt": "x", "/etc/passwd": "x" }), "ok-or-reject");
    let nest = ""; for (let i = 0; i < 5000; i++) nest += "<w:sdt><w:sdtContent>"; nest += para("x"); for (let i = 0; i < 5000; i++) nest += "</w:sdtContent></w:sdt>";
    await tryRead("(8) 5000 lớp sdt lồng", await mk({ "word/document.xml": body(nest) }));
    const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="file:///etc/passwd" TargetMode="External"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="../../../../etc/passwd"/></Relationships>`;
    const obj = (id: string) => `<w:p><w:r><w:object><v:shape xmlns:v="urn:schemas-microsoft-com:vml"><v:imagedata xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${id}"/></v:shape><o:OLEObject xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ProgID="Equation.DSMT4" r:id="${id}"/></w:object></w:r></w:p>`;
    await tryRead("(9) quan hệ oleObject trỏ file:/// và ../ — không đọc đĩa", await mk({ "word/document.xml": body(obj("rId1") + obj("rId2")), "word/_rels/document.xml.rels": rels }), "ok-or-reject");
  }

  section("B2) OLE/CFB bị đột biến ngẫu nhiên (seed cố định) — decode không ném, mỗi ca < 250 ms");
  {
    let seed = 0x9e3779b9;
    const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 0x100000000; };
    const base = oleOf(line(frac(num("1"), num("2")), vars("x")));
    const base2 = oleOf(line(tmpl(10, 0, line(vars("a")), line(num("3")))));
    let slow = 0, threw = 0, worst = 0;
    for (let i = 0; i < 400; i++) {
      const src = Buffer.from(i % 2 ? base : base2);
      const nflip = 1 + Math.floor(rnd() * 12);
      for (let k = 0; k < nflip; k++) src[Math.floor(rnd() * src.length)] = Math.floor(rnd() * 256);
      if (i % 7 === 0) src.writeUInt32LE(0xffffff00 + Math.floor(rnd() * 255), 8 * Math.floor(rnd() * 60)); // số lớn ở chỗ ngẫu nhiên
      const t0 = Date.now();
      try { const r = decodeMathTypeOle(src); if (typeof r.ok !== "boolean") threw++; } catch { threw++; }
      const ms = Date.now() - t0; worst = Math.max(worst, ms); if (ms > 250) slow++;
    }
    check(`400 ca đột biến: 0 ném, 0 ca chậm (tệ nhất ${worst} ms)`, threw === 0 && slow === 0, { threw, slow, worst });
    const trunc: boolean[] = [];
    for (const n of [0, 1, 7, 8, 100, 511, 512, 513, 700, base.length - 1]) { try { decodeMathTypeOle(base.subarray(0, n)); trunc.push(true); } catch { trunc.push(false); } }
    check("cắt cụt ở mọi mốc (0,1,7,8,100,511,512,513,700,n-1) không ném", trunc.every(Boolean), trunc);
    const unk = decodeMathTypeOle(oleOf(line(tmpl(250, 0, line(num("1"))))));
    check("công thức cấu trúc KHÔNG hỗ trợ (selector 250): ok=false hoặc có đánh dấu chưa chắc — không trả LaTeX 'chắc chắn' sai", unk.ok === false || ("verified" in unk ? (unk as { verified?: boolean }).verified !== true : true), unk.ok ? { latex: (unk as { latex?: string }).latex } : unk);
  }

  // ───────────────────────────────────────────────────────────────────────────────────────
  section("C) Token ảnh giả {{ctimg:…}} — đi hết đường đọc Word → toQuizInput → coerceQuestionInput → hiển thị");
  {
    const okSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10pt" height="10pt" viewBox="0 0 10 10"><text y="5" font-size="4"><tspan x="1">a</tspan></text></svg>';
    const forge = (svg: string) => `{{ctimg:${Buffer.from(svg).toString("base64")}}}`;
    const EVIL = [okSvg.replace("<text", "<script>alert(1)</script><text"), okSvg.replace("<svg ", '<svg onload="alert(1)" '), okSvg.replace("<text", '<image href="https://evil/x.png"/><text'),
      okSvg.replace("<text", '<use xlink:href="#a"/><text'), okSvg.replace("<text", "<style>*{background:url(x)}</style><text"), okSvg.replace('viewBox="0 0 10 10"', 'viewBox="0 0 10 10" style="x"')].map(forge);
    const BAD = /onload|<script|<image|<use|<style|alert\(1\)|href=/i;
    // Gia sư (hoặc ai đó) gõ nguyên token độc vào Word → qua parse
    const blocks: DocBlock[] = [P(H1), P(`Câu 1.\tCho ${EVIL[0]} và ${EVIL[1]} xét ${EVIL[2]}`), optsLine([EVIL[3], EVIL[4], EVIL[5], "Bốn."], 0), P("Lời giải"), P(`Giải ${EVIL.join(" ")}`)];
    const r = parseAzotaBlocks(blocks);
    const q = r.questions[0];
    const input = toQuizInput(q);
    const co = coerceQuestionInput(input);
    const blob = "error" in co ? "" : JSON.stringify(co);
    check("sau coerceQuestionInput không còn token độc nào trong text/option/explanation", !("error" in co) && !BAD.test(Buffer.from(blob.replace(/\{\{ctimg:([A-Za-z0-9+/=]+)\}\}/g, (_m, b) => Buffer.from(b, "base64").toString("utf8")), "utf8").toString()), blob.slice(0, 200));
    // Hiển thị: dù dữ liệu cũ đã nằm trong DB, MathText tự kiểm
    const hostile = [...EVIL, "{{ctimg:" + "A".repeat(9000) + "}}", "{{ctimg:!!!}}", "{{CTIMG:" + Buffer.from(okSvg).toString("base64") + "}}", "｛｛ctimg:" + Buffer.from(okSvg).toString("base64") + "｝｝",
      "{{ctimg:{{ctimg:" + Buffer.from(okSvg).toString("base64") + "}}}}", "{{ctimg:" + Buffer.from(okSvg).toString("base64") + "​}}", "{{ctimg: " + Buffer.from(okSvg).toString("base64") + " }}"];
    let leak = 0;
    for (const h of hostile) { const out = renderMathText(h); if (/<img[^>]*(onerror|onload)|<script|javascript:/i.test(out)) leak++; if ((out.match(/<img /g) ?? []).length > 1) leak++; }
    check("renderMathText với 13 chuỗi độc/lệch: không script, không onerror, tối đa 1 ảnh", leak === 0, leak);
    const many = Array.from({ length: FORMULA_MAX_TOKENS_PER_FIELD + 5 }, () => makeFormulaImgToken(okSvg)!).join(" ");
    check(`${FORMULA_MAX_TOKENS_PER_FIELD + 5} token hợp lệ trong một trường → render tối đa ${FORMULA_MAX_TOKENS_PER_FIELD} ảnh`, (renderMathText(many).match(/<img /g) ?? []).length === FORMULA_MAX_TOKENS_PER_FIELD, (renderMathText(many).match(/<img /g) ?? []).length);
    check("sanitize: token hợp lệ giữ nguyên, token vượt trần → nhãn", (sanitizeFormulaImgTokens(many).match(/\{\{ctimg:/g) ?? []).length === FORMULA_MAX_TOKENS_PER_FIELD && sanitizeFormulaImgTokens(many).includes("⟦công thức⟧"));
    // trường KHÔNG qua coerce: sectionLabel / rubric.name đã sanitize; kiểm đặc biệt Unicode "ctimg" trong imageUrl
    const co2 = coerceQuestionInput({ type: "MC", text: "Q", points: 1, imageUrl: "https://x/y{{ctimg:AAAA}}.png", options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] });
    check("imageUrl chứa dấu { } bị loại (không dùng làm kênh chui token)", !("error" in co2) && co2.imageUrl === null, "error" in co2 ? co2.error : co2.imageUrl);
  }

  done();
})();
