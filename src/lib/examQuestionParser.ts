// Parser thuần TS dùng chung cả client lẫn server — không import gì server-only,
// để trang admin có thể parse ngay trên trình duyệt (review tức thì trước khi lưu DB).

export interface ParsedOption {
  text: string;
  isCorrect: boolean;
}

export interface ParsedQuestion {
  text: string;
  points?: number;
  options: ParsedOption[];
}

export interface ParseError {
  block: number;
  message: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: ParseError[];
}

// Định dạng nhập hàng loạt, mỗi câu hỏi là 1 khối:
//   Câu 1: Nội dung câu hỏi...
//   A. Đáp án A
//   B. Đáp án B
//   C. Đáp án C
//   D. Đáp án D
//   Đáp án: B
// Các khối cách nhau bởi 1+ dòng trống. Lỗi ở khối nào chỉ bỏ qua khối đó,
// không làm hỏng cả batch (đề thật 35-150 câu, cần import dễ dãi với lỗi gõ).

const QUESTION_START = /^C[âa]u\s*\d+\s*[:.]?\s*/i;
const OPTION_LINE = /^([A-D])[.):]\s*(.+)$/i;
const ANSWER_LINE = /^Đ[áa]p\s*[áa]n\s*(?:đ[úu]ng)?\s*[:.]?\s*([A-D])/i;

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

    let questionText = "";
    const options: ParsedOption[] = [];
    let answerLetter: string | null = null;

    for (const line of lines) {
      const answerMatch = line.match(ANSWER_LINE);
      if (answerMatch) {
        answerLetter = answerMatch[1].toUpperCase();
        continue;
      }
      const optionMatch = line.match(OPTION_LINE);
      if (optionMatch) {
        options.push({ text: optionMatch[2].trim(), isCorrect: false });
        continue;
      }
      if (!questionText) {
        questionText = line.replace(QUESTION_START, "").trim();
      } else {
        questionText += " " + line;
      }
    }

    if (!questionText) {
      errors.push({ block: idx + 1, message: "Không tìm thấy nội dung câu hỏi" });
      return;
    }
    if (options.length < 2) {
      errors.push({ block: idx + 1, message: "Cần ít nhất 2 đáp án (dòng bắt đầu bằng A./B./C./D.)" });
      return;
    }
    if (!answerLetter) {
      errors.push({ block: idx + 1, message: "Thiếu dòng 'Đáp án: X'" });
      return;
    }
    const answerIdx = answerLetter.charCodeAt(0) - "A".charCodeAt(0);
    if (answerIdx < 0 || answerIdx >= options.length) {
      errors.push({ block: idx + 1, message: `Đáp án "${answerLetter}" không khớp với danh sách lựa chọn` });
      return;
    }
    options[answerIdx].isCorrect = true;

    questions.push({ text: questionText, options });
  });

  return { questions, errors };
}

// Dùng cho file Excel/CSV — dòng đầu là header (bỏ qua), các dòng sau theo thứ tự cột cố định:
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
    questions.push({ text, options, points: Number.isFinite(points) && points > 0 ? points : 1 });
  });

  return { questions, errors };
}
