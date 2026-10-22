// NC2-024 — tin "Lịch tuần" của MỘT lớp để gia sư mở Zalo gửi vào nhóm lớp (hoặc chép tin).
// Hàm THUẦN: nhận đúng các buổi mà trang Lịch đã tải (đã qua applyChanges phía máy chủ) nên không tự tính lại khác trang.
//  • buổi đã HUỶ: ghi "(nghỉ)"; buổi đã DỜI: ghi ngày/giờ MỚI kèm "dời từ …";
//  • KHÔNG tên học sinh/phụ huynh, KHÔNG số tiền, KHÔNG link phiếu/sổ, KHÔNG link lớp.
import { addDaysKey, dayOfWeekOfKey, hmOf, vnDateKeyOf, vnMinutesOfDay } from "./classSessions";

const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const hmIso = (iso: string) => hmOf(vnMinutesOfDay(new Date(iso)));

/** Phần của một buổi mà tin cần (ScheduleOccurrence của trang Lịch có đủ các trường này). */
export interface WeeklyOccurrence {
  courseId: string;
  courseName: string;
  /** Ngày HIỆU LỰC (đã tính dời). */
  dateKey: string;
  startAt: string;
  endAt: string;
  status: "scheduled" | "cancelled" | "moved";
  movedFrom: { dateKey: string; startAt: string; endAt: string } | null;
}

/** Các lớp có buổi trong dữ liệu tuần, giữ thứ tự xuất hiện đầu tiên. */
export function coursesInWeek(occs: readonly WeeklyOccurrence[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const o of occs) if (!seen.has(o.courseId)) seen.set(o.courseId, o.courseName);
  return [...seen].map(([id, name]) => ({ id, name }));
}

/** Các buổi của MỘT lớp, xếp theo giờ bắt đầu. */
export function occurrencesOfCourse<T extends WeeklyOccurrence>(occs: readonly T[], courseId: string): T[] {
  return occs.filter(o => o.courseId === courseId).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

export function weekdayLabel(dateKey: string): string { return WEEKDAY[dayOfWeekOfKey(dateKey)]; }

/**
 * Tin lịch tuần. `from` = ngày đầu tuần đang xem (YYYY-MM-DD). Trả "" khi lớp không có buổi nào trong tuần
 * (giao diện khoá nút, không dựng tin rỗng).
 */
export function buildWeeklyScheduleMessage(i: { subject: string; from: string; occurrences: readonly WeeklyOccurrence[] }): string {
  if (i.occurrences.length === 0) return "";
  const to = addDaysKey(i.from, 6);
  const sorted = [...i.occurrences].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const lines = sorted.map(o => {
    const k = o.dateKey || vnDateKeyOf(new Date(o.startAt));
    const head = `- ${weekdayLabel(k)} ${ddmm(k)}, ${hmIso(o.startAt)}–${hmIso(o.endAt)}`;
    if (o.status === "cancelled") return `${head} (nghỉ)`;
    if (o.status === "moved" && o.movedFrom) {
      const ok = vnDateKeyOf(new Date(o.movedFrom.startAt));
      return `${head} (dời từ ${weekdayLabel(ok)} ${ddmm(ok)} ${hmIso(o.movedFrom.startAt)})`;
    }
    if (o.status === "moved") return `${head} (dời lịch)`;
    return head;
  });
  return [
    `KiN gửi lịch học tuần ${ddmm(i.from)} – ${ddmm(to)} của lớp ${i.subject}:`,
    ...lines,
    "Cần nghỉ thì báo riêng với thầy/cô trước giờ học nhé.",
  ].join("\n");
}
