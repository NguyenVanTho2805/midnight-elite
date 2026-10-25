// QZ — thanh công thức cho ô tự luận của học sinh. Chỉ CHÈN CHỮ THUẦN vào ô nhập (x^2, sqrt(), (a)/(b)): không HTML, không thẻ, không
// chạy gì cả — chữ chèn vào đi qua đường lưu nháp / nộp sẵn có như mọi chữ em gõ, nên không mở thêm cổng XSS nào. Thuần để test.
// Không có nút "in đậm": bài tự luận được hiện lại (cho gia sư chấm, ở màn xem lại, ở chữa bài) dưới dạng chữ thuần, KHÔNG render markdown,
// nên chèn dấu ** chỉ để lại hai cặp dấu sao thô trong bài của em. Muốn có in đậm phải làm cả phía hiển thị trước; chưa có thì không để nút hứa suông.
export type FormulaKind = "square" | "sqrt" | "fraction";

export interface Edit { value: string; selStart: number; selEnd: number }

export const FORMULA_BUTTONS: { kind: FormulaKind; label: string; aria: string }[] = [
  { kind: "square", label: "x²", aria: "Chèn bình phương (x^2)" },
  { kind: "sqrt", label: "√x", aria: "Chèn căn bậc hai (sqrt())" },
  { kind: "fraction", label: "a/b", aria: "Chèn phân số ((a)/(b))" },
];

/** Giới hạn độ dài ô tự luận không đổi: chèn quá giới hạn thì giữ nguyên chữ cũ. */
export const ESSAY_MAX_CHARS = 20000;

/**
 * Chèn ký hiệu tại vùng chọn [start, end) của `value`. Có chữ đang chọn thì bọc chữ đó; không có thì chèn mẫu và đặt con trỏ ở chỗ cần gõ tiếp.
 * Tham số ngoài khoảng được kẹp lại; `start > end` được đổi chỗ.
 */
export function applyFormula(value: string, start: number, end: number, kind: FormulaKind, max = ESSAY_MAX_CHARS): Edit {
  const n = value.length;
  let a = Math.min(n, Math.max(0, Math.floor(Number.isFinite(start) ? start : n)));
  let b = Math.min(n, Math.max(0, Math.floor(Number.isFinite(end) ? end : n)));
  if (a > b) [a, b] = [b, a];
  const sel = value.slice(a, b);
  let ins: string, caretFromStart: number;
  switch (kind) {
    case "square": ins = sel ? `${sel}^2` : "x^2"; caretFromStart = ins.length; break;
    case "sqrt": ins = `sqrt(${sel})`; caretFromStart = sel ? ins.length : 5; break;
    case "fraction": ins = sel ? `(${sel})/()` : "(a)/(b)"; caretFromStart = sel ? ins.length - 1 : ins.length; break;
    default: return { value, selStart: a, selEnd: b }; // loại lạ (vd "bold" của bản cũ): không đổi chữ, không chèn chữ "undefined"
  }
  const next = value.slice(0, a) + ins + value.slice(b);
  if (next.length > max) return { value, selStart: a, selEnd: b };
  const caret = a + caretFromStart;
  return { value: next, selStart: caret, selEnd: caret };
}
