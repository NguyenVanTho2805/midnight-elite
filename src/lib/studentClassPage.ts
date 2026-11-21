// SCL-G-HS (QUYET-DINH-GIAO-DIEN §2.1, §3.3, §3.4, §3.9): chữ và cách xếp của các màn học sinh (trang lớp, Cần làm, Điểm, Tất cả bài học).
// THUẦN: không React, không Prisma. Ngày giờ luôn theo giờ Việt Nam (hàm của classSessions). Test: tools/local-e2e/t-scl-g-hs-lib.ts.
import { addDaysKey, dayOfWeekOfKey, hmOf, instantOf, parseHm, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";
import type { StudentTodoItem } from "@/lib/studentTodo";
import type { ScheduleEvent } from "@/lib/studentSchedule";

const WEEKDAY = ["Chủ nhật", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy"];
const H = 3_600_000, D = 24 * H;
const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const valid = (d: Date) => !Number.isNaN(d.getTime());

/** "thứ Ba 24/11, 21:00" theo giờ VN. */
export function vnDayTime(at: Date): string {
  const k = vnDateKeyOf(at);
  return `${WEEKDAY[dayOfWeekOfKey(k)]} ${dm(k)}, ${hmOf(vnMinutesOfDay(at))}`;
}
/** "Thứ Ba 17/11" (không giờ) — ngày của một bài trong "Buổi gần đây". */
export function vnDayLabel(at: Date): string {
  const k = vnDateKeyOf(at);
  return cap(`${WEEKDAY[dayOfWeekOfKey(k)]} ${dm(k)}`);
}

/** Số ngày lịch (VN) từ hôm nay tới ngày của `at`; âm = đã qua. */
export function daysUntil(at: Date, now: Date): number {
  return Math.round((Date.parse(`${vnDateKeyOf(at)}T00:00:00Z`) - Date.parse(`${vnDateKeyOf(now)}T00:00:00Z`)) / D);
}

/** Nhãn hạn của thẻ Cần làm: "Hạn thứ Ba 24/11, 21:00 · còn 3 ngày" / "· hôm nay" / "Quá hạn từ thứ Năm 19/11, 21:00". `open` = kiểm tra ("Mở lúc …"). */
export function deadlineLine(dueIso: string, now: Date, open = false): string {
  const due = new Date(dueIso);
  if (!valid(due)) return "";
  if (!open && due.getTime() < now.getTime()) return `Quá hạn từ ${vnDayTime(due)}`;
  const n = daysUntil(due, now);
  const left = n <= 0 ? "hôm nay" : n === 1 ? "ngày mai" : `còn ${n} ngày`;
  if (open) { const k = vnDateKeyOf(due); return `Mở lúc ${hmOf(vnMinutesOfDay(due))} ${WEEKDAY[dayOfWeekOfKey(k)]} ${dm(k)} · ${left}`; }
  return `Hạn ${vnDayTime(due)} · ${left}`;
}

/** Dòng ngày của một hàng ở màn Điểm (§4.1 #5): đã chấm ⇒ "Chấm thứ Bảy 14/11"; đã nộp ⇒ "Nộp thứ Sáu 20/11"; thiếu ngày ⇒ "". */
export function resultDateLine(r: { state: string; submittedAt?: string | null; gradedAt?: string | null }): string {
  for (const [verb, iso] of [["Chấm", r.state === "da-cham" ? r.gradedAt : null], ["Nộp", r.submittedAt]] as const) {
    const t = iso ? new Date(iso) : null;
    if (t && valid(t)) { const k = vnDateKeyOf(t); return `${verb} ${WEEKDAY[dayOfWeekOfKey(k)]} ${dm(k)}`; }
  }
  return "";
}

/** "Đã nộp lúc 20:41 thứ Sáu 20/11". */
export function submittedLine(iso: string): string {
  const t = new Date(iso);
  if (!valid(t)) return "Đã nộp";
  const k = vnDateKeyOf(t);
  return `Đã nộp lúc ${hmOf(vnMinutesOfDay(t))} ${WEEKDAY[dayOfWeekOfKey(k)]} ${dm(k)}`;
}

export type TodoBucket = "qua-han" | "tuan-nay" | "tuan-sau" | "sau";
export const BUCKET_TITLE: Record<TodoBucket, string> = { "qua-han": "Quá hạn", "tuan-nay": "Tuần này", "tuan-sau": "Tuần sau", sau: "Sau đó" };
/** Nhóm của màn Cần làm theo tuần lịch VN (thứ Hai → Chủ nhật). Đã quá hạn (theo giờ, không theo ngày) luôn là "qua-han". */
export function todoBucket(dueIso: string, now: Date): TodoBucket {
  const due = new Date(dueIso);
  if (!valid(due) || due.getTime() < now.getTime()) return "qua-han";
  const today = vnDateKeyOf(now);
  const monday = addDaysKey(today, -((dayOfWeekOfKey(today) + 6) % 7));
  const k = vnDateKeyOf(due);
  return k <= addDaysKey(monday, 6) ? "tuan-nay" : k <= addDaysKey(monday, 13) ? "tuan-sau" : "sau";
}

/** Dòng lịch ở đầu trang lớp, từ các buổi sắp tới của lớp: "Thứ Ba, thứ Năm, 19:00" (cùng giờ) / "Thứ Ba 19:00, thứ Năm 17:30". Không có buổi ⇒ "". */
export function scheduleLine(events: { isoDate: string; time: string }[]): string {
  const byDay = new Map<number, string>();
  for (const e of [...events].sort((a, b) => a.isoDate.localeCompare(b.isoDate))) {
    const d = dayOfWeekOfKey(e.isoDate);
    if (!byDay.has(d)) byDay.set(d, e.time);
  }
  if (byDay.size === 0) return "";
  const days = [...byDay.keys()].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // thứ Hai đứng đầu, Chủ nhật cuối
  const times = new Set(byDay.values());
  const s = times.size === 1 ? `${days.map(d => WEEKDAY[d]).join(", ")}, ${[...times][0]}` : days.map(d => `${WEEKDAY[d]} ${byDay.get(d)}`).join(", ");
  return cap(s);
}

/** Ngày đại diện của một bài: ngày học (scheduledAt) nếu có, không thì ngày tạo. */
export function lessonDate(l: { scheduledAt?: string | null; createdAt?: string | null }): Date | null {
  for (const v of [l.scheduledAt, l.createdAt]) { if (v) { const d = new Date(v); if (valid(d)) return d; } }
  return null;
}
/** "Buổi gần đây": bài mới nhất trước (theo lessonDate), bài không có ngày xuống cuối, hoà thì giữ thứ tự giáo trình. */
export function newestFirst<T extends { scheduledAt?: string | null; createdAt?: string | null }>(lessons: T[]): T[] {
  return lessons.map((l, i) => ({ l, i, t: lessonDate(l)?.getTime() ?? -Infinity })).sort((a, b) => b.t - a.t || a.i - b.i).map(x => x.l);
}

/** Bỏ dấu tiếng Việt + chữ thường, để ô tìm bài khớp cả khi gõ không dấu. */
export const foldVi = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
export const matchesQuery = (title: string, q: string) => !foldVi(q) || foldVi(title).includes(foldVi(q));

/** Điểm quy về thang 10, một chữ số thập phân, dấu phẩy: (17, 20) ⇒ "8,5". */
export function on10(score: number, max: number): string {
  const v = max > 0 ? (score / max) * 10 : score;
  return String(Math.round(v * 10) / 10).replace(".", ",");
}
/** Trung bình thang 10 của các bài ĐÃ CHẤM (chờ duyệt không tính); không bài nào ⇒ null. */
export function average10(items: { state: string; score: number | null; max: number }[]): string | null {
  const done = items.filter(i => i.state === "da-cham" && i.score !== null && i.max > 0);
  if (!done.length) return null;
  const v = done.reduce((s, i) => s + (i.score as number) / i.max * 10, 0) / done.length;
  return String(Math.round(v * 10) / 10).replace(".", ",");
}

// ── Thẻ Cần làm: gom bài tập chưa nộp (việc của tôi), hạn nộp ngoài KiN và kiểm tra sắp mở (lịch) thành một danh sách xếp theo hạn ──
export interface TodoCard {
  key: string;
  kind: "bai-tap" | "kiem-tra";
  title: string;
  dueIso: string;
  tone: "qua-han" | "cho" | "mo";
  courseId?: string;
  courseName: string;
  /** "nop" = nộp tệp ngay trong thẻ; "lam" = làm trên web (link bài); "ngoai" = hạn nộp ngoài KiN (Azota); "thi" = kiểm tra. */
  action: { type: "nop"; assignmentId: string; href: string } | { type: "lam"; href: string } | { type: "ngoai"; href: string } | { type: "thi"; event: ScheduleEvent };
  /** Đúng một thẻ mỗi màn mang nút chính: bài tập có hạn gần nhất (kiểm tra luôn nút phụ). */
  primary: boolean;
}

/**
 * `courseName(id)` tra tên lớp; `only` = chỉ việc của một lớp (trang lớp: so theo id, riêng hạn ngoài KiN so theo tên lớp vì lịch chỉ ghi tên).
 * Bài tập lấy từ `items` (máy chủ đã bỏ bài quá hạn > 14 ngày); hạn ngoài + kiểm tra lấy từ `events` (90 ngày tới), bỏ mục đã qua giờ.
 */
export function buildTodoCards(items: StudentTodoItem[], events: ScheduleEvent[], now: Date, courseName: (id: string) => string, only?: { id: string; name: string }): TodoCard[] {
  const out: TodoCard[] = [];
  for (const i of items) {
    const t = i.task;
    if (i.kind !== "bai-tap" || !t || t.phase !== "chua-nop" || i.done) continue;
    if (only && t.courseId !== only.id) continue;
    const assignmentId = i.id.slice("bai-tap:".length);
    out.push({
      key: i.id, kind: "bai-tap", title: t.name, dueIso: i.at, tone: Date.parse(i.at) < now.getTime() ? "qua-han" : "cho",
      courseId: t.courseId, courseName: (t.courseId && courseName(t.courseId)) || t.courseLine.split(" · ")[0],
      action: t.interactive ? { type: "lam", href: t.href } : { type: "nop", assignmentId, href: t.href }, primary: false,
    });
  }
  for (const e of events) {
    if (e.type !== "deadline" && e.type !== "exam") continue;
    const m = parseHm(e.time);
    if (m === null) continue;
    const at = instantOf(e.isoDate, m);
    if (at.getTime() < now.getTime()) continue;
    if (only && (e.type === "exam" ? e.courseId !== only.id : e.subject !== only.name)) continue;
    if (e.type === "deadline") {
      if (!e.link) continue; // không có đường nộp thì không có gì để bấm
      out.push({ key: e.id, kind: "bai-tap", title: e.topic, dueIso: at.toISOString(), tone: "cho", courseName: e.subject, action: { type: "ngoai", href: e.link }, primary: false });
    } else {
      out.push({ key: e.id, kind: "kiem-tra", title: e.topic, dueIso: at.toISOString(), tone: "mo", courseId: e.courseId, courseName: (e.courseId && courseName(e.courseId)) || e.subject, action: { type: "thi", event: e }, primary: false });
    }
  }
  out.sort((a, b) => a.dueIso.localeCompare(b.dueIso) || a.key.localeCompare(b.key));
  const first = out.find(c => c.kind === "bai-tap");
  if (first) first.primary = true;
  return out;
}
