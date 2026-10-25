// QZ — nhập câu hỏi từ bảng Excel/CSV theo mẫu (src/lib/quizSheetImport.ts) và dựng chính bảng mẫu (src/lib/quizSheetTemplate.ts). Không DB, không máy chủ.
// CA PHÁ CỐ Ý: nhập nhầm tệp khác, hàng ví dụ quên xoá, đáp án trỏ vào ô trống, điểm rác, nhiều đáp án đúng, tất cả đáp án đều đúng, ô công thức/rich text của exceljs,
// quá số hàng; và vòng tròn: mẫu do KiN dựng ra phải đọc lại được bằng chính bộ đọc (nếu lệch cột thì bài đỏ).
import { parseQuizSheet, cellText, EXAMPLE_MARK, SHEET_HEADERS, SHEET_MAX_ROWS } from "@/lib/quizSheetImport";
import { quizSheetTemplate, TEMPLATE_EXAMPLES, TEMPLATE_GUIDE } from "@/lib/quizSheetTemplate";
import { check, section, done } from "./h";

const H = [...SHEET_HEADERS] as string[];
const ok = (rows: unknown[][]) => parseQuizSheet([H, ...rows]);

(async () => {
section("cellText — mọi kiểu ô của exceljs, không ném lỗi");
check("chuỗi cắt khoảng trắng; số; boolean; rỗng", cellText("  Hà Nội ") === "Hà Nội" && cellText(2) === "2" && cellText(true) === "TRUE" && cellText(null) === "" && cellText(undefined) === "");
check("ô công thức → lấy giá trị đã tính, KHÔNG lấy chuỗi công thức", cellText({ formula: "=HYPERLINK(\"http://x\")", result: "kết quả" }) === "kết quả" && !cellText({ formula: "=A1+1", result: 5 }).includes("="));
check("rich text → ghép các đoạn", cellText({ richText: [{ text: "Xin " }, { text: "chào" }] }) === "Xin chào");
check("liên kết {text, hyperlink} → chữ hiển thị", cellText({ text: "KiN", hyperlink: "http://x" }) === "KiN");
check("ô lỗi / NaN / Date rác / đối tượng lạ → rỗng, không ném", cellText({ error: "#REF!" }) === "" && cellText(NaN) === "" && cellText(new Date("x")) === "" && cellText({ a: 1 }) === "" && cellText(Symbol("s") as unknown) === "");

section("Tiêu đề: nhập nhầm tệp khác thì từ chối cả tệp");
check("tệp trống / không phải mảng", parseQuizSheet([]).fatal !== null && parseQuizSheet(null as unknown as unknown[][]).fatal !== null);
check("dòng đầu là tệp khác (danh sách học sinh) → fatal, không câu nào", (() => { const r = parseQuizSheet([["Họ tên", "SĐT"], ["A", "1"]]); return r.fatal !== null && r.questions.length === 0 && /bảng mẫu/.test(r.fatal!); })());
check("tiêu đề không dấu / khác hoa thường vẫn nhận", parseQuizSheet([["CAU HOI", "a", "b", "c", "d", "dap an dung"], ["Q?", "x", "y", "", "", "A"]]).questions.length === 1);

section("Một đáp án / nhiều đáp án");
const one = ok([["1+1=?", "2", "3", "4", "5", "A", "2", "Vì 1+1=2", "Đếm ngón tay"]]);
check("câu MC: 4 đáp án, A đúng, 2 điểm, giải thích + gợi ý", one.questions.length === 1 && one.questions[0].type === "MC" && one.questions[0].points === 2
  && one.questions[0].options.map(o => o.isCorrect).join() === "true,false,false,false" && one.questions[0].explanation === "Vì 1+1=2" && one.questions[0].hint === "Đếm ngón tay", one);
const multi = ok([["Chọn số chẵn", "2", "3", "4", "5", "A,C", "3"], ["Lowercase", "x", "y", "z", "", "a; b", ""]]);
check("A,C → MC_MULTI với đúng 2 ô đúng", multi.questions[0].type === "MC_MULTI" && multi.questions[0].options.filter(o => o.isCorrect).length === 2 && multi.questions[0].options[0].isCorrect && multi.questions[0].options[2].isCorrect);
check("'a; b' viết thường, ngăn bằng ; → MC_MULTI, điểm trống = 1", multi.questions[1].type === "MC_MULTI" && multi.questions[1].points === 1);
check("PHÁ: lặp chữ (A,A) chỉ là MỘT đáp án → MC, không thành nhiều đáp án", ok([["q", "x", "y", "", "", "A,A"]]).questions[0].type === "MC");
check("PHÁ: đánh dấu đúng cả mọi lựa chọn (A,B,C,D) → lỗi hàng, không câu nào", (() => { const r = ok([["q", "x", "y", "z", "w", "A,B,C,D"]]); return r.questions.length === 0 && r.errors.length === 1 && /mọi lựa chọn/.test(r.errors[0].message); })());
check("đáp án trỏ vào ô để trống (D trống mà đáp án D) → lỗi hàng nói rõ", (() => { const r = ok([["q", "x", "y", "z", "", "D"]]); return r.questions.length === 0 && /D/.test(r.errors[0].message) && /trống/.test(r.errors[0].message); })());
check("khoảng trống giữa đáp án (B trống, C có): C vẫn trỏ đúng ô C, không lệch sang B", (() => { const r = ok([["q", "xa", "", "xc", "xd", "C"]]); const q = r.questions[0]; return q.options.length === 3 && q.options.find(o => o.isCorrect)?.text === "xc"; })());

check("thứ tự đáp án đúng A,B,C,D như trong ô (không đảo cột)", one.questions[0].options.map(o => o.text).join() === "2,3,4,5");

section("Lỗi từng hàng — nêu số hàng THẬT trong tệp, không bỏ âm thầm");
const bad = ok([
  ["", "a", "b", "", "", "A"],                       // hàng 2: thiếu câu hỏi
  ["Chỉ một đáp án", "a", "", "", "", "A"],           // hàng 3: < 2 đáp án
  ["Thiếu đáp án đúng", "a", "b", "", "", ""],        // hàng 4
  ["Đáp án E", "a", "b", "", "", "E"],                // hàng 5
  ["Điểm rác", "a", "b", "", "", "A", "mười"],        // hàng 6
  ["Điểm âm", "a", "b", "", "", "A", "-1"],           // hàng 7
  ["Điểm 0", "a", "b", "", "", "A", "0"],             // hàng 8
  ["Hợp lệ", "a", "b", "", "", "B", "1,5"],           // hàng 9: điểm dấu phẩy
]);
check("chỉ hàng 9 hợp lệ; 7 hàng lỗi", bad.questions.length === 1 && bad.errors.length === 7, bad.errors);
check("số hàng lỗi là 2..8 (hàng 1 là tiêu đề)", bad.errors.map(e => e.row).join() === "2,3,4,5,6,7,8", bad.errors.map(e => e.row));
check("điểm '1,5' (dấu phẩy VN) = 1.5", bad.questions[0].points === 1.5);
check("điểm quá lớn (1001) → lỗi", ok([["q", "a", "b", "", "", "A", "1001"]]).errors.length === 1);
check("hàng trống hoàn toàn bỏ qua, không tính lỗi", ok([["", "", "", "", "", ""], [], ["q", "a", "b", "", "", "A"]]).errors.length === 0);

section("Hàng ví dụ của bảng mẫu");
const ex = ok([[`${EXAMPLE_MARK} Thủ đô?`, "Hà Nội", "Huế", "", "", "A"], ["Câu thật", "a", "b", "", "", "A"]]);
check("hàng ví dụ bị bỏ qua VÀ báo rõ (không im lặng), câu thật vẫn nhận", ex.questions.length === 1 && ex.questions[0].text === "Câu thật" && ex.errors.length === 1 && /ví dụ/i.test(ex.errors[0].message) && ex.errors[0].row === 2);

section("Giới hạn số hàng");
const many = Array.from({ length: SHEET_MAX_ROWS + 1 }, (_, i) => [`Câu ${i}`, "a", "b", "", "", "A"]);
check(`quá ${SHEET_MAX_ROWS} hàng → từ chối CẢ lần nhập (không cắt lặng lẽ)`, (() => { const r = ok(many); return r.fatal !== null && r.questions.length === 0; })());
check(`đúng ${SHEET_MAX_ROWS} hàng vẫn nhận hết`, ok(many.slice(0, SHEET_MAX_ROWS)).questions.length === SHEET_MAX_ROWS);

section("Chữ nguy hiểm trong ô chỉ là chữ");
const evil = ok([["=HYPERLINK(\"http://x\",\"bấm\")", "<script>alert(1)</script>", "@SUM(A1)", "", "", "A"]]);
check("không chạy, không lọc: giữ nguyên làm chữ (hiện ra qua MathText đã escape)", evil.questions.length === 1 && evil.questions[0].text.startsWith("=HYPERLINK") && evil.questions[0].options[0].text.includes("<script>"));

section("Vòng tròn: bảng mẫu KiN dựng ra đọc lại được bằng chính bộ đọc");
const bytes = await quizSheetTemplate();
check("là tệp .xlsx thật (zip 'PK')", bytes[0] === 0x50 && bytes[1] === 0x4b && bytes.length > 2000, bytes.length);
const exmod = await import("exceljs");
const { Workbook } = (exmod as unknown as { default?: typeof exmod }).default ?? exmod;
const wb = new Workbook();
await wb.xlsx.load(bytes as unknown as ArrayBuffer);
check("có 2 trang: 'Câu hỏi' và 'Hướng dẫn'", wb.worksheets.map(w => w.name).join() === "Câu hỏi,Hướng dẫn", wb.worksheets.map(w => w.name));
const rows: unknown[][] = [];
wb.worksheets[0].eachRow({ includeEmpty: true }, row => { rows.push((row.values as unknown[]).slice(1)); });
check("tiêu đề trong tệp mẫu khớp SHEET_HEADERS", H.every((h, i) => cellText(rows[0][i]) === h), rows[0]);
const fromTemplate = parseQuizSheet(rows);
check("mẫu nguyên bản: không lỗi nặng, 0 câu, đúng 2 hàng ví dụ bị bỏ qua có báo", fromTemplate.fatal === null && fromTemplate.questions.length === 0 && fromTemplate.errors.length === TEMPLATE_EXAMPLES.length, fromTemplate);
// Gia sư xoá chữ đánh dấu ví dụ và giữ nội dung → hai câu hợp lệ (MC và MC_MULTI): chứng minh ví dụ trong mẫu đúng luật.
const stripped = rows.map((r, i) => (i === 0 ? r : r.map(c => (typeof c === "string" ? c.replace(EXAMPLE_MARK, "").trim() : c))));
const asReal = parseQuizSheet(stripped);
check("bỏ chữ đánh dấu → 2 câu hợp lệ: một MC, một MC_MULTI", asReal.questions.length === 2 && asReal.questions[0].type === "MC" && asReal.questions[1].type === "MC_MULTI", asReal);
check("trang hướng dẫn có đủ các dòng và nhắc xoá hàng ví dụ", wb.worksheets[1].rowCount === TEMPLATE_GUIDE.length && TEMPLATE_GUIDE.join(" ").includes("xoá hai hàng ví dụ"));
check("hướng dẫn nói thật giới hạn: chỉ trắc nghiệm, không gửi đi đâu, không tốn lượt AI", /chỉ nhận câu trắc nghiệm/.test(TEMPLATE_GUIDE.join(" ")) && /không gửi tệp đi đâu/.test(TEMPLATE_GUIDE.join(" ")) && /không tốn lượt AI/.test(TEMPLATE_GUIDE.join(" ")));
check("PHÁ: ghi giá trị công thức vào ô mẫu không làm hỏng — mọi ô mẫu là chuỗi, không có công thức", wb.worksheets[0].getSheetValues().flat().every(v => !(v && typeof v === "object" && "formula" in (v as object))));

await done();
})();
