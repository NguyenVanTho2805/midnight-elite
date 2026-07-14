"use client";

import { useMemo } from "react";
import katex from "katex";

// Quy ước: $...$ = công thức inline, $$...$$ = công thức khối riêng dòng.
// Phần còn lại render như text thường (đã escape HTML — text đến từ giáo
// viên, không được tin tưởng tuyệt đối khi hiển thị qua dangerouslySetInnerHTML).
const MATH_PATTERN = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

export function renderMathText(text: string): string {
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MATH_PATTERN.lastIndex = 0;
  while ((match = MATH_PATTERN.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    const isBlock = match[1] !== undefined;
    const formula = (isBlock ? match[1] : match[2]) ?? "";
    try {
      result += katex.renderToString(formula, { throwOnError: false, displayMode: isBlock });
    } catch {
      result += escapeHtml(match[0]);
    }
    lastIndex = MATH_PATTERN.lastIndex;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

// Hiển thị text thường xen công thức toán LaTeX — dùng thay cho {text} thô
// ở mọi nơi hiển thị nội dung câu hỏi/đáp án do giáo viên nhập. Copy công
// thức từ Word (Equation Editor) KHÔNG tự thành LaTeX — giáo viên phải gõ
// hoặc dán mã LaTeX thật (vd \frac{a}{b}, x^2).
export function MathText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderMathText(text ?? ""), [text]);
  // eslint-disable-next-line react/no-danger
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
