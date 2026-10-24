// QZ-08 — xuất nhật ký chấm/sửa điểm ra CSV, phần thuần (src/lib/quizHistoryCsv.ts + csvCell của revenue.ts). Không DB.
// CA PHÁ CỐ Ý: CSV injection (= + - @ tab), dấu phẩy/nháy/xuống dòng trong nhận xét, BOM, giờ VN, sắp mới→cũ, điểm âm vẫn là SỐ (không bị thêm nháy).
import { historyCsv, historyRows, vnStamp, historyCsvFilename, HISTORY_CSV_HEADERS, KIND_EDIT, KIND_GRADE, KIND_PUBLISH, type HistoryData } from "@/lib/quizHistoryCsv";
import { check, section, done } from "./h";

const parse = (csv: string): string[][] => {
  // bộ đọc CSV tối giản theo RFC 4180 (đủ cho test): tách hàng bằng \r\n ngoài dấu nháy, ô trong "..." có "" là một nháy.
  const rows: string[][] = []; let cur: string[] = [], cell = "", q = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (q) { if (ch === '"') { if (csv[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { cur.push(cell); cell = ""; }
    else if (ch === "\r" && csv[i + 1] === "\n") { cur.push(cell); rows.push(cur); cur = []; cell = ""; i++; }
    else cell += ch;
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur); }
  return rows;
};

const data: HistoryData = {
  publishes: [{ attemptId: "a1", studentName: "Em Một", at: "2026-10-25T13:00:05.000Z", byName: "Cô Lan" }],
  edits: [
    { id: "e1", attemptId: "a1", studentName: "=HYPERLINK(\"http://x\",\"bấm\")", questionOrder: 3, prevPoints: null, newPoints: 1.5, prevComment: null, newComment: "Hay, nhưng thiếu \"bước 2\"\nlàm lại", at: "2026-10-25T12:00:00.000Z", byName: "+Cô Lan" },
    { id: "e2", attemptId: "a1", studentName: "Em Một", questionOrder: 3, prevPoints: 1.5, newPoints: 2, prevComment: "-cũ", newComment: "@mới", at: "2026-10-25T12:30:00.000Z", byName: "Cô Lan" },
  ],
};

section("Định dạng tệp");
const csv = historyCsv(data);
check("bắt đầu bằng BOM UTF-8 (Excel đọc đúng tiếng Việt)", csv.charCodeAt(0) === 0xfeff);
const rows = parse(csv.slice(1));
check("dòng đầu đúng tiêu đề, 4 hàng (tiêu đề + 3 sự kiện), 9 cột mỗi hàng", rows.length === 4 && rows[0].join("|") === HISTORY_CSV_HEADERS.join("|") && rows.every(r => r.length === 9), rows.map(r => r.length));
check("ngắt hàng CRLF và có xuống dòng cuối", csv.endsWith("\r\n") && csv.includes("\r\n"));
check("sắp mới → cũ: công bố (13:00) trước, rồi sửa 12:30, rồi chấm 12:00", rows[1][1] === KIND_PUBLISH && rows[2][1] === KIND_EDIT && rows[3][1] === KIND_GRADE, rows.map(r => r[1]));
check("giờ theo giờ VN: 13:00:05Z = 20:00:05", rows[1][0] === "2026-10-25 20:00:05", rows[1][0]);
check("PHÁ múi giờ: không in giờ UTC", !csv.includes("2026-10-25 13:00:05"));

section("Chống CSV injection (= + - @)");
check("tên học sinh '=HYPERLINK(...)' bị chèn nháy đơn đầu ô → thành chữ, không thành công thức", rows[3][2] === "'=HYPERLINK(\"http://x\",\"bấm\")", rows[3][2]);
check("người thực hiện '+Cô Lan' → '+...", rows[3][8] === "'+Cô Lan");
check("nhận xét cũ '-cũ' và mới '@mới' đều bị chèn nháy", rows[2][6] === "'-cũ" && rows[2][7] === "'@mới", rows[2]);
check("PHÁ: không còn ô chữ nào bắt đầu bằng = + - @ trần", rows.slice(1).every(r => r.every(c => !/^[=+\-@\t\r]/.test(c))), rows);
check("ô tab đầu cũng bị chặn", historyCsv({ publishes: [{ attemptId: "a", studentName: "\tcmd", at: "2026-10-25T00:00:00Z", byName: "x" }], edits: [] }).includes("'\tcmd"));

section("Dấu phẩy, nháy kép, xuống dòng trong nhận xét");
check("nhận xét nhiều dòng + nháy kép đọc lại y nguyên (RFC 4180)", rows[3][7] === "Hay, nhưng thiếu \"bước 2\"\nlàm lại", rows[3][7]);

section("Số vẫn là số");
check("điểm âm/thập phân KHÔNG bị thêm nháy (Excel còn tính được)", rows[2][4] === "1.5" && rows[2][5] === "2" && !rows[2][4].startsWith("'"));
check("điểm cũ trống khi chấm lần đầu", rows[3][4] === "" && rows[3][5] === "1.5");
check("điểm 0 vẫn in '0' (không biến thành ô trống)", historyRows({ publishes: [], edits: [{ ...data.edits[1], prevPoints: 0, newPoints: 0 }] })[0][4] === 0);

section("Rỗng và rác");
const empty = parse(historyCsv({ publishes: [], edits: [] }).slice(1));
check("không có sự kiện → vẫn có dòng tiêu đề", empty.length === 1 && empty[0].length === 9);
check("thời điểm rác → ô trống, không ném lỗi", vnStamp("không phải ngày") === "" && historyRows({ publishes: [{ attemptId: "a", studentName: "x", at: "rác", byName: "" }], edits: [] })[0][0] === "");
check("câu hỏi không biết số thứ tự → ô trống", historyRows({ publishes: [], edits: [{ ...data.edits[0], questionOrder: null }] })[0][3] === "");
check("tên tệp ASCII theo ngày VN", historyCsvFilename("2026-10-25T20:00:00Z") === "nhat-ky-cham-quiz-2026-10-26.csv", historyCsvFilename("2026-10-25T20:00:00Z"));


done();
