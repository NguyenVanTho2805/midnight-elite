// Lịch học tuần của học sinh (Figma "Học sinh · Lịch học" 299:114537 / 299:116644). PHẦN THUẦN: gộp buổi học, buổi thi, hạn nộp (lịch)
// và hạn nộp bài tập (việc của tôi) thành các mục theo ngày VN trong một tuần thứ Hai → Chủ nhật. Không đọc đồng hồ, không đụng cơ sở dữ liệu.
import type { ScheduleEvent } from "@/lib/studentSchedule";
import type { StudentTodoItem } from "@/lib/studentTodo";
import { addDaysKey, dayOfWeekOfKey, hmOf, parseHm, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";
import { placeLabel } from "@/lib/sessionBook";

export type WeekKind = "class" | "exam" | "deadline" | "task";
export interface WeekItem {
  id: string;
  kind: WeekKind;
  dateKey: string;
  /** Phút kể từ 00:00 (giờ VN). */
  start: number;
  end: number | null;
  title: string;
  sub: string;
  href: string;
  external: boolean;
  cancelled: boolean;
  /** Bài tập chưa nộp (chỉ kind "task"). */
  unsent: boolean;
  interactive: boolean;
  /** Chỉ buổi học: "Online" / "Offline · địa chỉ" (thiếu khi gia sư chưa chọn hình thức) và link học online (chỉ http/https, không có khi học trực tiếp hay buổi đã huỷ). */
  place?: string;
  joinUrl?: string;
}

/** Thứ Hai của tuần chứa `dateKey`. */
export function mondayOf(dateKey: string): string {
  return addDaysKey(dateKey, -((dayOfWeekOfKey(dateKey) + 6) % 7));
}
export function weekKeys(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i));
}

const isHttp = (s: string) => /^https?:/.test(s);

export function buildWeekItems(events: ScheduleEvent[], todo: StudentTodoItem[]): WeekItem[] {
  const out: WeekItem[] = [];
  for (const e of events) {
    const start = parseHm(e.time);
    if (start === null) continue;
    const cancelled = e.topic.startsWith("[ĐÃ HUỶ]");
    const topic = e.topic.replace(/^\[[^\]]+\]\s*/, "");
    const end = e.type === "class" ? parseHm(e.endTime) : null;
    if (e.type === "class") {
      out.push({ id: e.id, kind: "class", dateKey: e.isoDate, start, end, title: topic.split(" — ")[0], sub: topic.includes(" — ") ? topic.slice(topic.indexOf(" — ") + 3) : "",
        href: e.link ?? "/student/lich-hoc", external: false, cancelled, unsent: false, interactive: false,
        place: placeLabel(e.mode, e.location) ?? undefined, joinUrl: cancelled ? undefined : e.joinUrl });
    } else if (e.type === "exam") {
      out.push({ id: e.id, kind: "exam", dateKey: e.isoDate, start, end: null, title: topic, sub: e.meta ?? e.subject,
        href: e.link ?? `/student/thi-thu/${e.id.replace(/^exam-/, "")}`, external: !!e.link && isHttp(e.link), cancelled: false, unsent: false, interactive: false });
    } else {
      out.push({ id: e.id, kind: "deadline", dateKey: e.isoDate, start, end: null, title: topic, sub: e.subject,
        href: e.link ?? "/student/lich-hoc", external: !!e.link && isHttp(e.link), cancelled: false, unsent: false, interactive: false });
    }
  }
  // Hạn nộp bài tập trên KiN: lấy từ "Việc của tôi" (đã nộp thì thôi, không còn là hạn phải lo).
  for (const i of todo) {
    if (i.kind !== "bai-tap" || !i.task || i.task.phase !== "chua-nop") continue;
    const at = new Date(i.at);
    out.push({ id: i.id, kind: "task", dateKey: vnDateKeyOf(at), start: vnMinutesOfDay(at), end: null, title: i.task.name, sub: i.task.courseLine,
      href: i.task.href, external: false, cancelled: false, unsent: true, interactive: i.task.interactive });
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.start - b.start || a.id.localeCompare(b.id));
}

export const KIND_LABEL: Record<WeekKind, string> = { class: "Buổi học", exam: "Thi thử", deadline: "Hạn nộp", task: "Hạn nộp" };

/** Khoảng giờ vẽ trên lưới: ít nhất 08:00–21:00, nới ra cho vừa mọi mục trong tuần. */
export function gridHours(items: WeekItem[]): { from: number; to: number } {
  let from = 8, to = 21;
  for (const i of items) {
    from = Math.min(from, Math.floor(i.start / 60));
    to = Math.max(to, Math.ceil((i.end ?? i.start + 60) / 60));
  }
  return { from, to: Math.min(24, to) };
}

export { hmOf };
