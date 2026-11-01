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
