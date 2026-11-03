// BU-03 P3 — tệp Excel kết quả (src/lib/deThiResultsXlsx.ts). Dựng thật bằng exceljs rồi ĐỌC LẠI từng ô. Không DB.
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-results-xlsx-lib.ts
// Ca phá cố ý (sửa mã → ca tương ứng đỏ):
//   - bỏ `'` đệm trong safeCell → ca "=SUM(", "=HYPERLINK", "+", "-", "@" đỏ;
//   - ghi ô công thức ({ formula }) ở bất kỳ sheet → ca "không ô công thức" đỏ;
//   - đổi tên sheet → ca ba sheet đỏ; để tiếng Việt có dấu trong tên tệp → ca ASCII đỏ.
import { check, section, done } from "./h";
import { overviewMatrix, questionMatrix, resultsXlsx, resultsXlsxFilename, safeCell, scoreMatrix, vnDateTimeText, type XlsxData } from "@/lib/deThiResultsXlsx";
import { buildKetQua, type ScoreRow } from "@/lib/deThiResults";

const evil = ["=SUM(A1:A9)", "=HYPERLINK(\"http://x\",\"y\")", "+1+1", "-2+3", "@cmd", "\t=1", "\r=1"];
const rows: ScoreRow[] = [
  ...evil.map((n, i): ScoreRow => ({ attemptId: `a${i}`, studentName: n, score: 7.5, submittedAt: "2026-11-01T02:30:00.000Z", durationSec: 125, variantNo: 2, tabSwitchCount: 3 })),
  { attemptId: "z", studentName: "Nguyễn Thị Hương", score: null, submittedAt: "2026-11-01T17:05:00.000Z", durationSec: null, variantNo: 1, tabSwitchCount: 0 },
];
const ketQua = buildKetQua({ exams: [{ id: "R", variantNo: 1, totalPoints: 10 }], questions: [], attempts: [], answers: [], booleans: [] });
const data: XlsxData = { title: "=Đề giữa kỳ", chon: "cao-nhat", ketQua: { ...ketQua, basic: { ...ketQua.basic, attempts: 8, students: 8, avg: 6.88, passRate: 0.8333 }, questions: [{ order: 1, variantKey: "=abcd", correctRate: 0.4286, answered: 6, avgSec: null, flagged: true }] }, rows };

(async () => {
section("safeCell");
check("chuỗi bắt đầu = + - @ \\t \\r được đệm dấu nháy đơn", evil.every(s => safeCell(s) === `'${s}`));
check("chuỗi thường, tiếng Việt, số trong chuỗi giữ nguyên", safeCell("Nguyễn Thị Hương") === "Nguyễn Thị Hương" && safeCell("a=b") === "a=b" && safeCell("7,5") === "7,5");
check("số hữu hạn giữ là SỐ (âm cũng không đệm); NaN/Infinity/null/undefined → rỗng", safeCell(-3) === -3 && safeCell(0) === 0 && safeCell(NaN) === "" && safeCell(Infinity) === "" && safeCell(null) === "" && safeCell(undefined) === "");
check("boolean → Có/Không (không bao giờ là kiểu boolean trong ô)", safeCell(true) === "Có" && safeCell(false) === "Không");
check("PHÁ: đệm đúng một lần (đã có ' đầu thì vẫn an toàn vì ' không nằm trong tập nguy hiểm)", safeCell("'=1") === "'=1");

section("Tên tệp và giờ");
check("ket-qua-<id8>-<yyyymmdd>.xlsx, bỏ tiền tố quiz-, chỉ chữ-số", resultsXlsxFilename("quiz-0a1b2c3d-4e5f-6789", new Date("2026-11-02T03:00:00Z")) === "ket-qua-0a1b2c3d-20261102.xlsx");
check("ngày theo giờ VN: 18:00 UTC ngày 1/11 đã là 2/11 ở VN", resultsXlsxFilename("quiz-abcdefghij", new Date("2026-11-01T18:00:00Z")) === "ket-qua-abcdefgh-20261102.xlsx");
check("PHÁ: mã đề có dấu / ký tự lạ vẫn ra tên ASCII an toàn (không '/', '\"', dấu cách)", (() => { const f = resultsXlsxFilename("đề/../\"x y\"é", new Date("2026-11-02T03:00:00Z")); return /^ket-qua-[A-Za-z0-9]+-\d{8}\.xlsx$/.test(f); })());
check("mã đề rỗng → vẫn có tên hợp lệ", /^ket-qua-de-\d{8}\.xlsx$/.test(resultsXlsxFilename("", new Date("2026-11-02T03:00:00Z"))));
check("vnDateTimeText: 02:30Z → 09:30 VN; 17:05Z ngày 1 → 00:05 ngày 2; rác → rỗng", vnDateTimeText("2026-11-01T02:30:00.000Z") === "01/11/2026 09:30" && vnDateTimeText("2026-11-01T17:05:00.000Z") === "02/11/2026 00:05" && vnDateTimeText("không phải ngày") === "");

section("Ma trận (thuần)");
const sm = scoreMatrix(data);
check("bảng điểm: dòng tiêu đề + 1 dòng/học sinh; tên độc hại đã đệm; 'Chờ chấm' cho điểm null", sm.length === 2 + rows.length && sm[2][1] === "'=SUM(A1:A9)" && sm[sm.length - 1][2] === "Chờ chấm" && sm[2][2] === 7.5 && sm[2][5] === 102);
check("mọi ô của cả ba ma trận là chuỗi hoặc số", [...overviewMatrix(data), ...sm, ...questionMatrix(data)].every(r => r.every(c => typeof c === "string" || typeof c === "number")));
check("mọi chuỗi trong cả ba ma trận không bắt đầu bằng ký tự nguy hiểm", [...overviewMatrix(data), ...sm, ...questionMatrix(data)].every(r => r.every(c => typeof c !== "string" || !/^[=+\-@\t\r]/.test(c))));
check("tên đề độc hại ở Tổng quan được đệm", overviewMatrix(data)[0][1] === "'=Đề giữa kỳ");
check("tỉ lệ đạt/tỉ lệ đúng đổi sang phần trăm 1 chữ số (0,8333 → 83,3; 0,4286 → 42,9)", overviewMatrix(data).some(r => r[0] === "Tỉ lệ đạt (từ 5/10, %)" && r[1] === 83.3) && questionMatrix(data)[1][2] === 42.9);

section("Tệp .xlsx thật (đọc lại bằng exceljs)");
const bytes = await resultsXlsx(data);
const mod = await import("exceljs");
const { Workbook, ValueType } = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof import("exceljs");
const wb = new Workbook();
await wb.xlsx.load(bytes as unknown as ArrayBuffer);
check("PK.. (zip) và đúng ba sheet theo thứ tự: Tổng quan, Bảng điểm, Theo câu", bytes[0] === 0x50 && bytes[1] === 0x4b && wb.worksheets.map(w => w.name).join("|") === "Tổng quan|Bảng điểm|Theo câu", wb.worksheets.map(w => w.name));
let cells = 0, formulas = 0, badStart = 0;
for (const ws of wb.worksheets) ws.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, c => {
  cells++;
  if (c.type === ValueType.Formula || (typeof c.value === "object" && c.value !== null && ("formula" in c.value || "sharedFormula" in c.value))) formulas++;
  if (typeof c.value === "string" && /^[=+\-@\t\r]/.test(c.value)) badStart++;
}));
check(`PHÁ: không ô công thức nào trong ${cells} ô, và không chuỗi nào bắt đầu bằng = + - @`, cells > 40 && formulas === 0 && badStart === 0, { cells, formulas, badStart });
const sh = wb.getWorksheet("Bảng điểm")!;
check("ô '=SUM(A1:A9)' đọc lại là CHUỖI '\\'=SUM(A1:A9)'", sh.getCell("B3").value === "'=SUM(A1:A9)" && sh.getCell("B3").type === ValueType.String, sh.getCell("B3").value);
check("ô điểm là SỐ 7,5; hàng cuối 'Chờ chấm'; STT là số", sh.getCell("C3").value === 7.5 && sh.getCell("C3").type === ValueType.Number && sh.getRow(sh.rowCount).getCell(3).value === "Chờ chấm" && sh.getCell("A3").value === 1);
check("giờ nộp theo giờ VN trong ô", sh.getCell("D3").value === "01/11/2026 09:30" && sh.getRow(sh.rowCount).getCell(4).value === "02/11/2026 00:05");
check("Theo câu: câu 1 khoá đệm, tỉ lệ 42,9, 'Có' cho câu cần xem lại", (() => { const q = wb.getWorksheet("Theo câu")!; return q.getCell("B2").value === "'=abcd" && q.getCell("C2").value === 42.9 && q.getCell("E2").value === "Có"; })());
check("chưa có lượt nộp: vẫn tạo được tệp (bảng điểm chỉ còn tiêu đề)", await (async () => {
  const b = await resultsXlsx({ title: "Đề trống", chon: "dau", ketQua, rows: [] });
  const w = new Workbook(); await w.xlsx.load(b as unknown as ArrayBuffer);
  return w.getWorksheet("Bảng điểm")!.rowCount === 2 && w.getWorksheet("Tổng quan")!.rowCount > 10;
})());

await done();
})();
