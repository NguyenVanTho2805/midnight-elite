// KiN Pro F4 — THỐNG KÊ CHUYÊN CẦN NÂNG CAO (giai đoạn 1). Thuần (không Prisma) để test; truy vấn ở attendanceInsightsServer.ts.
//
// Chỉ TRÌNH BÀY điểm danh có sẵn, KHÔNG công thức mới:
//  • Chuyên cần = computeAttendanceStats (attendance.ts) trên các bản ghi có trạng thái hợp lệ: hệ số 1 / 0,9 / 0,8 / 0,5, làm tròn % như bảng điểm danh tháng (attendanceExport.ts).
//  • Ô trống = CHƯA điểm danh, khác vắng (GD-06): không có bản ghi thì không đếm vào mẫu số và cắt chuỗi vắng.
//  • Dưới MIN_SAMPLE bản ghi thì KHÔNG có phần trăm ("chưa đủ dữ liệu", như healthMetrics.ts).
//  • KHÔNG dùng điểm danh để tính tiền (quyết định 27/09).
// Dữ liệu trẻ: xu hướng và so sánh lớp chỉ là tổng hợp theo lớp; chỉ `absenceStreaks` có tên em, và hàm gọi nó chỉ nạp lớp của đúng gia sư chủ lớp.
import { computeAttendanceStats, isAttendanceStatus } from "@/lib/attendance";
import { addDaysKey, isValidDateKey, weekRangeOf } from "@/lib/classSessions";

export const INSIGHT_MIN_SAMPLE = 10;
/** Từ bấy nhiêu buổi vắng liên tiếp thì báo. */
export const STREAK_MIN = 3;
export const WEEKS_SHOWN = 8;
export const MONTHS_SHOWN = 6;
/** Cửa sổ so sánh lớp: 90 ngày gần nhất (giờ VN). */
export const COMPARE_DAYS = 90;

export interface InsSession { id: string; courseId: string; dateKey: string }
export interface InsRecord { sessionId: string; userId: string; status: string }
export interface InsStudent { id: string; name: string; courseId: string; enrolledKey: string; active: boolean }
export interface InsCourse { id: string; name: string }

export interface TrendPoint {
  key: string; // tuần: ngày thứ Hai (YYYY-MM-DD); tháng: YYYY-MM
  label: string;
  /** Số bản ghi điểm danh có trạng thái hợp lệ (mẫu số). */
  n: number;
  /** % chuyên cần (làm tròn), hoặc null nếu n < INSIGHT_MIN_SAMPLE. */
  rate: number | null;
}

export const pct = (ratio: number | null): number | null => (ratio === null ? null : Math.round(ratio * 100));

/** Chuyên cần của một tập bản ghi: null nếu dưới mẫu tối thiểu. */
export function rateOf(records: { status: string }[]): { n: number; rate: number | null } {
  const st = computeAttendanceStats(records);
  return { n: st.total, rate: st.total >= INSIGHT_MIN_SAMPLE ? pct(st.ratio) : null };
}

const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
export const monthKeyOf = (dateKey: string) => dateKey.slice(0, 7);
export const weekKeyOf = (dateKey: string) => weekRangeOf(dateKey).from;

/** `count` mốc tuần kết thúc ở tuần chứa `todayKey`, cũ → mới. */
export function lastWeekKeys(todayKey: string, count = WEEKS_SHOWN): string[] {
  const end = weekKeyOf(todayKey);
  return Array.from({ length: count }, (_, i) => addDaysKey(end, -7 * (count - 1 - i)));
}
/** `count` tháng kết thúc ở tháng chứa `todayKey`, cũ → mới. */
export function lastMonthKeys(todayKey: string, count = MONTHS_SHOWN): string[] {
  let y = Number(todayKey.slice(0, 4)), m = Number(todayKey.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < count; i++) { out.unshift(`${y}-${String(m).padStart(2, "0")}`); m -= 1; if (m === 0) { m = 12; y -= 1; } }
  return out;
}

/** Xu hướng chuyên cần của TOÀN BỘ các lớp được truyền vào, gộp theo tuần hoặc tháng. Bản ghi của buổi ngoài các mốc bị bỏ. */
export function trendBy(unit: "week" | "month", keys: string[], sessions: InsSession[], records: InsRecord[]): TrendPoint[] {
  const bucketOfSession = new Map<string, string>();
  for (const s of sessions) if (isValidDateKey(s.dateKey)) bucketOfSession.set(s.id, unit === "week" ? weekKeyOf(s.dateKey) : monthKeyOf(s.dateKey));
  const buckets = new Map<string, { status: string }[]>(keys.map(k => [k, []]));
  for (const r of records) {
    const b = bucketOfSession.get(r.sessionId);
    if (b === undefined || !isAttendanceStatus(r.status)) continue;
    buckets.get(b)?.push({ status: r.status });
  }
  return keys.map(k => {
    const { n, rate } = rateOf(buckets.get(k) ?? []);
    return { key: k, label: unit === "week" ? `Tuần ${ddmm(k)}` : `Tháng ${k.slice(5, 7)}/${k.slice(0, 4)}`, n, rate };
  });
}

export interface AbsenceStreak { studentId: string; name: string; courseId: string; courseName: string; streak: number; lastAbsentKey: string }

/**
 * Em vắng LIÊN TIẾP ≥ `min` buổi gần nhất của lớp mình. "Vắng" = absent hoặc excused (đều là không có mặt; nghỉ có phép vẫn đáng để gia sư biết). Muộn là có mặt.
 * Đi từ buổi mới nhất lùi về: buổi trước ngày ghi danh bỏ qua; buổi CHƯA điểm danh em đó (ô trống) hoặc có mặt/muộn thì dừng đếm.
 * Chỉ tính em đang học (`active`).
 */
export function absenceStreaks(students: InsStudent[], courses: InsCourse[], sessions: InsSession[], records: InsRecord[], min = STREAK_MIN): AbsenceStreak[] {
  const statusAt = new Map<string, string>();
  for (const r of records) statusAt.set(`${r.sessionId}|${r.userId}`, r.status);
  const byCourse = new Map<string, InsSession[]>();
  for (const s of sessions) { const a = byCourse.get(s.courseId) ?? []; a.push(s); byCourse.set(s.courseId, a); }
  for (const a of byCourse.values()) a.sort((x, y) => y.dateKey.localeCompare(x.dateKey) || y.id.localeCompare(x.id));
  const courseName = new Map(courses.map(c => [c.id, c.name]));

  const out: AbsenceStreak[] = [];
  for (const st of students) {
    if (!st.active) continue;
    let streak = 0, last = "";
    for (const sess of byCourse.get(st.courseId) ?? []) {
      if (sess.dateKey < st.enrolledKey) break; // các buổi cũ hơn nữa em chưa thuộc lớp
      const s = statusAt.get(`${sess.id}|${st.id}`);
      if (s === "absent" || s === "excused") { streak += 1; if (!last) last = sess.dateKey; } else break;
    }
    if (streak >= min) out.push({ studentId: st.id, name: st.name, courseId: st.courseId, courseName: courseName.get(st.courseId) ?? "Lớp", streak, lastAbsentKey: last });
  }
  return out.sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name, "vi") || a.studentId.localeCompare(b.studentId));
}

export interface ClassCompareRow { courseId: string; name: string; students: number; sessions: number; n: number; rate: number | null }

/** So sánh lớp trong khoảng [fromKey, toKey] (gồm cả hai đầu): chuyên cần theo hệ số, kèm số bản ghi để người đọc biết mẫu lớn hay nhỏ. Xếp cao → thấp, lớp thiếu mẫu cuối. */
export function compareClasses(courses: InsCourse[], studentsByCourse: Map<string, number>, sessions: InsSession[], records: InsRecord[], fromKey: string, toKey: string): ClassCompareRow[] {
  const inWin = sessions.filter(s => s.dateKey >= fromKey && s.dateKey <= toKey);
  const courseOfSession = new Map(inWin.map(s => [s.id, s.courseId]));
  const sessionsOf = new Map<string, number>();
  for (const s of inWin) sessionsOf.set(s.courseId, (sessionsOf.get(s.courseId) ?? 0) + 1);
  const recs = new Map<string, { status: string }[]>();
  for (const r of records) {
    const c = courseOfSession.get(r.sessionId);
    if (c === undefined || !isAttendanceStatus(r.status)) continue;
    const a = recs.get(c) ?? []; a.push({ status: r.status }); recs.set(c, a);
  }
  return courses.map(c => {
    const { n, rate } = rateOf(recs.get(c.id) ?? []);
    return { courseId: c.id, name: c.name, students: studentsByCourse.get(c.id) ?? 0, sessions: sessionsOf.get(c.id) ?? 0, n, rate };
  }).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.name.localeCompare(b.name, "vi") || a.courseId.localeCompare(b.courseId));
}
