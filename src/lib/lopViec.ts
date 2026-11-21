// SCL-G-GS (21/11/2026, QUYET-DINH-GIAO-DIEN §2.2, §3.4) — phần THUẦN của Hộp việc gia sư và thanh "Lớp của bạn": chữ của hàng, đếm việc, lọc lớp.
// Không Prisma, không đồng hồ ngầm. Phần chạm DB ở lopViecServer.ts. Test: tools/local-e2e/t-scl-g-gs-lib.ts.
import { fold } from "@/lib/librarySearch";

/** Việc của MỘT lớp. Badge và câu tóm tắt chỉ đếm ba việc cần gia sư ra tay; "Buổi tới chưa có video" là lời nhắc, không đếm. */
export interface ClassTodo {
  courseId: string;
  choCham: number;
  choDuyet: number;
  xinVao: number;
  nextNoVideo: { lessonId: string; title: string; dateKey: string } | null;
}

export const emptyTodo = (courseId: string): ClassTodo => ({ courseId, choCham: 0, choDuyet: 0, xinVao: 0, nextNoVideo: null });
export const todoTotal = (t: Pick<ClassTodo, "choCham" | "choDuyet" | "xinVao">): number => t.choCham + t.choDuyet + t.xinVao;

/** Lớp có việc gì để hiện ở Hộp việc (tính cả lời nhắc video). */
export const hasAnyTodo = (t: ClassTodo): boolean => todoTotal(t) > 0 || !!t.nextNoVideo;

/** "9 việc ở 3 lớp" — chỉ đếm việc cần ra tay; không có thì nói thẳng. */
export function inboxSummary(todos: readonly ClassTodo[]): string {
  const busy = todos.filter(t => todoTotal(t) > 0);
  const n = busy.reduce((a, t) => a + todoTotal(t), 0);
  return n === 0 ? "Không có việc nào cần bạn xử lý" : `${n} việc ở ${busy.length} lớp`;
}

/** Cột "Video" của hàng bài: "Video 42 phút" (ghi đủ chữ, không "42′"), "Có video" khi chưa ghi thời lượng, "Chưa có video". */
export function videoText(videoUrl: string | null | undefined, duration: string | null | undefined): string {
  if (!videoUrl || !videoUrl.trim()) return "Chưa có video";
  const d = (duration ?? "").trim();
  if (!d) return "Có video";
  if (/^\d{1,4}$/.test(d)) return `Video ${Number(d)} phút`;
  const hms = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})$/.exec(d); // 1:02:30 hoặc 42:10
  if (hms) {
    const min = Math.max(1, Math.round((Number(hms[1] ?? 0) * 3600 + Number(hms[2]) * 60 + Number(hms[3])) / 60));
    return `Video ${min} phút`;
  }
  return `Video ${d.replace(/['′]$/, " phút")}`;
}

/** Cột "Nộp 4/12": số học sinh đã nộp ít nhất một bài tập của bài / sĩ số. Bài không có bài tập → null (không vẽ cột). */
export function nopText(stat: { submitted: number; total: number; hasAssignment: boolean } | undefined): string | null {
  if (!stat || !stat.hasAssignment) return null;
  return `Nộp ${stat.submitted}/${stat.total}`;
}

/** Ô lọc lớp chỉ hiện khi có NHIỀU HƠN 8 lớp (§2.2). */
export const RAIL_FILTER_AFTER = 8;
export const showClassFilter = (n: number): boolean => n > RAIL_FILTER_AFTER;

/** Lọc lớp theo tên lớp hoặc tên gia sư, không phân biệt dấu / hoa thường. Ô trống → nguyên danh sách. */
export function filterClasses<T>(list: readonly T[], q: string, text: (c: T) => string): T[] {
  const words = fold(q).split(" ").filter(Boolean);
  if (!words.length) return [...list];
  return list.filter(c => { const hay = fold(text(c)); return words.every(w => hay.includes(w)); });
}

/** Chủ nhiệm thấy MỌI lớp, nhóm theo gia sư (chủ lớp). Thứ tự nhóm giữ theo lớp đầu tiên của mỗi gia sư; lớp chưa có chủ vào nhóm "Lớp của trung tâm". */
export function groupByOwner<T extends { ownerName?: string | null }>(list: readonly T[]): { title: string; items: T[] }[] {
  const by = new Map<string, T[]>();
  for (const c of list) {
    const k = c.ownerName?.trim() ? `Lớp của ${c.ownerName.trim()}` : "Lớp của trung tâm";
    by.set(k, [...(by.get(k) ?? []), c]);
  }
  return [...by.entries()].map(([title, items]) => ({ title, items }));
}

/** Thanh dưới gia sư điện thoại (§3.4: đúng Hộp việc / Lớp / Tôi): mục daily chỉ hiện trên máy tính, trừ Hộp việc mới ("viec-lop").
 *  Hộp việc cũ (cờ HOP_VIEC, module "hop-viec") còn bật thì `daily` không có "viec-lop" ⇒ thêm nó chỉ cho điện thoại, để thanh dưới không mất mục đầu. */
export function withMobileInbox<T extends { key: string; desktopOnly?: boolean; mobileOnly?: boolean }>(daily: readonly T[], inbox: T): T[] {
  const has = daily.some(m => m.key === inbox.key);
  return [...(has ? [] : [{ ...inbox, mobileOnly: true }]), ...daily.map(m => ({ ...m, desktopOnly: m.key !== inbox.key }))];
}

const DAY_VI = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
/** Lịch học trên dòng phụ đầu lớp: "Thứ Ba, Thứ Năm, 19:00"; nhiều giờ khác nhau thì nối "·". Thứ Hai trước, Chủ nhật cuối. Không có khung ⇒ null. */
export function scheduleText(slots: readonly { dayOfWeek: number; startTime: string }[]): string | null {
  const byTime = new Map<string, Set<number>>();
  for (const s of slots) { const d = byTime.get(s.startTime) ?? new Set<number>(); d.add(s.dayOfWeek); byTime.set(s.startTime, d); }
  if (!byTime.size) return null;
  const order = (d: number) => (d === 0 ? 7 : d);
  return [...byTime].sort(([a], [b]) => a.localeCompare(b))
    .map(([t, ds]) => `${[...ds].sort((a, b) => order(a) - order(b)).map(d => DAY_VI[d] ?? "").join(", ")}, ${t}`).join(" · ");
}
