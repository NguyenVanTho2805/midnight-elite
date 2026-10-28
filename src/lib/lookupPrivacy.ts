// Trang "Tra cứu học viên" công khai (/tra-cuu, NC2-053): ai nhập một số điện thoại cũng gọi được API, nên trả về BAO NHIÊU là chuyện riêng tư của học sinh (phần lớn dưới 18 tuổi).
// THUẦN: không DB, không React, không giờ hệ thống. Test: tools/local-e2e/t-tra-cuu-lib.ts.
//
// Quy tắc: người chưa đăng nhập (hoặc đăng nhập nhưng không phải chính học sinh đó) chỉ thấy TÊN ĐÃ CHE + SỐ KHOÁ ĐÃ ĐĂNG KÝ — không mã học viên, không tên khoá, không mã khoá.
// "Khoá" = ghi danh đang học (status active); khoá chờ phụ huynh xác nhận / tạm dừng không lộ ra. Chỉ chính học sinh đó (phiên đăng nhập trùng) mới thấy đủ. Chỉ khớp theo SĐT học sinh tự đăng ký; SĐT phụ huynh trong hồ sơ là chữ tự khai, KHÔNG cấp quyền
// (prisma/schema.prisma ghi rõ; nguồn tin cậy là ParentLink đã xác nhận).

/** Số di động Việt Nam 10 chữ số (đầu 03 / 05 / 07 / 08 / 09). Bản cũ viết `[3|5|7|8|9]` nên "0|12345678" cũng lọt qua. */
export const LOOKUP_PHONE_RE = /^0[35789][0-9]{8}$/;

/** Bỏ mọi khoảng trắng; trả số hợp lệ hoặc null (không đoán, không đổi +84). */
export function cleanLookupPhone(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).replace(/\s/g, "");
  return LOOKUP_PHONE_RE.test(s) ? s : null;
}

/** Giới hạn gọi (bộ đếm trong bộ nhớ của từng máy chủ — xem ghi chú ở route). */
export const LOOKUP_LIMITS = {
  ipPerMinute: 10,
  ipPerDay: 60,
  phonePerWindow: 5,
  phoneWindowMs: 10 * 60_000,
} as const;

const initial = (w: string) => ([...w][0] ?? "").toLocaleUpperCase("vi");

/**
 * Che tên: giữ HỌ (từ đầu), các từ sau chỉ còn chữ cái đầu. "Nguyễn Văn Thọ" → "Nguyễn V. T."; một từ → chữ cái đầu + chấm ("Thọ" → "T.").
 * Tên rỗng → "***". Đủ để phụ huynh nhận ra con, không đủ để biết tên thật.
 */
export function maskName(name: unknown): string {
  const parts = (typeof name === "string" ? name : "").normalize("NFC").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "***";
  if (parts.length === 1) return `${initial(parts[0])}.`;
  return [parts[0], ...parts.slice(1).map(p => `${initial(p)}.`)].join(" ");
}

export interface LookupCourse { id: string; name: string; shortTitle: string; category: string; status: boolean }
export interface LookupRow { name: string; studentId: number | null; courses: LookupCourse[] }
export type LookupResult =
  | { detail: true; name: string; studentId: number | null; courses: LookupCourse[] }
  | { detail: false; name: string; courseCount: number };

/** Dựng kết quả trả cho trình duyệt. `isOwner` = phiên đăng nhập CHÍNH LÀ học sinh này. Bản che KHÔNG chứa mã học viên hay khoá (kiểu dữ liệu không có chỗ cho chúng). */
export function buildLookupResult(row: LookupRow, isOwner: boolean): LookupResult {
  if (isOwner) return { detail: true, name: row.name, studentId: row.studentId, courses: row.courses };
  return { detail: false, name: maskName(row.name), courseCount: row.courses.length };
}
