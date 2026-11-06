// BU-03 — đọc đáp án + lời giải từ mục "LỜI GIẢI CHI TIẾT" (lời giải KHÔNG đánh "Câu N."). THUẦN: không DB, không mạng; DocBlock dựng tay.
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-azota-solution-lib.ts
// Luật được kiểm: ghép theo THỨ TỰ trong từng PHẦN nhưng MỖI cặp phải đối chiếu được đầu đề (headScore ≥ SOL_SIM_MIN); không khớp → BỎ + cảnh báo kèm mã câu;
// đáp án đọc từ đây mang cờ answer_from_solution (cảnh báo, không chặn); mâu thuẫn nguồn khác → answer_conflict; bảng đáp án cuối giữ hành vi cũ.
// Ca phá cố ý (sửa mã → ca tương ứng đỏ):
//   - azotaDocx.ts headScore: `return 1` ngay đầu hàm (không đối chiếu) → ca 'lời giải đảo thứ tự', 'lời giải của câu khác', 'khác một con số', 'lệch PHẦN' đỏ vì ghép sai;
//   - headScore: bỏ cổng `dig(a) !== dig(b)` → ca 'khác MỘT con số trong đầu đề → bỏ' đỏ;
//   - headScore: bỏ `Math.min(..) < SOL_MIN_LEN` → ca 'đầu đề ngắn (<SOL_MIN_LEN) chỉ nhận khi bằng nhau' đỏ;
//   - matchSolutionSection: bỏ nhánh `M === N` (luôn theo nội dung) → ca 'trùng đầu đề, đủ số lời giải → theo vị trí' đỏ; đổi `hits.length === 1` thành `>= 1` → ca 'trùng đầu đề, thiếu lời giải → bỏ cả hai' đỏ;
//   - bỏ `bodyOk` và đổi nhánh dự phòng của `bodyEnd` thành `markers[j + 1]` (luôn lấy thân, kể cả khi lời giải kế không khớp) → ca 'lời giải kế không khớp → bỏ thân câu trước' đỏ;
//   - bỏ `ANSWER_SHEET_RE`/`sheetSkip` → ca 'PHIẾU TRẢ LỜI không dính cuối câu cuối' đỏ;
//   - essayToShort: bỏ `matches.every(... SOL_NUMBER_RE ...)` hoặc `matches.length === N` → ca 'Tự luận giữ ESSAY khi có câu không phải số / thiếu lời giải' đỏ;
//   - bỏ `if (first.fromSol) fromSolFlag()` và `d.solExpl` → ca 'cờ answer_from_solution' đỏ; đổi src "loi-giai" thành đứng trước 'bang-het' trong SRC_ORDER không ảnh hưởng (vẫn xung đột đúng).
import { check, section, done } from "./h";
import { parseAzotaBlocks, AZOTA_MAX_SOLUTION_ENTRIES, headScore, normHead, SOL_SIM_MIN, type DocBlock, type DocRun, type AzotaParse } from "@/lib/azotaDocx";
import { makeFormulaImgToken } from "@/lib/mathtype/formulaImg";

const T = (t: string): DocRun => ({ text: t });
const U = (t: string): DocRun => ({ text: t, underline: true });
const P = (...runs: (string | DocRun)[]): DocBlock => ({ kind: "p", runs: runs.map(r => (typeof r === "string" ? T(r) : r)) });

const HDR1 = "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu 3. Mỗi câu hỏi thí sinh chỉ chọn một phương án.";
const HDR2 = "PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu 2. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.";
const HDR3 = "PHẦN III. Tự luận. Thí sinh trả lời từ câu 1 đến câu 2.";

// ── Dữ liệu câu ─────────────────────────────────────────────────────────────────────────────
const MC = [
  { stem: "Họ nguyên hàm của hàm số $f\\left(x\\right)=\\cos x+6x$ là", opts: ["$\\sin x+3x^{2}+C$.", "$-\\sin x+3x^{2}+C$.", "$\\sin x+6x^{2}+C$.", "$-\\sin x+C$."] },
  { stem: "Cho hàm số $f\\left(x\\right)=e^{x}+2$. Khẳng định nào dưới đây là đúng?", opts: ["$\\int f\\left(x\\right)\\text{d}x=e^{x-2}+C$.", "$\\int f\\left(x\\right)\\text{d}x=e^{x}+2x+C$.", "$\\int f\\left(x\\right)\\text{d}x=e^{x}+C$.", "$\\int f\\left(x\\right)\\text{d}x=e^{x}-2x+C$."] },
  { stem: "Tìm nguyên hàm của hàm số $f\\left(x\\right)=\\sqrt{2x-1}$ với $x\\in \\left(\\frac{1}{2};\\,+\\infty \\right)$.", opts: ["$\\frac{2}{3}\\left(2x-1\\right)\\sqrt{2x-1}+C$.", "$\\frac{1}{3}\\left(2x-1\\right)\\sqrt{2x-1}+C$.", "$-\\frac{1}{3}\\sqrt{2x-1}+C$.", "$\\frac{1}{2}\\sqrt{2x-1}+C$."] },
];
const TF = [
  { stem: "Biết rằng hàm số $f\\left(x\\right)=ax^{2}+bx+c$ thỏa mãn $\\int\\limits_{0}^{1} f\\left(x\\right)dx=-\\frac{7}{6}$ và $F\\left(x\\right)$ là một nguyên hàm của $f$ trên đoạn $\\left[0;2\\right]$.", subs: ["$F\\left(1\\right)-F\\left(0\\right)=-\\frac{7}{6}$.", "Cho $F\\left(0\\right)=3$, khi đó $F\\left(2\\right)=5$.", "$\\int f\\left(x\\right)dx=\\int \\left(ax^{2}\\right)dx$.", "$a+b+3c=-12$."] },
  { stem: "Cho $y=f'\\left(x\\right)$ là hàm số bậc 3 có đồ thị như hình vẽ bên, biết $f\\left(2\\right)=3,\\ f\\left(1\\right)=1$. Xét các mệnh đề sau.", subs: ["Hàm số $f$ đồng biến trên khoảng $\\left(1;2\\right)$.", "Phương trình $f\\left(x\\right)=0$ có ba nghiệm.", "Giá trị $f\\left(0\\right)=-2$.", "Hàm số $f$ có hai điểm cực trị."] },
];
const ES = [
  { stem: "Biết $\\int \\frac{4x-1}{2x^{2}+5x-3}dx=a\\ln \\left|2x-1\\right|+b\\ln \\left|x+3\\right|+C$. Tính $S=2a+3b$." },
  { stem: "Một ô tô chuyển động với vận tốc $v\\left(t\\right)=2t-3\\ \\left(\\text{m}/\\text{s}\\right)$. Tính quãng đường đi được sau 9 giây." },
];

// Đề (phần câu hỏi)
function examBlocks(o: { dropMcQ?: number } = {}): DocBlock[] {
  const b: DocBlock[] = [P("ĐỀ SỐ 1"), P(HDR1)];
  MC.forEach((q, i) => {
    if (o.dropMcQ === i) return;
    b.push(P(`Câu ${i + 1}.\t${q.stem}`), P(q.opts.map((t, k) => `${"ABCD"[k]}. ${t}`).join("\t")));
  });
  b.push(P(HDR2));
  TF.forEach((q, i) => { b.push(P(`Câu ${i + 1}.\t${q.stem}`)); q.subs.forEach((s, k) => b.push(P(`${"abcd"[k]}) ${s}`))); });
  b.push(P(HDR3));
  ES.forEach((q, i) => b.push(P(`Câu ${i + 1}.\t${q.stem}`)));
  return b;
}
// Phần lời giải
const optsP = (opts: string[], correct: number | null): DocBlock => {
  const runs: DocRun[] = [];
  opts.forEach((t, k) => { const sep = k < 3 ? "\t" : ""; if (k === correct) runs.push(U("ABCD"[k]), T(`. ${t}${sep}`)); else runs.push(T(`${"ABCD"[k]}. ${t}${sep}`)); });
  return { kind: "p", runs };
};
const mcEntry = (i: number, correct: number | null, body: string[] = ["Ta có kết quả."]): DocBlock[] => [P(MC[i].stem), optsP(MC[i].opts, correct), P("Lời giải"), ...body.map(x => P(x))];
const tfEntry = (i: number, vec: string, body: string[] = []): DocBlock[] => [
  P(TF[i].stem), ...TF[i].subs.map((s, k) => P(`${"abcd"[k]}) ${s}`)), P("Lời giải"),
  ...[..."abcd"].map((l, k) => P(`${l}) ${vec[k] === "Đ" ? "Đúng" : "Sai"}. Giải thích ý ${l}.`)), ...body.map(x => P(x)),
];
const esEntry = (i: number, ans: string | null, body: string[] = ["Ta có lời giải ngắn gọn."]): DocBlock[] => [P(ES[i].stem), P("Lời giải"), ...(ans === null ? [] : [P(`Trả lời: ${ans}`)]), ...body.map(x => P(x))];

interface SolOpts { mc?: DocBlock[][]; tf?: DocBlock[][]; es?: DocBlock[][] }
const solBlocks = (o: SolOpts): DocBlock[] => [P("PHIẾU TRẢ LỜI"), P(""), P("LỜI GIẢI CHI TIẾT"), P(HDR1), ...(o.mc ?? []).flat(), P(HDR2), ...(o.tf ?? []).flat(), P(HDR3), ...(o.es ?? []).flat()];
const GOOD: SolOpts = { mc: [mcEntry(0, 0), mcEntry(1, 1), mcEntry(2, 1)], tf: [tfEntry(0, "ĐSSĐ"), tfEntry(1, "SSĐĐ")], es: [esEntry(0, "36"), esEntry(1, "76,5")] };

const run = (o: SolOpts, ex: DocBlock[] = examBlocks()): AzotaParse => parseAzotaBlocks([...ex, ...solBlocks(o)]);
const byKey = (p: AzotaParse, k: string) => p.questions.find(q => q.key === k)!;
const letters = (q: AzotaParse["questions"][number]) => q.options.map((o, i) => (o.isCorrect ? "ABCD"[i] : "")).join("");
const tfv = (q: AzotaParse["questions"][number]) => q.options.map(o => (o.isCorrect ? "Đ" : "S")).join("");
const hasW = (p: AzotaParse, code: string, key?: string) => p.warnings.some(w => w.code === code && (key === undefined || w.question === key));

(async () => {
  section("headScore / normHead (hàm thuần)");
  {
    const a = normHead("Cho $\\int f(x)dx=5$ với  $x>0$ thì kết quả bằng"), b = normHead("Cho$\\int f(x)dx=5$ với $x>0$ thì kết quả bằng");
    check("khác nhau chỉ khoảng trắng/dấu → bằng nhau (1)", headScore(a, b) === 1, [a, b]);
    const s1 = normHead("Tìm giá trị nhỏ nhất của hàm số"), s2 = normHead("Tìm giá trị lớn nhất của hàm số");
    check("đầu đề ngắn (<SOL_MIN_LEN ký tự chuẩn hoá) chỉ nhận khi bằng nhau hoàn toàn (khác một từ, cùng dãy số → 0)", s1.length < 30 && headScore(s1, s2) === 0 && headScore(s1, s1) === 1, [s1.length, headScore(s1, s2)]);
    const long = "Tìm nguyên hàm của hàm số fx bằng cách sử dụng phương pháp đổi biến số với x thuộc khoảng";
    check("khác MỘT con số (đủ dài) → 0 dù gần như giống hệt", headScore(normHead(long + " 2"), normHead(long + " 3")) === 0);
    check("khác chữ nhẹ, cùng dãy số → vượt ngưỡng", headScore(normHead(long + " 2 và 4"), normHead(long.replace("Tìm", "Hãy tìm") + " 2 và 4")) >= SOL_SIM_MIN);
    check("hai đầu đề khác hẳn → dưới ngưỡng", headScore(normHead(long), normHead("Một vật chuyển động thẳng đều với vận tốc không đổi trong suốt quá trình khảo sát")) < SOL_SIM_MIN);
    check("rỗng → 0", headScore("", normHead(long)) === 0);
  }

  section("Ca tốt: ghép đủ, đáp án + lời giải từ mục LỜI GIẢI CHI TIẾT");
  {
    const p = run(GOOD);
    check("22→ đọc đủ 7 câu, không lỗi cứng", p.questions.length === 7 && p.errors.length === 0 && p.fatal === null, { n: p.questions.length, e: p.errors });
    check("solutionStats: 7 lời giải, 7 ghép, 0 bỏ", p.solutionStats?.entries === 7 && p.solutionStats.matched === 7 && p.solutionStats.dropped === 0, p.solutionStats);
    check("MC: A, B, B từ nhãn gạch chân; answerSource loi-giai", letters(byKey(p, "s1-1")) === "A" && letters(byKey(p, "s1-2")) === "B" && letters(byKey(p, "s1-3")) === "B" && byKey(p, "s1-1").answerSource === "loi-giai");
    check("Đ/S: ĐSSĐ và SSĐĐ từ 'a) Đúng/Sai'", tfv(byKey(p, "s2-1")) === "ĐSSĐ" && tfv(byKey(p, "s2-2")) === "SSĐĐ" && byKey(p, "s2-1").answerSource === "loi-giai");
    check("Phần III 'Tự luận' mà mọi câu ghi 'Trả lời: số' → SHORT_ANSWER 36 và 76,5", byKey(p, "s3-1").type === "SHORT_ANSWER" && byKey(p, "s3-1").options[0]?.text === "36" && byKey(p, "s3-2").options[0]?.text === "76,5", p.questions.filter(q => q.sectionIndex === 3).map(q => [q.type, q.options]));
    check("dòng 'Trả lời: …' không lẫn vào lời giải chữ của SHORT_ANSWER", !byKey(p, "s3-1").explanation.includes("Trả lời") && byKey(p, "s3-1").explanation.includes("lời giải ngắn gọn"));
    check("lời giải chữ vào explanation (MC)", byKey(p, "s1-1").explanation === "Ta có kết quả.");
    check("mọi câu có cờ answer_from_solution (cảnh báo, không có answer_missing/conflict)", p.questions.every(q => q.flags.includes("answer_from_solution") && !q.flags.includes("answer_missing") && !q.flags.includes("answer_conflict")));
    check("withAnswer = 7", p.stats.withAnswer === 7, p.stats);
    check("có cảnh báo tổng solution_summary", hasW(p, "solution_summary"));
    check("byType phản ánh SHORT_ANSWER (6 → 2 câu III)", p.stats.byType.SHORT_ANSWER === 2 && !p.stats.byType.ESSAY, p.stats.byType);
  }

  section("PHIẾU TRẢ LỜI không dính cuối câu cuối");
  {
    const p = run(GOOD);
    check("chữ 'PHIẾU TRẢ LỜI' không nằm trong câu cuối (s3-2)", !byKey(p, "s3-2").text.includes("PHIẾU") && !byKey(p, "s3-2").explanation.includes("PHIẾU"), byKey(p, "s3-2").text);
    check("nội dung thật của câu cuối còn nguyên", byKey(p, "s3-2").text.endsWith("sau 9 giây."), byKey(p, "s3-2").text);
    // Không đứng riêng một đoạn → không cắt (không cắt nội dung thật)
    const ex = examBlocks(); ex.push(P("Chép lại vào PHIẾU TRẢ LỜI của em."));
    const p2 = parseAzotaBlocks([...ex]);
    check("'PHIẾU TRẢ LỜI' nằm trong câu chữ khác → giữ nguyên", p2.questions.at(-1)!.text.includes("PHIẾU TRẢ LỜI"));
    // Không có mục lời giải: chỉ bỏ dòng PHIẾU đứng riêng
    const ex3 = examBlocks(); ex3.push(P("PHIẾU TRẢ LỜI"), { kind: "table", rows: [[{ paragraphs: [[T("1")]] }, { paragraphs: [[T("")]] }]] });
    const p3 = parseAzotaBlocks(ex3);
    check("dòng 'PHIẾU TRẢ LỜI' đứng riêng + bảng trống phía sau bị bỏ khỏi câu cuối", !p3.questions.at(-1)!.text.includes("PHIẾU") && !p3.questions.at(-1)!.text.includes("|"), p3.questions.at(-1)!.text);
  }

  section("Lời giải đảo thứ tự / của câu khác / lệch PHẦN → BỊ BỎ, không ghép");
  {
    const swap = run({ ...GOOD, mc: [mcEntry(1, 1), mcEntry(0, 0), mcEntry(2, 1)] });
    check("đảo 2 lời giải đầu (đủ số lượng, theo vị trí): cả hai BỊ BỎ, câu 1-2 không có đáp án", swap.questions.filter(q => q.key === "s1-1" || q.key === "s1-2").every(q => q.answerSource === "khong-co" && q.flags.includes("answer_missing") && !q.flags.includes("answer_from_solution") && q.explanation === ""), swap.questions.slice(0, 2));
    check("cảnh báo solution_unmatched kèm MÃ CÂU s1-1 và s1-2", hasW(swap, "solution_unmatched", "s1-1") && hasW(swap, "solution_unmatched", "s1-2"), swap.warnings.map(w => w.code + w.question));
    check("câu 3 (đúng vị trí) vẫn ghép", letters(byKey(swap, "s1-3")) === "B" && byKey(swap, "s1-3").answerSource === "loi-giai");
    check("solutionStats: ghép 5, bỏ 2", swap.solutionStats?.matched === 5 && swap.solutionStats.dropped === 2, swap.solutionStats);

    // Lời giải của câu KHÁC hẳn (nội dung ngoài đề) ở vị trí câu 2
    const alien: DocBlock[] = [P("Một vật dao động điều hòa với biên độ 5 cm và chu kì 2 s. Tính vận tốc cực đại của vật."), optsP(["5π cm/s", "10π cm/s", "2,5π cm/s", "20π cm/s"], 0), P("Lời giải"), P("Ta có v = Aω.")];
    const other = run({ ...GOOD, mc: [mcEntry(0, 0), alien, mcEntry(2, 1)] });
    check("lời giải của câu không thuộc đề → bỏ; không lấy đáp án của nó cho câu 2", byKey(other, "s1-2").answerSource === "khong-co" && byKey(other, "s1-2").explanation === "" && hasW(other, "solution_unmatched", "s1-2"));
    check("hai câu còn lại vẫn ghép đúng (không bị ảnh hưởng ranh giới)", letters(byKey(other, "s1-1")) === "A" && letters(byKey(other, "s1-3")) === "B");
    check("câu 1: thân lời giải của câu 1 KHÔNG nuốt đầu đề lời giải lạ (ranh giới không chắc → bỏ thân)", !byKey(other, "s1-1").explanation.includes("dao động") && byKey(other, "s1-1").explanation === "");

    // Lệch PHẦN: lời giải phần I nằm dưới PHẦN II
    const wrongSec = run({ mc: [], tf: [mcEntry(0, 0), mcEntry(1, 1), mcEntry(2, 1)], es: GOOD.es });
    check("lệch PHẦN: lời giải MC đặt dưới PHẦN II → không ghép cho MC lẫn Đ/S", byKey(wrongSec, "s1-1").answerSource === "khong-co" && byKey(wrongSec, "s2-1").answerSource === "khong-co" && byKey(wrongSec, "s2-2").answerSource === "khong-co", wrongSec.questions.map(q => q.key + q.answerSource));
    check("lệch PHẦN: Phần III (đúng chỗ) vẫn ghép", byKey(wrongSec, "s3-1").options[0]?.text === "36");

    // Khác MỘT con số trong đầu đề
    const diffNum = mcEntry(1, 1); (diffNum[0] as { runs: DocRun[] }).runs = [T(MC[1].stem.replace("e^{x}+2", "e^{x}+3"))];
    const dn = run({ ...GOOD, mc: [mcEntry(0, 0), diffNum, mcEntry(2, 1)] });
    check("khác MỘT con số trong đầu đề (e^x+2 → e^x+3) → bỏ", byKey(dn, "s1-2").answerSource === "khong-co" && hasW(dn, "solution_unmatched", "s1-2"));
  }

  section("Lời giải thiếu câu / thừa câu");
  {
    const miss = run({ ...GOOD, mc: [mcEntry(0, 0), mcEntry(2, 1)] });
    check("thiếu lời giải câu 2: câu 1 và 3 ghép theo nội dung, câu 2 không có", letters(byKey(miss, "s1-1")) === "A" && letters(byKey(miss, "s1-3")) === "B" && byKey(miss, "s1-2").answerSource === "khong-co", miss.questions.slice(0, 3).map(q => q.answerSource));
    check("cảnh báo câu 2 chưa đối chiếu được (có mã s1-2)", hasW(miss, "solution_unmatched", "s1-2"));
    check("thiếu lời giải: câu 1 vẫn nhận đúng thân (không nuốt đầu đề câu 3)", byKey(miss, "s1-1").explanation === "Ta có kết quả.");
    // Thiếu lời giải CUỐI
    const missLast = run({ ...GOOD, mc: [mcEntry(0, 0), mcEntry(1, 1)] });
    check("thiếu lời giải câu cuối: 2 câu đầu ghép, câu 3 có cảnh báo", letters(byKey(missLast, "s1-2")) === "B" && byKey(missLast, "s1-3").answerSource === "khong-co" && hasW(missLast, "solution_unmatched", "s1-3"));
    // Thừa: một lời giải lạ chen giữa
    const alien: DocBlock[] = [P("Một chất điểm chuyển động thẳng đều trong khoảng thời gian 10 giây với quãng đường 50 mét."), optsP(["5", "10", "15", "20"], 1), P("Lời giải"), P("v = s/t.")];
    const extra = run({ ...GOOD, mc: [mcEntry(0, 0), alien, mcEntry(1, 1), mcEntry(2, 1)] });
    check("thừa một lời giải lạ: bỏ nó, ba câu còn lại ghép đúng", extra.questions.filter(q => q.key.startsWith("s1-")).map(letters).join() === "A,B,B" && extra.warnings.some(w => w.code === "solution_unmatched" && /không khớp/.test(w.message)), extra.warnings.filter(w => w.code === "solution_unmatched").map(w => w.question + "|" + w.message));
    // Phần không có lời giải nào
    const none = run({ mc: [], tf: GOOD.tf, es: GOOD.es });
    check("phần I không có lời giải: cả 3 câu cảnh báo solution_unmatched, không đoán đáp án", ["s1-1", "s1-2", "s1-3"].every(k => byKey(none, k).answerSource === "khong-co" && hasW(none, "solution_unmatched", k)));
  }

  section("Trùng đầu đề");
  {
    // Hai câu MC giống hệt nhau (đề + phương án), đáp án khác nhau trong lời giải
    const dupEx: DocBlock[] = [P(HDR1), P(`Câu 1.\t${MC[0].stem}`), P(MC[0].opts.map((t, k) => `${"ABCD"[k]}. ${t}`).join("\t")), P(`Câu 2.\t${MC[0].stem}`), P(MC[0].opts.map((t, k) => `${"ABCD"[k]}. ${t}`).join("\t"))];
    const sol = (e: DocBlock[][]): DocBlock[] => [P("LỜI GIẢI CHI TIẾT"), P(HDR1), ...e.flat()];
    const both = parseAzotaBlocks([...dupEx, ...sol([mcEntry(0, 0, ["Lời giải thứ nhất."]), mcEntry(0, 2, ["Lời giải thứ hai."])])]);
    // Cổng "duy nhất" (kiểm thử độc lập P2-1): hai câu giống hệt thì mỗi lời giải khớp CẢ HAI câu → không đoán, bỏ cả hai kèm solution_unmatched.
    check("trùng đầu đề, ĐỦ số lời giải → mơ hồ: KHÔNG ghép (không gán chéo), cả hai câu solution_unmatched", both.questions.every(q => letters(q) === "" && q.explanation === "" && !q.flags.includes("answer_from_solution")) && both.questions.every(q => hasW(both, "solution_unmatched", q.key)), both.questions.map(letters));
    const less = parseAzotaBlocks([...dupEx, ...sol([mcEntry(0, 0)])]);
    check("trùng đầu đề, THIẾU lời giải → mơ hồ: KHÔNG ghép cho câu nào", less.questions.every(q => q.answerSource === "khong-co" && q.explanation === "") && less.solutionStats?.matched === 0, less.solutionStats);
  }

  section("Lời giải rỗng / thân trống");
  {
    const p = run({ mc: [mcEntry(0, 0, []), mcEntry(1, null, []), mcEntry(2, 1, [])], tf: [tfEntry(0, "ĐSSĐ").slice(0, 6), tfEntry(1, "SSĐĐ").slice(0, 6)], es: [esEntry(0, null, []), esEntry(1, null, [])] });
    check("thân rỗng: không vỡ, ghép đủ 7", p.questions.length === 7 && p.solutionStats?.matched === 7, p.solutionStats);
    check("MC thân rỗng nhưng nhãn gạch chân vẫn cho đáp án (cờ answer_from_solution), explanation rỗng", letters(byKey(p, "s1-1")) === "A" && byKey(p, "s1-1").explanation === "" && byKey(p, "s1-1").flags.includes("answer_from_solution"));
    check("MC không gạch chân, thân rỗng → answer_missing (không đoán)", byKey(p, "s1-2").flags.includes("answer_missing") && letters(byKey(p, "s1-2")) === "");
    check("Đ/S thân rỗng → không có đáp án (answer_missing), không đoán", byKey(p, "s2-1").flags.includes("answer_missing") && byKey(p, "s2-1").options.every(o => !o.isCorrect));
    check("Tự luận thân rỗng → giữ ESSAY", byKey(p, "s3-1").type === "ESSAY" && byKey(p, "s3-2").type === "ESSAY");
  }

  section("Tự luận → SHORT_ANSWER chỉ khi CHẮC theo cấu trúc phần");
  {
    const one = run({ ...GOOD, es: [esEntry(0, "36"), esEntry(1, "7,5 m")] });
    check("một câu 'Trả lời: 7,5 m' (không thuần số) → cả phần giữ ESSAY", byKey(one, "s3-1").type === "ESSAY" && byKey(one, "s3-2").type === "ESSAY");
    check("ESSAY vẫn nhận lời giải chữ (kèm dòng Trả lời) + cờ", byKey(one, "s3-1").explanation.includes("Trả lời: 36") && !byKey(one, "s3-1").flags.includes("answer_from_solution"));
    check("ESSAY chỉ lấy lời giải chữ, không có đáp án → KHÔNG bật cờ answer_from_solution (cờ chỉ khi đáp án thật sự từ lời giải)", byKey(one, "s3-1").answerSource === "khong-co");
    const lone = run({ ...GOOD, es: [esEntry(0, "36")] });
    check("thiếu lời giải một câu → phần giữ ESSAY (câu có lời giải cũng không đổi loại)", byKey(lone, "s3-1").type === "ESSAY" && byKey(lone, "s3-2").type === "ESSAY");
    const late = run({ ...GOOD, es: [esEntry(0, "36", ["Bước 1.", "Trả lời: 99"]), esEntry(1, "76,5")] });
    check("'Trả lời' chỉ lấy ở 2 dòng đầu thân, không lấy dòng ở giữa", byKey(late, "s3-1").options[0]?.text === "36");
    const dap = run({ ...GOOD, es: [esEntry(0, "56,8"), esEntry(1, "-0,3")] }); // "-0,3" đầu dòng
    check("số âm với dấu phẩy: -0,3 → SHORT_ANSWER", byKey(dap, "s3-2").type === "SHORT_ANSWER" && byKey(dap, "s3-2").options[0]?.text === "-0,3");
    // Phần III khai báo 'trả lời ngắn' sẵn
    const sa = parseAzotaBlocks([P("PHẦN III. Trả lời ngắn."), P(`Câu 1.\t${ES[0].stem}`), P("LỜI GIẢI CHI TIẾT"), P("PHẦN III. Trả lời ngắn."), P(ES[0].stem), P("Lời giải"), P("Trả lời: 12")]);
    check("phần khai báo 'Trả lời ngắn': lấy 'Trả lời: 12' làm đáp án", sa.questions[0]?.type === "SHORT_ANSWER" && sa.questions[0].options[0]?.text === "12" && sa.questions[0].flags.includes("answer_from_solution"), sa.questions[0]);
  }

  section("Mâu thuẫn với nguồn đáp án khác → answer_conflict như cũ, không ghi đè");
  {
    // Bảng đáp án sau HẾT nói MC câu 1 = B; lời giải gạch chân A
    const keyTbl: DocBlock[] = [P("-----HẾT-----"), P("1-B, 2-B, 3-B")];
    // HẾT nằm SAU mục lời giải
    const conflict = parseAzotaBlocks([...examBlocks(), ...solBlocks(GOOD), ...keyTbl]);
    check("lời giải = A, bảng = B → answer_conflict, KHÔNG chọn đáp án nào", byKey(conflict, "s1-1").flags.includes("answer_conflict") && letters(byKey(conflict, "s1-1")) === "", byKey(conflict, "s1-1"));
    check("câu khớp (lời giải B = bảng B) → nhận, nguồn bang-het (thứ tự cũ), không xung đột", letters(byKey(conflict, "s1-2")) === "B" && byKey(conflict, "s1-2").answerSource === "bang-het" && !byKey(conflict, "s1-2").flags.includes("answer_conflict"));
    // Đề có gạch chân ngay trong câu hỏi + lời giải mâu thuẫn
    const ex = examBlocks();
    const idx = ex.findIndex(b => b.kind === "p" && b.runs[0].text.startsWith("A. ") && b.runs[0].text.includes("\\cos") === false && b.runs[0].text.includes("\\sin x+3x^{2}"));
    (ex[idx] as { runs: DocRun[] }).runs = [T("A. "), T(MC[0].opts[0] + "\t"), U("B"), T(`. ${MC[0].opts[1]}\tC. ${MC[0].opts[2]}\tD. ${MC[0].opts[3]}`)];
    const c2 = run(GOOD, ex);
    check("đáp án gạch chân ngay trong đề (B) ≠ lời giải (A) → answer_conflict", c2.questions[0].flags.includes("answer_conflict") && letters(c2.questions[0]) === "", c2.questions[0].flags);
    // Nội bộ: nhãn gạch chân A nhưng thân ghi 'Chọn C'
    const c3 = run({ ...GOOD, mc: [mcEntry(0, 0, ["Chọn C", "Vì ..."]), mcEntry(1, 1), mcEntry(2, 1)] });
    check("trong mục lời giải: gạch chân A nhưng thân 'Chọn C' → answer_conflict", byKey(c3, "s1-1").flags.includes("answer_conflict") && letters(byKey(c3, "s1-1")) === "");
    // Nội bộ khớp: gạch chân D + 'Chọn D'
    const c4 = run({ ...GOOD, mc: [mcEntry(0, 3, ["Chọn D"]), mcEntry(1, 1), mcEntry(2, 1)] });
    check("gạch chân D + 'Chọn D' khớp → nhận D", letters(byKey(c4, "s1-1")) === "D" && !byKey(c4, "s1-1").flags.includes("answer_conflict"));
    // Gạch chân hai nhãn ở MC một đáp án = không chắc
    const two: DocBlock = { kind: "p", runs: [U("A"), T(`. ${MC[0].opts[0]}\t`), U("B"), T(`. ${MC[0].opts[1]}\tC. ${MC[0].opts[2]}\tD. ${MC[0].opts[3]}`)] };
    const c5 = run({ ...GOOD, mc: [[P(MC[0].stem), two, P("Lời giải"), P("Ta có.")], mcEntry(1, 1), mcEntry(2, 1)] });
    check("MC có 2 nhãn gạch chân trong lời giải → answer_conflict (không đoán)", byKey(c5, "s1-1").flags.includes("answer_conflict") && letters(byKey(c5, "s1-1")) === "");
  }

  section("Cổng chống ghép sai ở mức đầu đề");
  {
    // Đầu đề lời giải chỉ khác chữ (tránh 'nhận nhầm' vẫn ghép được) – cho phép khi cùng dãy số
    const stem = "Hãy " + MC[0].stem.charAt(0).toLowerCase() + MC[0].stem.slice(1);
    const e = mcEntry(0, 0); (e[0] as { runs: DocRun[] }).runs = [T(stem)];
    const p = run({ ...GOOD, mc: [e, mcEntry(1, 1), mcEntry(2, 1)] });
    check("đầu đề lời giải thêm 'Hãy' (cùng dãy số, Dice ≥ ngưỡng) → vẫn ghép", p.solutionStats?.matched === 7 && letters(byKey(p, "s1-1")) === "A", p.solutionStats);
    // Đầu đề lời giải thiếu phương án (chỉ stem) → không ghép
    const e2 = mcEntry(1, 1); e2.splice(1, 1);
    const p2 = run({ ...GOOD, mc: [mcEntry(0, 0), e2, mcEntry(2, 1)] });
    check("lời giải thiếu dòng phương án → không đối chiếu được → bỏ", byKey(p2, "s1-2").answerSource === "khong-co" && hasW(p2, "solution_unmatched", "s1-2"));
  }

  section("Không chạm đề kiểu cũ");
  {
    const bare = parseAzotaBlocks([...examBlocks(), P("LỜI GIẢI CHI TIẾT"), P("Chúc cô thi tốt.")]);
    check("'LỜI GIẢI CHI TIẾT' KHÔNG theo sau bởi mốc PHẦN → không vào chế độ lời giải (hành vi cũ), không solutionStats", bare.solutionStats === undefined && bare.warnings.some(w => w.code === "solution_section_unrecognized") && !bare.warnings.some(w => w.code === "solution_summary"));
    const lower = parseAzotaBlocks([...examBlocks(), P("Lời giải chi tiết"), P(HDR1), P(MC[0].stem)]);
    check("'Lời giải chi tiết' viết thường (lời giải từng câu của Azota) không bị coi là mục lời giải", lower.solutionStats === undefined);
    const plain = parseAzotaBlocks(examBlocks());
    check("đề không có mục lời giải: không solutionStats, không cờ answer_from_solution, mọi câu answer_missing như cũ", plain.solutionStats === undefined && plain.questions.filter(q => q.type !== "ESSAY").every(q => q.flags.includes("answer_missing") && !q.flags.includes("answer_from_solution")));
    const sec9 = parseAzotaBlocks([...examBlocks(), P("LỜI GIẢI CHI TIẾT"), P("PHẦN IX. Khác."), P("Lời giải"), P("abc")]);
    check("PHẦN trong lời giải không có trong đề → cảnh báo solution_section_unknown, không vỡ", hasW(sec9, "solution_section_unknown") && sec9.questions.length === 7);
  }

  section("Công thức/ảnh trong lời giải đi cùng bộ lọc token và trần độ dài");
  {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>';
    const tok = makeFormulaImgToken(svg);
    check("(chuẩn bị) dựng được token ảnh công thức hợp lệ", !!tok, tok);
    if (tok) {
      const many = Array.from({ length: 22 }, () => tok).join(" ");
      const p = run({ ...GOOD, mc: [mcEntry(0, 0, [many]), mcEntry(1, 1), mcEntry(2, 1)] });
      check("lời giải có 22 ảnh công thức (> trần 20/trường) → KHÔNG đưa phần chữ vào, vẫn lấy đáp án, có cảnh báo solution_too_big", byKey(p, "s1-1").explanation === "" && letters(byKey(p, "s1-1")) === "A" && hasW(p, "solution_too_big", "s1-1"), byKey(p, "s1-1").explanation.length);
      const few = Array.from({ length: 5 }, () => tok).join(" ");
      const q = run({ ...GOOD, mc: [mcEntry(0, 0, [few]), mcEntry(1, 1), mcEntry(2, 1)] });
      check("5 ảnh công thức trong lời giải: đưa vào nguyên vẹn + cờ formula_image", (byKey(q, "s1-1").explanation.match(/\{\{ctimg:/g) ?? []).length === 5 && byKey(q, "s1-1").flags.includes("formula_image"));
    }
    const long = run({ ...GOOD, mc: [mcEntry(0, 0, [("Dòng dài ".repeat(200) + "\n").repeat(8)]), mcEntry(1, 1), mcEntry(2, 1)] });
    check("lời giải dài > 3000 ký tự bị cắt về trần 3000", byKey(long, "s1-1").explanation.length <= 3000 && byKey(long, "s1-1").explanation.length > 2000, byKey(long, "s1-1").explanation.length);
  }

  section("Kiểm thử độc lập (P2/P3): ảnh khác nhau ⇒ đầu đề khác nhau; cổng duy nhất; trần; thời gian");
  {
    const svg = (c: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="10pt" height="10pt" viewBox="0 0 10 10"><text y="5" font-size="4"><tspan x="1">${c}</tspan></text></svg>`;
    const ta = makeFormulaImgToken(svg("a"))!, tb = makeFormulaImgToken(svg("b"))!;
    const pre = "Giá trị của biểu thức sau đây bằng bao nhiêu khi tính theo đúng yêu cầu của đề bài:";
    check("normHead: hai ảnh KHÁC nhau cho hai đầu đề khác nhau; cùng ảnh thì bằng nhau", normHead(`${pre} ${ta}`) !== normHead(`${pre} ${tb}`) && normHead(`${pre} ${ta}`) === normHead(`${pre} ${ta}`) && headScore(normHead(`${pre} ${ta}`), normHead(`${pre} ${tb}`)) === 0);
    const gen = (n: number): { ex: DocBlock[]; sol: DocBlock[] } => {
      const ex: DocBlock[] = [P(HDR1)], sol: DocBlock[] = [P("LỜI GIẢI CHI TIẾT"), P(HDR1)];
      for (let i = 0; i < n; i++) {
        const stem = `Cho dãy số thứ ${i} với công thức tổng quát $u_{n}=${i}n+${i * 7 + 3}$ và điều kiện kèm theo phía dưới đây, hãy tính số hạng thứ ${i + 5} của dãy số đó.`;
        const o = ["Một.", "Hai.", "Ba.", "Bốn."];
        ex.push(P(`Câu ${i + 1}.\t${stem}`), optsP(o, null));
        if (i % 20 !== 7) sol.push(P(stem), optsP(o, 1), P("Lời giải"), P("x")); // thiếu 5% lời giải → M ≠ N
      }
      return { ex, sol };
    };
    const g = gen(200);
    let t0 = Date.now();
    const r200 = parseAzotaBlocks([...g.ex, ...g.sol]);
    const ms200 = Date.now() - t0;
    check(`đề 200 câu, lời giải lệch số: ghép đúng ${r200.solutionStats?.matched}/200 trong ${ms200} ms (< 3000)`, ms200 < 3000 && r200.solutionStats?.matched === 190 && r200.questions.filter(q => letters(q) === "B").length === 190, r200.solutionStats);
    const gb = gen(4000);
    t0 = Date.now();
    const r4000 = parseAzotaBlocks([...gb.ex, ...gb.sol]);
    const ms4000 = Date.now() - t0;
    check(`4000 câu / ~3800 lời giải: bị chặn sớm (fatal), ${ms4000} ms (< 2000)`, r4000.fatal !== null && ms4000 < 2000, r4000.fatal);
    // Xấu nhất: 200 câu đầu đề gần giống hệt nhau (chỉ khác một nhóm chữ, không có chữ số) + 399 lời giải → mọi cặp phải tính Dice. Không được bình phương trong chi phí tính.
    {
      const code = (i: number) => String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26) % 26) + String.fromCharCode(97 + Math.floor(i / 676));
      const ex: DocBlock[] = [P(HDR1)], sol: DocBlock[] = [P("LỜI GIẢI CHI TIẾT"), P(HDR1)];
      for (let i = 0; i < 200; i++) {
        const stem = `Cho hàm số thuộc họ ${code(i)} có đồ thị như hình vẽ bên dưới đây, hãy xác định số điểm cực trị của hàm số đã cho trên toàn bộ tập xác định của nó theo yêu cầu.`;
        ex.push(P(`Câu ${i + 1}.\t${stem}`), P("A. Một.\tB. Hai.\tC. Ba.\tD. Bốn."));
        for (let k = 0; k < 2; k++) if (i < 199 || k === 0) sol.push(P(stem), P("A. Một.\tB. Hai.\tC. Ba.\tD. Bốn."), P("Lời giải"), P("x"));
      }
      const t1 = Date.now(), rw = parseAzotaBlocks([...ex, ...sol]), msw = Date.now() - t1;
      check(`xấu nhất 200 câu gần giống × 399 lời giải: ${msw} ms (< 1000), không đáp án nào bị đoán`, msw < 1000 && rw.questions.every(q => q.answerSource === "khong-co"), rw.solutionStats);
    }
    // M > 2×trần cho một phần có ít câu → bỏ cả phần, có cảnh báo, không treo
    const few = gen(3);
    const bigSol: DocBlock[] = [P("LỜI GIẢI CHI TIẾT"), P(HDR1)];
    for (let i = 0; i < AZOTA_MAX_SOLUTION_ENTRIES + 1; i++) bigSol.push(P(`Đề số ${i}`), P("Lời giải"), P("x"));
    t0 = Date.now();
    const rBig = parseAzotaBlocks([...few.ex, ...bigSol]);
    check(`${AZOTA_MAX_SOLUTION_ENTRIES + 1} lời giải cho 3 câu: bỏ cả phần + solution_section_too_big (${Date.now() - t0} ms)`, hasW(rBig, "solution_section_too_big") && rBig.questions.every(q => q.answerSource === "khong-co"), rBig.solutionStats);
  }

  await done();
})();
