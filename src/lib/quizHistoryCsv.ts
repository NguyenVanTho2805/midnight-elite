// QZ-08 — xuất nhật ký chấm / sửa điểm của một quiz ra CSV. THUẦN: nhận đúng dữ liệu của loadHistory, trả chữ CSV.
//  • UTF-8 có BOM (Excel đọc đúng tiếng Việt) và chống CSV injection: ô chữ bắt đầu bằng = + - @ (hoặc tab / xuống dòng đầu) được chèn dấu nháy đơn — dùng chung csvCell của revenue.ts.
//    Số giữ là số (Excel còn tính được). Tên học sinh và nhận xét của gia sư là chữ tự nhập nên có thể là "=HYPERLINK(...)".
//  • Có TÊN học sinh nên chỉ gọi sau requireOwnedExam (gia sư chủ đề). Không có cột nào ngoài những gì màn "Lịch sử công bố" đã cho gia sư thấy, cộng người thực hiện.
//  • Giờ theo giờ Việt Nam. Mới nhất ở trên, giống màn hình.
import { toCsv } from "@/lib/revenue";

export interface HistoryPublish { attemptId: string; studentName: string; at: string; byName: string }
export interface HistoryEdit {
  id: string; attemptId: string; studentName: string; questionOrder: number | null;
  prevPoints: number | null; newPoints: number; prevComment: string | null; newComment: string | null; at: string; byName: string;
}
export interface HistoryData { publishes: HistoryPublish[]; edits: HistoryEdit[] }

export const HISTORY_CSV_HEADERS = ["Thời điểm (giờ VN)", "Loại", "Học sinh", "Câu", "Điểm cũ", "Điểm mới", "Nhận xét cũ", "Nhận xét mới", "Người thực hiện"] as const;
export const KIND_PUBLISH = "Công bố điểm";
export const KIND_GRADE = "Chấm điểm";   // lần đầu có điểm (điểm cũ trống)
export const KIND_EDIT = "Sửa điểm";     // đã có điểm trước đó

const pad = (n: number) => String(n).padStart(2, "0");
/** "2026-10-25 20:05:09" theo giờ Việt Nam (tính tay, không phụ thuộc ICU máy chủ). Chuỗi không đọc được → "". */
export function vnStamp(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const v = new Date(t + 7 * 3_600_000);
  return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}`;
}

export function historyRows(h: HistoryData): (string | number | null)[][] {
  const out: { t: number; row: (string | number | null)[] }[] = [];
  for (const p of h.publishes) out.push({ t: Date.parse(p.at) || 0, row: [vnStamp(p.at), KIND_PUBLISH, p.studentName, "", "", "", "", "", p.byName] });
  for (const e of h.edits) {
    out.push({
      t: Date.parse(e.at) || 0,
      row: [vnStamp(e.at), e.prevPoints === null ? KIND_GRADE : KIND_EDIT, e.studentName, e.questionOrder ?? "", e.prevPoints, e.newPoints, e.prevComment ?? "", e.newComment ?? "", e.byName],
    });
  }
  out.sort((a, b) => b.t - a.t);
  return out.map(x => x.row);
}

/** Toàn bộ tệp CSV (đã có BOM). Không có dòng nào vẫn trả dòng tiêu đề. */
export function historyCsv(h: HistoryData): string {
  return toCsv([[...HISTORY_CSV_HEADERS], ...historyRows(h)]);
}

/** Tên tệp ASCII an toàn cho Content-Disposition: nhat-ky-cham-quiz-2026-10-25.csv */
export function historyCsvFilename(nowIso: string): string {
  const d = vnStamp(nowIso).slice(0, 10) || "khong-ro-ngay";
  return `nhat-ky-cham-quiz-${d}.csv`;
}
