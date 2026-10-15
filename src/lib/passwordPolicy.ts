// Quy tắc mật khẩu mới — KHÔNG import gì của Node, để trang đặt lại mật khẩu (trình duyệt) và máy chủ dùng chung một nguồn.
export const MIN_PASSWORD_LEN = 8;
export const MAX_PASSWORD_LEN = 1024;

/** Lỗi của mật khẩu mới (chuỗi tiếng Việt) hoặc null nếu hợp lệ. */
export function validateNewPassword(p: unknown): string | null {
  if (typeof p !== "string" || p.length === 0) return "Vui lòng nhập mật khẩu mới";
  if (p.length < MIN_PASSWORD_LEN) return "Mật khẩu cần ít nhất 8 ký tự";
  if (p.length > MAX_PASSWORD_LEN) return "Mật khẩu quá dài";
  return null;
}
