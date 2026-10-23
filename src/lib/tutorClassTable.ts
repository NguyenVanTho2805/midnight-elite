// Bảng "Lớp học" của gia sư (Figma "Gia sư · Lớp" 299:112349). Thuần (không Prisma) để test; truy vấn nằm ở tutorClassTableServer.ts.
// Không số bịa: lịch lấy từ ClassSchedule, tiến độ là SỐ BUỔI ĐÃ ĐIỂM DANH (chưa có tổng số buổi dự kiến của lớp nên không viết "2/5").
// Figma còn cột "Cách tính phí" (đơn giá/buổi, giờ, khoá): KiN chưa lưu cách tính phí theo từng lớp nên KHÔNG có cột đó.
import { hmOf, parseHm } from "@/lib/classSessions";

export interface ClassScheduleRule { dayOfWeek: number; startTime: string; endTime: string }
export interface TutorClassRow {
  id: string; name: string; category: string; classStatus: string; hidden: boolean;
  students: number; capacity: number | null; schedule: string | null; sessionsTaught: number;
}

const DAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
// Thứ Hai trước, Chủ nhật cuối (cách người Việt đọc tuần).
const dayOrder = (d: number) => (d + 6) % 7;

/** "T6 · 19:00–20:30" ; nhiều khung thì nối bằng dấu phẩy; chưa có khung nào → null. */
export function formatScheduleRules(rules: ClassScheduleRule[]): string | null {
  const ok = rules.filter(r => r.dayOfWeek >= 0 && r.dayOfWeek <= 6 && parseHm(r.startTime) != null && parseHm(r.endTime) != null);
  if (ok.length === 0) return null;
  return [...ok]
    .sort((a, b) => dayOrder(a.dayOfWeek) - dayOrder(b.dayOfWeek) || (parseHm(a.startTime)! - parseHm(b.startTime)!))
    .map(r => `${DAY_SHORT[r.dayOfWeek]} · ${hmOf(parseHm(r.startTime)!)}–${hmOf(parseHm(r.endTime)!)}`)
    .join(", ");
}

export interface ClassFilter { q: string; category: string; status: string }

/** Lọc theo tên/môn (không phân biệt hoa thường, bỏ qua khoảng trắng thừa), môn học, trạng thái vận hành. */
export function filterClassRows(rows: TutorClassRow[], f: ClassFilter): TutorClassRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter(r =>
    (!q || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)) &&
    (!f.category || r.category === f.category) &&
    (!f.status || r.classStatus === f.status));
}
