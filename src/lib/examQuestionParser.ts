// Parser thuần TS dùng chung cả client lẫn server — không import gì server-only,
// để trang admin có thể parse ngay trên trình duyệt (review tức thì trước khi lưu DB).

export type QuestionType = "MC" | "ESSAY" | "TRUE_FALSE_CLUSTER";

export interface ParsedOption {
  text: string;
  isCorrect: boolean;
  subLabel?: "a" | "b" | "c" | "d"; // chỉ có ở TRUE_FALSE_CLUSTER
}

export interface ParsedQuestion {
  text: string;
  type: QuestionType;
  points?: number;
  options: ParsedOption[]; // rỗng với ESSAY
}

export interface ParseError {
  block: number;
  message: string;
}

// Validate options theo đúng ràng buộc của từng loại câu hỏi — dùng chung
// giữa API tạo/sửa câu hỏi từng cái (admin form) và bulk-create (từ review).
export function validateQuestionOptions(
  type: QuestionType,
  options: { text: string; isCorrect: boolean; subLabel?: string | null }[]
): string | null {
  if (type === "ESSAY") return null; // không cần đáp án
  if (type === "TRUE_FALSE_CLUSTER") {
    if (!Array.isArray(options) || options.length !== 4) {
      return "Câu Đúng-Sai cần đúng 4 ý";
    }
    const labels = options.map(o => o.subLabel).filter(Boolean).sort().join(",");
    if (labels !== "a,b,c,d") {
      return "4 ý phải đủ và đúng nhãn a) b) c) d), không trùng/thiếu nhãn nào";
    }
    return null;
  }
  // MC
  if (!Array.isArray(options) || options.length < 2) return "Cần ít nhất 2 đáp án";
  if (options.filter(o => o.isCorrect).length !== 1) return "Phải có đúng 1 đáp án đúng";
  return null;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: ParseError[];
}

// Định dạng nhập hàng loạt, mỗi câu hỏi là 1 khối, các khối cách nhau bởi 1+
// dòng trống. Loại câu hỏi suy ra tự động từ nội dung khối (không cần khai
// báo loại riêng):
//
// 1) Trắc nghiệm (MC) — có dòng bắt đầu bằng A./B./C./D., đáp án đúng đánh
//    dấu bằng dấu * ngay trước chữ cái, hoặc dòng "Đáp án: X" cũ:
//      Câu 1: Nội dung câu hỏi...
//      *A. Đáp án đúng
//      B. Đáp án sai
//
// 2) Đúng-Sai 4 ý (TRUE_FALSE_CLUSTER) — đúng 4 dòng a)[..] b)[..] c)[..] d)[..]
//    (chữ thường + ngoặc vuông, phân biệt với MC A./B./C./D.), dấu * trước ý
//    nào thì ý đó là ĐÚNG:
//      Câu 2: Đoạn dẫn chung cho 4 ý bên dưới...
//      *a)[0,NB] Ý a — đúng
//      b)[1,NB] Ý b — sai
//      c)[2,TH] Ý c — sai
//      *d)[3,VD] Ý d — đúng
//
// 3) Tự luận (ESSAY) — khối không có dòng đáp án nào cả:
//      Câu 3: Trình bày ngắn gọn...
//
// Lỗi ở khối nào chỉ bỏ qua khối đó, không làm hỏng cả batch (đề thật
// 35-150 câu, cần import dễ dãi với lỗi gõ).

const QUESTION_START = /^C[âa]u\s*\d+\s*[:.]?\s*/i;
const OPTION_LINE = /^(\*)?[A-D][.):]\s*(.+)$/i;
const ANSWER_LINE = /^Đ[áa]p\s*[áa]n\s*(?:đ[úu]ng)?\s*[:.]?\s*([A-D])/i;
// Bắt buộc có ngoặc vuông [..] để không đụng OPTION_LINE (a)/b)/... không ngoặc vẫn là MC)
const CLUSTER_LINE = /^(\*)?([a-d])\)\s*\[[^\]]*\]\s*(.+)$/;

export function parseBulkText(raw: string): ParseResult {
  const blocks = raw
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean);

  const questions: ParsedQuestion[] = [];
  const errors: ParseError[] = [];

  blocks.forEach((block, idx) => {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const hasClusterLine = lines.some(l => CLUSTER_LINE.test(l));
    const hasOptionLine = lines.some(l => OPTION_LINE.test(l));

    const result = hasClusterLine
      ? parseClusterBlock(lines)
      : hasOptionLine
      ? parseMCBlock(lines)
      : parseEssayBlock(lines);

    if ("error" in result) {
      errors.push({ block: idx + 1, message: result.error });
      return;
    }
    questions.push(result.question);
  });

  return { questions, errors };
}

function extractQuestionText(lines: string[], isOwnLine: (l: string) => boolean): string {
  let text = "";
  for (const line of lines) {
    if (isOwnLine(line)) continue;
    text = text ? text + " " + line : line.replace(QUESTION_START, "").trim();
  }
  return text;
}

function parseMCBlock(lines: string[]): { question: ParsedQuestion } | { error: string } {
  let questionText = "";
  const options: ParsedOption[] = [];
  let answerLetter: string | null = null;
  let markedIdx: number | null = null;
  let markedCount = 0;

  for (const line of lines) {
    const answerMatch = line.match(ANSWER_LINE);
    if (answerMatch) { answerLetter = answerMatch[1].toUpperCase(); continue; }
    const optionMatch = line.match(OPTION_LINE);
    if (optionMatch) {
      if (optionMatch[1]) { markedCount++; markedIdx = options.length; }
      options.push({ text: optionMatch[2].trim(), isCorrect: false });
      continue;
    }
    questionText = questionText ? questionText + " " + line : line.replace(QUESTION_START, "").trim();
  }

  if (!questionText) return { error: "Không tìm thấy nội dung câu hỏi" };
  if (options.length < 2) return { error: "Cần ít nhất 2 đáp án (dòng bắt đầu bằng A./B./C./D.)" };
  if (markedCount > 1) return { error: "Chỉ được đánh dấu * trước 1 đáp án đúng, không được nhiều hơn" };

  let answerIdx: number;
  if (markedCount === 1) {
    answerIdx = markedIdx!;
  } else {
    if (!answerLetter) {
      return { error: "Thiếu đáp án đúng — đánh dấu * trước đáp án (vd *A.) hoặc thêm dòng 'Đáp án: X'" };
    }
    answerIdx = answerLetter.charCodeAt(0) - "A".charCodeAt(0);
    if (answerIdx < 0 || answerIdx >= options.length) {
      return { error: `Đáp án "${answerLetter}" không khớp với danh sách lựa chọn` };
    }
  }
  options[answerIdx].isCorrect = true;

  return { question: { text: questionText, type: "MC", options } };
}

function parseClusterBlock(lines: string[]): { question: ParsedQuestion } | { error: string } {
  const options: ParsedOption[] = [];

  const questionText = extractQuestionText(lines, line => {
    const m = line.match(CLUSTER_LINE);
    if (!m) return false;
    const [, star, label, text] = m;
    options.push({ text: text.trim(), isCorrect: !!star, subLabel: label as ParsedOption["subLabel"] });
    return true;
  });

  if (!questionText) return { error: "Không tìm thấy nội dung câu hỏi (đoạn dẫn)" };
  if (options.length !== 4) {
    return { error: `Câu Đúng-Sai cần đúng 4 ý a)/b)/c)/d), hiện có ${options.length}` };
  }
  const labels = options.map(o => o.subLabel).sort().join(",");
  if (labels !== "a,b,c,d") {
    return { error: "4 ý phải đủ và đúng thứ tự nhãn a) b) c) d), không trùng/thiếu nhãn nào" };
  }

  return { question: { text: questionText, type: "TRUE_FALSE_CLUSTER", options } };
}

function parseEssayBlock(lines: string[]): { question: ParsedQuestion } | { error: string } {
  // Chỉ dòng đầu bỏ tiền tố "Câu N:", các dòng sau giữ nguyên
  const text = lines
    .map((l, i) => (i === 0 ? l.replace(QUESTION_START, "") : l))
    .join(" ")
    .trim();

  if (!text) return { error: "Không tìm thấy nội dung câu hỏi" };
  return { question: { text, type: "ESSAY", options: [] } };
}

// Dùng cho file Excel/CSV — chỉ hỗ trợ trắc nghiệm (MC), dòng đầu là header
// (bỏ qua), các dòng sau theo thứ tự cột cố định:
// Câu hỏi | Đáp án A | Đáp án B | Đáp án C | Đáp án D | Đáp án đúng | Điểm (tùy chọn)
export function parseSpreadsheetRows(rows: unknown[][]): ParseResult {
  const questions: ParsedQuestion[] = [];
  const errors: ParseError[] = [];

  const dataRows = rows.slice(1); // bỏ header

  dataRows.forEach((row, idx) => {
    const cells = row.map(c => (c === null || c === undefined ? "" : String(c).trim()));
    if (cells.every(c => !c)) return; // dòng trống bỏ qua, không tính lỗi

    const [text, a, b, c, d, answerRaw, pointsRaw] = cells;
    const block = idx + 1;

    if (!text) {
      errors.push({ block, message: "Thiếu nội dung câu hỏi (cột 1)" });
      return;
    }
    const options: ParsedOption[] = [a, b, c, d]
      .map(t => ({ text: t, isCorrect: false }))
      .filter(o => o.text);
    if (options.length < 2) {
      errors.push({ block, message: "Cần ít nhất 2 đáp án (cột 2-5)" });
      return;
    }
    const answerLetter = (answerRaw || "").trim().toUpperCase();
    const answerIdx = answerLetter.charCodeAt(0) - "A".charCodeAt(0);
    if (!answerLetter || answerIdx < 0 || answerIdx >= options.length) {
      errors.push({ block, message: `Đáp án đúng "${answerRaw || ""}" không hợp lệ (cột 6, phải là A/B/C/D)` });
      return;
    }
    options[answerIdx].isCorrect = true;

    const points = Number(pointsRaw);
    questions.push({ text, type: "MC", options, points: Number.isFinite(points) && points > 0 ? points : 1 });
  });

  return { questions, errors };
}
