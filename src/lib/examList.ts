// Danh sách đề thi theo thời gian (NC2-040, góp ý 28/10: "xếp theo tháng cho gọn, hiện đang dàn một loạt, không theo thời gian").
// THUẦN: không DB, không React, không giờ hệ thống. Test: tools/local-e2e/t-exam-list-lib.ts.
//
// Exam.date là CHUỖI "dd/mm/yyyy" (xem prisma Exam.date), Exam.time là "HH:mm". API /api/exams xếp theo ngày TẠO đề, nên danh sách trước đây không theo
// thời gian thi. Ở đây xếp theo ngày + giờ thi, mới nhất trước, rồi gom theo tháng. Đề có ngày không đọc được không bị ẩn: xuống nhóm cuối "Chưa có ngày".
import { isValidDateKey } from "@/lib/classSessions";

export interface DatedExam { date: string; time: string }

/** "dd/mm/yyyy" (hoặc "yyyy-mm-dd") → "YYYY-MM-DD". Sai định dạng hoặc ngày không có thật (31/02) → null. */
export function examDateKey(date: string | null | undefined): string | null {
  const s = (date ?? "").trim();
  let key: string | null = null;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmy) key = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) key = s;
  return key && isValidDateKey(key) ? key : null;
}

/** "YYYY-MM-DD HH:mm" để so sánh chuỗi; giờ sai hoặc thiếu coi là 00:00. Ngày không đọc được → null. */
export function examSortKey(e: DatedExam): string | null {
  const d = examDateKey(e.date);
  if (!d) return null;
  const t = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((e.time ?? "").trim());
  return `${d} ${t ? `${t[1].padStart(2, "0")}:${t[2]}` : "00:00"}`;
}

export const NO_DATE_KEY = "chua-co-ngay";

export interface ExamMonthGroup<E> {
  /** "YYYY-MM" hoặc NO_DATE_KEY. */
  key: string;
  /** "Tháng 10/2026" hoặc "Chưa có ngày thi". */
  label: string;
  items: E[];
}

/** Mới nhất trước (cả tháng lẫn đề trong tháng); cùng thời điểm giữ thứ tự đầu vào. Không đổi mảng đầu vào. */
export function groupExamsByMonth<E extends DatedExam>(exams: readonly E[]): ExamMonthGroup<E>[] {
  const keyed = exams.map((e, i) => ({ e, i, k: examSortKey(e) }));
  const dated = keyed.filter(x => x.k !== null).sort((a, b) => (a.k! < b.k! ? 1 : a.k! > b.k! ? -1 : a.i - b.i));
  const undated = keyed.filter(x => x.k === null);
  const groups: ExamMonthGroup<E>[] = [];
  for (const x of dated) {
    const month = x.k!.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === month) last.items.push(x.e);
    else groups.push({ key: month, label: `Tháng ${Number(month.slice(5, 7))}/${month.slice(0, 4)}`, items: [x.e] });
  }
  if (undated.length) groups.push({ key: NO_DATE_KEY, label: "Chưa có ngày thi", items: undated.map(x => x.e) });
  return groups;
}
