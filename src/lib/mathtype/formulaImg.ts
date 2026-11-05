// BU-03-MATHTYPE — TOKEN ẢNH CÔNG THỨC `{{ctimg:<base64 chuẩn của SVG>}}`. THUẦN, không import gì (dùng được cả máy chủ lẫn trình duyệt).
// Công thức MathType mà bộ giải không chắc/không giải được hiện bằng ảnh xem trước WMF đã đổi sang SVG (wmfSvg.ts). Ảnh đi trong chính chữ của câu hỏi/đáp án dưới dạng token.
// Phía hiển thị CHỈ đặt SVG vào <img src="data:image/svg+xml;base64,…"> (script trong SVG nằm trong <img> không chạy), KHÔNG BAO GIỜ chèn SVG vào DOM.
// Phía LƯU phải gọi sanitizeFormulaImgTokens: token nào không qua validateFormulaSvg bị đổi thành nhãn ⟦công thức⟧ (câu bị chặn phát hành như cũ).

export const FORMULA_IMG_PLACEHOLDER = "⟦công thức⟧";
/** Trần cỡ một SVG (byte UTF-8). Lớn hơn → coi như thất bại, giữ nhãn + chặn. */
export const FORMULA_SVG_MAX = 6 * 1024;
/** Token toàn cục (cờ g). Dùng `new RegExp(FORMULA_IMG_RE.source, "g")` nếu cần vòng lặp độc lập (tránh dùng chung lastIndex). */
export const FORMULA_B64_MAX = Math.ceil(FORMULA_SVG_MAX / 3) * 4; // 8192 ký tự base64 cho 6 KB SVG
export const FORMULA_IMG_RE = /\{\{ctimg:([A-Za-z0-9+/=]{1,8192})\}\}/g;
/** Trần số token ảnh MỖI TRƯỜNG chữ và trần cỡ thật (byte UTF-8) MỖI TRƯỜNG — chặn nhồi token để phình dữ liệu. */
export const FORMULA_MAX_TOKENS_PER_FIELD = 20;
export const FORMULA_MAX_BYTES_PER_FIELD = 160 * 1024;
/** Token KHÔNG ràng buộc ký tự: để bắt cả token hỏng khi làm sạch. */
const LOOSE_RE = /\{\{ctimg:([^{}]*)\}\}/g;

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

export function utf8ToBase64(s: string): string {
  const b = enc(s);
  if (typeof Buffer !== "undefined") return Buffer.from(b).toString("base64");
  let bin = ""; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin);
}
export function base64ToUtf8(b64: string): string | null {
  try {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 !== 0) return null;
    if (typeof Buffer !== "undefined") return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(b64, "base64"));
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(u);
  } catch { return null; }
}

const TAGS = new Set(["svg", "g", "text", "tspan", "path", "line", "polyline", "polygon", "rect", "ellipse", "circle"]);
const ATTRS = new Set([
  "xmlns", "width", "height", "viewBox", "x", "y", "d", "fill", "stroke", "stroke-width", "stroke-linejoin", "stroke-linecap", "stroke-miterlimit",
  "font-family", "font-size", "font-style", "font-weight", "text-decoration", "text-anchor", "points", "x1", "y1", "x2", "y2", "transform", "fill-rule",
  "cx", "cy", "rx", "ry", "r", "opacity", "data-depth", "data-src",
]);
const TAG_RE = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z][a-zA-Z0-9:-]*="[^"<>]*")*)\s*(\/?)>$/;
const ATTR_RE = /\s+([a-zA-Z][a-zA-Z0-9:-]*)="([^"<>]*)"/g;
const XMLNS = "http://www.w3.org/2000/svg";

/** SVG hợp lệ = do KiN sinh: chỉ vài thẻ/thuộc tính trong danh sách cho phép, không script, không liên kết ngoài, không CSS, không thực thể lạ. */
export function validateFormulaSvg(svg: unknown): svg is string {
  if (typeof svg !== "string" || svg.length < 20) return false;
  if (enc(svg).length > FORMULA_SVG_MAX) return false;
  if (!svg.startsWith("<svg") || !svg.endsWith("</svg>")) return false;
  if (/<script|foreignobject|href|javascript:|\bon[a-z]+\s*=|url\s*\(|@import|<!|<\?|\]\]>|data:|expression\s*\(/i.test(svg)) return false;
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d{1,6};|#x[0-9a-fA-F]{1,6};)/.test(svg)) return false;
  // Duyệt tuyến tính: mọi `<` mở một thẻ hợp quy cách; chữ giữa các thẻ không có `<`/`>`.
  let i = 0, depth = 0, sawRoot = false;
  while (i < svg.length) {
    if (svg[i] === "<") {
      const j = svg.indexOf(">", i);
      if (j < 0) return false;
      const m = TAG_RE.exec(svg.slice(i, j + 1));
      if (!m) return false;
      const [, close, name, attrs, selfClose] = m;
      if (!TAGS.has(name)) return false;
      if (close) { if (attrs || selfClose || --depth < 0) return false; }
      else {
        if (name === "svg") { if (sawRoot) return false; sawRoot = true; }
        else if (!sawRoot) return false;
        ATTR_RE.lastIndex = 0;
        let a: RegExpExecArray | null, rebuilt = "";
        while ((a = ATTR_RE.exec(attrs)) !== null) {
          if (!ATTRS.has(a[1])) return false;
          if (a[1] === "xmlns" && a[2] !== XMLNS) return false;
          rebuilt += a[0];
        }
        if (rebuilt !== attrs) return false;
        if (!selfClose) depth++;
      }
      i = j + 1;
    } else {
      const j = svg.indexOf("<", i);
      const chunk = svg.slice(i, j < 0 ? svg.length : j);
      if (chunk.includes(">")) return false;
      if (j < 0) return false;
      i = j;
    }
  }
  return depth === 0 && sawRoot;
}

/** Bao SVG thành token. Trả null nếu SVG không hợp lệ/quá lớn (người gọi giữ nhãn + chặn). */
export function makeFormulaImgToken(svg: string): string | null {
  if (!validateFormulaSvg(svg)) return null;
  return `{{ctimg:${utf8ToBase64(svg)}}}`;
}

/** Giải một token (phần base64) → SVG nếu hợp lệ, ngược lại null. */
export function svgFromFormulaImgB64(b64: string): string | null {
  const s = base64ToUtf8(b64);
  return s !== null && validateFormulaSvg(s) ? s : null;
}

/** Làm sạch khi LƯU: token hỏng/độc/quá dài/vượt trần số token → nhãn ⟦công thức⟧. Chuỗi không có token trả nguyên. */
export function sanitizeFormulaImgTokens(text: string, replacement: string = FORMULA_IMG_PLACEHOLDER): string {
  if (!text.includes("{{ctimg:")) return text;
  let kept = 0;
  return text.replace(LOOSE_RE, (all, b64: string) => {
    if (b64.length > FORMULA_B64_MAX || kept >= FORMULA_MAX_TOKENS_PER_FIELD) return replacement;
    if (svgFromFormulaImgB64(b64) === null) return replacement;
    kept++;
    return all;
  });
}

const STRICT_RE = new RegExp(FORMULA_IMG_RE.source, "g");

/**
 * Độ dài tính cho giới hạn ký tự: CHỈ token khớp chặt (base64 ≤ 8192) đếm 1 ký tự; mọi thứ khác (token lỏng/quá dài/sai) đếm đủ độ dài thật,
 * nên không thể nhét 5 MB vào một "token" mà vẫn qua giới hạn.
 */
export function visibleLength(text: string): number {
  return text.includes("{{ctimg:") ? text.replace(STRICT_RE, "▯").length : text.length;
}

/** Lỗi tiếng Việt nếu một trường chữ vượt trần số token ảnh hoặc trần cỡ thật; null nếu ổn. Gọi SAU sanitize khi kiểm hợp lệ. */
export function formulaFieldError(text: string, label: string): string | null {
  if (typeof text !== "string" || !text.includes("{{ctimg:")) return null;
  const n = (text.match(STRICT_RE) ?? []).length;
  if (n > FORMULA_MAX_TOKENS_PER_FIELD) return `${label} có quá nhiều ảnh công thức (tối đa ${FORMULA_MAX_TOKENS_PER_FIELD})`;
  if (enc(text).length > FORMULA_MAX_BYTES_PER_FIELD) return `${label} quá nặng (tối đa ${FORMULA_MAX_BYTES_PER_FIELD / 1024} KB kể cả ảnh công thức)`;
  return null;
}

/** Cắt theo `visibleLength` ≤ max, KHÔNG BAO GIỜ cắt giữa một token hợp quy cách. */
export function clipVisible(text: string, max: number): string {
  if (!text.includes("{{ctimg:")) return text.length > max ? text.slice(0, max) : text;
  let out = "", vis = 0, last = 0;
  const re = new RegExp(FORMULA_IMG_RE.source, "g");
  let m: RegExpExecArray | null;
  const take = (s: string): boolean => { const room = max - vis; if (s.length <= room) { out += s; vis += s.length; return true; } out += s.slice(0, room); vis = max; return false; };
  while ((m = re.exec(text)) !== null) {
    if (!take(text.slice(last, m.index))) return out;
    if (vis + 1 > max) return out;
    out += m[0]; vis += 1; last = re.lastIndex;
  }
  take(text.slice(last));
  return out;
}

/** Xem trước dạng CHỮ THUẦN (không vẽ ảnh): token ảnh thành "[ảnh công thức]" rồi mới cắt, nên không bao giờ lòi chuỗi base64 hay bị cắt giữa token. */
export function plainPreview(text: string, max: number): string {
  const t = text.includes("{{ctimg:") ? text.replace(new RegExp(LOOSE_RE.source, "g"), "[ảnh công thức]") : text;
  return t.length > max ? t.slice(0, max) + "…" : t;
}
