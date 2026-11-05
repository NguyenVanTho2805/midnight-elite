"use client";

import { useMemo } from "react";
import katex from "katex";
import { svgFromFormulaImgB64, formulaImgLooseRegex, FORMULA_B64_MAX, FORMULA_MAX_TOKENS_PER_FIELD } from "@/lib/mathtype/formulaImg";

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
// Regex/trần dùng chung với máy chủ (src/lib/mathtype/formulaImg.ts — module thuần, an toàn cho trình duyệt). Phía hiển thị TỰ KIỂM lại:
// dữ liệu cũ hoặc đường lưu lọt không bao giờ được render nguyên — token hỏng/độc/quá dài/vượt trần → nhãn.
const BAD_IMG = '<span class="italic">[công thức (ảnh lỗi)]</span>';

function renderImgToken(b64: string, allowed: boolean): string {
  if (!allowed || b64.length > FORMULA_B64_MAX) return BAD_IMG;
  const svg = svgFromFormulaImgB64(b64); // giải base64 + validateFormulaSvg (danh sách trắng thẻ/thuộc tính)
  if (svg === null) return BAD_IMG;
  // b64 đã qua kiểm base64 chuẩn nên đặt vào thuộc tính an toàn.
  return `<img src="data:image/svg+xml;base64,${b64}" alt="công thức (ảnh)" style="display:inline-block;vertical-align:middle;max-width:100%;height:auto;background:var(--kin-nen-anh-cong-thuc, white);border-radius:2px" />`;
}

export function renderMathText(text: string): string {
  if (!text.includes("{{ctimg:")) return renderMathPlain(text);
  let out = "";
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  const re = formulaImgLooseRegex(); // bắt cả token lỏng để thay bằng nhãn thay vì lòi base64 ra chữ
  while ((m = re.exec(text)) !== null) {
    out += renderMathPlain(text.slice(last, m.index)) + renderImgToken(m[1], n++ < FORMULA_MAX_TOKENS_PER_FIELD);
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
