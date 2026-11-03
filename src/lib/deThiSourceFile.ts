// BU-03 P2 — luật THUẦN cho "tách đề từ tệp gốc": chỉ tải tệp từ Cloudinary của KiN (chống SSRF) và chỉ nhận .docx.
export const SOURCE_FILE_HOST = "res.cloudinary.com";

/** Cho phép tải khi: https, đúng host res.cloudinary.com, không tài khoản/mật khẩu trong địa chỉ, không cổng lạ. */
export function isAllowedSourceUrl(raw: unknown): boolean {
  if (typeof raw !== "string" || raw.length > 2000) return false;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  return u.protocol === "https:" && u.hostname === SOURCE_FILE_HOST && u.port === "" && u.username === "" && u.password === "";
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/** Tệp Word .docx theo tên hoặc loại khai báo (magic byte vẫn được readDocx kiểm lại). .doc cũ KHÔNG nhận. */
export function looksLikeDocx(file: { fileName: string; fileType: string }): boolean {
  return /\.docx$/i.test(file.fileName ?? "") || (file.fileType ?? "").toLowerCase() === DOCX_MIME;
}

// ── Hạn mức phân tích Word + kiểm hình ────────────────────────────────────────────────────────────
/** Mỗi gia sư tối đa chừng này lần phân tích Word (nhập Word + tách tệp gốc) trong một giờ. Đếm bằng bảng usage_events (bền, không phụ thuộc tiến trình). */
export const WORD_ANALYSE_PER_HOUR = 20;
export const WORD_ANALYSE_KIND = "word_analyse";
export const WORD_ANALYSE_WINDOW_MS = 60 * 60 * 1000;
/** Thuần: `used` lần đã phân tích trong cửa sổ 1 giờ → còn được thêm không. */
export function wordAnalyseAllowed(used: number): boolean {
  return Number.isFinite(used) && used < WORD_ANALYSE_PER_HOUR;
}
export const WORD_RATE_MESSAGE = `Cô đã phân tích Word ${WORD_ANALYSE_PER_HOUR} lần trong một giờ. Chờ một lúc rồi thử lại nhé.`;

/** Thuần: loại hình thật theo MAGIC BYTE (png / jpeg / gif / webp) — không tin phần mở rộng trong tệp Word. Không nhận ra → null. */
export function imageMimeFromMagic(b: Uint8Array): "image/png" | "image/jpeg" | "image/gif" | "image/webp" | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return "image/gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
