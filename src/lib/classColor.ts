// Màu nhận diện của một lớp trên Lịch và thẻ lớp: cùng lớp luôn cùng màu, lớp khác nhau thường khác màu.
// Chỉ trả về TOKEN --kin-* (không mã hex). Hàm thuần, không đọc DB.
export const CLASS_ACCENTS = [
  "var(--kin-th-xanh-troi)",
  "var(--kin-th-bac-ha)",
  "var(--kin-th-vang-nang)",
  "var(--kin-th-xanh-link)",
  "var(--kin-ph-hub)",
] as const;

export function classAccent(courseId: string): string {
  let h = 0;
  for (let i = 0; i < courseId.length; i++) h = (h * 31 + courseId.charCodeAt(i)) >>> 0;
  return CLASS_ACCENTS[h % CLASS_ACCENTS.length];
}

/** LI-02: bảng 25 màu để gia sư chọn cho lớp. Khoá lưu ở Course.calendarColor; màu thật là token --kin-lop-NN trong globals.css. */
export const CLASS_PALETTE_KEYS = Array.from({ length: 25 }, (_, i) => `lop-${String(i + 1).padStart(2, "0")}`) as readonly string[];
export const isClassColorKey = (v: unknown): v is string => typeof v === "string" && CLASS_PALETTE_KEYS.includes(v);
export const classColorToken = (key: string) => `var(--kin-${key})`;

/** Màu của lớp: ưu tiên màu gia sư đã chọn (khoá hợp lệ), không thì suy từ mã lớp như cũ. */
export function classAccentFor(courseId: string, chosen?: string | null): string {
  return isClassColorKey(chosen) ? classColorToken(chosen) : classAccent(courseId);
}

/** Lời chào theo giờ Việt Nam (0–23). */
export function greetingForHour(hour: number): string {
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/** Tỉ lệ lấp đầy lớp 0–100, hoặc null khi lớp không giới hạn sĩ số. */
export function fillPercent(students: number, capacity: number | null): number | null {
  if (capacity == null || capacity <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((students / capacity) * 100)));
}
