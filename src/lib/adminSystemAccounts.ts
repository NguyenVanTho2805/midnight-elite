// BU-08 / BU-05: tài khoản HỆ THỐNG (ví dụ tài khoản đứng tên các câu hỏi của khách) không phải học sinh thật:
// phải bị loại khỏi danh sách và số đếm học sinh, và không nhận thông báo. PHẦN THUẦN (không DB).
export const SYSTEM_EMAIL_SUFFIX = "@he-thong.kin.invalid";

/** So khớp theo ĐUÔI (không phải "chứa"), không phân biệt hoa thường, và chỉ nhận email có đúng MỘT dấu @. */
export function isSystemAccountEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string") return false;
  const e = email.trim().toLowerCase();
  return e.endsWith(SYSTEM_EMAIL_SUFFIX) && e.split("@").length === 2 && e.length > SYSTEM_EMAIL_SUFFIX.length;
}

/**
 * Điều kiện Prisma loại tài khoản hệ thống. Cột `email` không bao giờ null nên `NOT` an toàn.
 * Nếu sau này dùng `NOT` trên cột CÓ THỂ null thì phải thêm `OR: [{ col: null }, …]` (Prisma `NOT` loại cả hàng NULL).
 */
export const NOT_SYSTEM_ACCOUNT = { NOT: { email: { endsWith: SYSTEM_EMAIL_SUFFIX, mode: "insensitive" as const } } };
