// QZ — "Lưu vào ngân hàng câu hỏi" từ trình soạn quiz: phần THUẦN (đường dẫn đầu mục, độ khó). Không DB, không React.
export interface BankCategory { id: string; name: string; parentId: string | null }

export const BANK_DIFFICULTIES: { v: "NB" | "TH" | "VD" | "VDC"; label: string }[] = [
  { v: "NB", label: "Nhận biết" }, { v: "TH", label: "Thông hiểu" }, { v: "VD", label: "Vận dụng" }, { v: "VDC", label: "Vận dụng cao" },
];

/** "Toán › Lớp 9 › Hàm số" — đường dẫn đầu mục từ gốc. Vòng lặp parentId (dữ liệu hỏng) bị cắt, id không có → "". */
export function categoryPath(cats: readonly BankCategory[], id: string): string {
  const by = new Map(cats.map(c => [c.id, c]));
  const parts: string[] = []; const seen = new Set<string>();
  for (let cur = by.get(id); cur && !seen.has(cur.id); cur = cur.parentId ? by.get(cur.parentId) : undefined) { seen.add(cur.id); parts.unshift(cur.name); }
  return parts.join(" › ");
}
