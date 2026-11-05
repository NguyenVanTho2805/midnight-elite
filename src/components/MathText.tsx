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

// Token ảnh công thức (BU-03 MathType): {{ctimg:<base64 của SVG>}}. Chỉ hiện qua <img> (không bao giờ chèn SVG thô vào DOM).
// Định nghĩa cục bộ để không phụ thuộc src/lib; phải khớp makeFormulaImgToken phía máy chủ.
const IMG_TOKEN_RE = /\{\{ctimg:([A-Za-z0-9+/=]{1,12000})\}\}/g;
const SVG_B64_PREFIX = "PHN2Zy"; // base64 của "<svg"

function renderImgToken(b64: string): string {
  // b64 đã qua regex chỉ gồm [A-Za-z0-9+/=] nên đặt vào thuộc tính an toàn.
  if (!b64.startsWith(SVG_B64_PREFIX)) return '<span class="italic">[công thức (ảnh lỗi)]</span>';
  return `<img src="data:image/svg+xml;base64,${b64}" alt="công thức (ảnh)" style="display:inline-block;vertical-align:middle;max-width:100%;height:auto;background:var(--kin-nen-anh-cong-thuc, white);border-radius:2px" />`;
}

export function renderMathText(text: string): string {
  if (!text.includes("{{ctimg:")) return renderMathPlain(text);
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(IMG_TOKEN_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    out += renderMathPlain(text.slice(last, m.index)) + renderImgToken(m[1]);
    last = re.lastIndex;
  }
  return out + renderMathPlain(text.slice(last));
}

function renderMathPlain(text: string): string {
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
