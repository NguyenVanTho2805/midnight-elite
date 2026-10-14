// Số điện thoại cho đăng nhập bằng mã SMS. Thuần (không DB, không gửi tin) để test từng quy tắc.
//
// Chỉ nhận SỐ DI ĐỘNG VIỆT NAM: 10 số dạng 0[35789]xxxxxxxx (cũng chấp nhận +84 / 84 thay cho số 0 đầu). Số bàn, số ngắn, số nước
// ngoài đều bị từ chối — mã SMS chỉ có ý nghĩa với số di động và mỗi tin gửi đi đều tốn tiền.
// Dạng chuẩn dùng để lưu và so khớp là E.164: "+84901234567".
const VN_MOBILE = /^0[35789]\d{8}$/;

/** "0901 234 567", "090.123.4567", "+84 901 234 567", "(84) 901-234-567" → "+84901234567"; không phải di động VN → null. */
export function normalizeVnPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.length === 0 || s.length > 24) return null;
  if (!/^[+\d\s().-]+$/.test(s)) return null; // chữ cái, @ … → không phải số điện thoại
  let digits = s.replace(/\D/g, "");
  if (s.startsWith("+") || s.replace(/[^\d]/g, "").startsWith("84")) {
    if (digits.startsWith("84") && digits.length === 11) digits = "0" + digits.slice(2);
    else if (s.startsWith("+")) return null; // +<mã nước khác>
  }
  return VN_MOBILE.test(digits) ? `+84${digits.slice(1)}` : null;
}

/** "+84901234567" → "0901234567" (dạng người Việt đọc/nhập). */
export const toNationalVn = (e164: string): string => `0${e164.replace(/^\+84/, "")}`;

/** "+84901234567" → "090 ••• 4567" — cho thông báo "đã gửi mã tới …" mà không phơi cả số. */
export function maskPhone(e164: string): string {
  const n = toNationalVn(e164);
  return `${n.slice(0, 3)} ••• ${n.slice(-4)}`;
}

/** Khoá lưu mã trong bảng login_codes (cột `email` là khoá duy nhất): số điện thoại có tiền tố nên không thể trùng với email. */
export const phoneLoginKey = (e164: string): string => `tel:${e164}`;
/** Khoá cho mã xác minh số của người ĐANG đăng nhập (gắn userId: mã của người này không dùng được cho người khác). */
export const phoneClaimKey = (userId: string, e164: string): string => `claim:${userId}:${e164}`;

export type Identifier = { kind: "email"; email: string } | { kind: "phone"; e164: string };

/**
 * Một ô nhập "Số điện thoại hoặc email": có '@' → email, còn lại → số điện thoại. Trả null nếu không đúng dạng nào.
 * (Email đúng dạng phải do hàm normalizeEmail ở loginCode.ts kiểm; ở đây chỉ phân loại.)
 */
export function classifyIdentifier(raw: unknown, normalizeEmail: (v: unknown) => string | null): Identifier | null {
  if (typeof raw !== "string") return null;
  if (raw.includes("@")) {
    const email = normalizeEmail(raw);
    return email ? { kind: "email", email } : null;
  }
  const e164 = normalizeVnPhone(raw);
  return e164 ? { kind: "phone", e164 } : null;
}

/**
 * Sau khi ai đó sửa ô `phone` (tự khai): số ĐÃ XÁC MINH còn đúng không? Đổi sang số khác (hoặc xoá) thì xác minh hết hiệu lực — người dùng
 * phải nhận mã SMS ở số mới. Chưa từng xác minh thì không có gì để huỷ.
 */
export function staleVerification(currentE164: string | null | undefined, newPhone: unknown): boolean {
  if (!currentE164) return false;
  return normalizeVnPhone(newPhone) !== currentE164;
}
