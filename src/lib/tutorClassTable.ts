// Bảng "Lớp học" của gia sư (Figma "Gia sư · Lớp" 299:112349). Thuần (không Prisma) để test; truy vấn nằm ở tutorClassTableServer.ts.
// Không số bịa: lịch lấy từ ClassSchedule, tiến độ là SỐ BUỔI ĐÃ ĐIỂM DANH (chưa có tổng số buổi dự kiến của lớp nên không viết "2/5").
// Figma còn cột "Cách tính phí" (đơn giá/buổi, giờ, khoá): KiN chưa lưu cách tính phí theo từng lớp nên KHÔNG có cột đó.
import { hmOf, parseHm } from "@/lib/classSessions";

export interface ClassScheduleRule { dayOfWeek: number; startTime: string; endTime: string }
export interface TutorClassRow {
  id: string; name: string; category: string; classStatus: string; hidden: boolean;
  students: number; capacity: number | null; schedule: string | null; sessionsTaught: number;
  /** GS-LOP-GON: ảnh bìa thẻ lớp — CHỈ địa chỉ https đã lọc từ Course.bg (coverImageOf), không bao giờ là chuỗi bg thô. Không có ảnh → null (thẻ vẽ chữ cái đầu). Chỉ THÊM. */
  cover: string | null;
  /** SCL-B (Q1): chỉ có khi Chủ nhiệm (quản trị trung tâm) xem MỌI lớp — gia sư phụ trách của lớp (null = lớp chưa có chủ). Chỉ THÊM. */
  owner?: { id: string | null; name: string };
}

export const NO_OWNER_LABEL = "Chưa có gia sư phụ trách";

/** SCL-B: nhóm lớp theo gia sư phụ trách (danh sách của Chủ nhiệm). Giữ thứ tự lớp trong nhóm; nhóm xếp theo tên (vi), lớp chưa có chủ đứng cuối. */
export function groupClassesByOwner(rows: TutorClassRow[]): { ownerId: string | null; ownerName: string; rows: TutorClassRow[] }[] {
  const by = new Map<string, { ownerId: string | null; ownerName: string; rows: TutorClassRow[] }>();
  for (const r of rows) {
    const id = r.owner?.id ?? null;
    const key = id ?? "";
    const g = by.get(key) ?? { ownerId: id, ownerName: id ? (r.owner?.name || "Gia sư") : NO_OWNER_LABEL, rows: [] };
    g.rows.push(r);
    by.set(key, g);
  }
  return [...by.values()].sort((a, b) => (a.ownerId === null ? 1 : 0) - (b.ownerId === null ? 1 : 0) || a.ownerName.localeCompare(b.ownerName, "vi"));
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
