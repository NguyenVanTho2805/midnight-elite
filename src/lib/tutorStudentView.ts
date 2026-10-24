// Hồ sơ học sinh của gia sư, phần TRÌNH BÀY (HS-01, HS-02, HS-06, HS-08, HS-09, DD-07, LO-03, LO-13). Hàm THUẦN: không Prisma, không giờ hệ thống ẩn.
// Test: tools/local-e2e/t-tutor-student-view-lib.ts. Phần chạm DB: tutorStudentsServer.ts / tutorStudentDetailServer.ts.
//
// Không có công thức mới: chuyên cần dùng computeAttendanceStats (qua rateOf), chuỗi vắng dùng cùng định nghĩa với attendanceInsights.absenceStreaks
// (vắng = absent hoặc excused, ô trống hoặc có mặt/muộn thì dừng), tiền chỉ đọc số phiếu đã có.
import { addDaysKey, dayOfWeekOfKey, expandOccurrences, isValidDateKey } from "@/lib/classSessions";
import { STREAK_MIN, rateOf } from "@/lib/attendanceInsights";
import { isAttendanceStatus } from "@/lib/attendance";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";

/** Số ngày nhìn lại cho tỷ lệ tham dự trong hồ sơ (DD-07). */
export const ATTENDANCE_WINDOW_DAYS = 90;

// ─── Cảnh báo ở danh sách (HS-01) ────────────────────────────────────────────────
export type StudentAlert = "unpaid" | "absent_streak" | "makeup";
export const ALERT_LABEL: Record<StudentAlert, string> = { unpaid: "Còn phiếu chưa đóng đủ", absent_streak: "Vắng liên tiếp", makeup: "Còn buổi bù" };

/** Trạng thái link báo cáo riêng: on = có link đang chạy; off = có phụ huynh liên kết nhưng chưa bật; no_parent = chưa có phụ huynh liên kết trên KiN. */
export type ReportLinkState = "on" | "off" | "no_parent";
export const REPORT_LINK_LABEL: Record<ReportLinkState, string> = { on: "Đang bật", off: "Chưa bật", no_parent: "Chưa có phụ huynh liên kết" };

export interface ParentLinkLite { status: string; portalToken: string | null }

/** Cùng dạng với parentPortal.isValidPortalToken (32 ký tự hex). Chép lại để tệp này vào được gói trình duyệt (parentPortal kéo node:crypto). */
const validToken = (s: unknown): boolean => typeof s === "string" && /^[0-9a-f]{32}$/.test(s);

/** Gộp các liên kết phụ huynh của một em. Chỉ liên kết "verified" mới tính; token sai dạng coi như không có. */
export function reportLinkOf(links: readonly ParentLinkLite[]): ReportLinkState {
  const ok = links.filter(l => l.status === "verified");
  if (!ok.length) return "no_parent";
  return ok.some(l => validToken(l.portalToken)) ? "on" : "off";
}

/** Đường dẫn trang Sổ của con theo token. Token ngẫu nhiên 128 bit: KHÔNG có tên hay mã em trong đường dẫn. */
export const reportPath = (token: string): string => `/so-cua-con/${token}`;

export interface StudentSignals {
  userId: string;
  unpaidCount: number;
  absentStreak: number;
  makeupLeft: number;
  reportLink: ReportLinkState;
}

export function alertsOf(s: Pick<StudentSignals, "unpaidCount" | "absentStreak" | "makeupLeft">): StudentAlert[] {
  const out: StudentAlert[] = [];
  if (s.unpaidCount > 0) out.push("unpaid");
  if (s.absentStreak >= STREAK_MIN) out.push("absent_streak");
  if (s.makeupLeft > 0) out.push("makeup");
  return out;
}

export type StatusFilter = "active" | "suspended";
export interface StudentFilter { status: StatusFilter; courseId: string; alert: StudentAlert | ""; q: string }
export interface FilterableRow { userId: string; name: string; email: string; phone: string | null; school: string | null; courseId: string; status: "active" | "suspended" }

/** Lọc danh sách học sinh theo trạng thái, lớp, cảnh báo, từ khoá. Em chưa có tín hiệu (map thiếu) KHÔNG có cảnh báo nào. */
export function filterStudents<R extends FilterableRow>(rows: readonly R[], signals: ReadonlyMap<string, StudentSignals>, f: StudentFilter): R[] {
  const needle = f.q.trim().toLowerCase();
  return rows.filter(r => {
    if (r.status !== f.status) return false;
    if (f.courseId && r.courseId !== f.courseId) return false;
    if (f.alert) { const s = signals.get(r.userId); if (!s || !alertsOf(s).includes(f.alert)) return false; }
    if (needle && ![r.name, r.email, r.phone ?? "", r.school ?? ""].some(v => v.toLowerCase().includes(needle))) return false;
    return true;
  });
}

// ─── Đổi trạng thái học (HS-06) ──────────────────────────────────────────────────
export type SettableStatus = "active" | "suspended";
export const isSettableStatus = (v: unknown): v is SettableStatus => v === "active" || v === "suspended";
/**
 * Đánh dấu "Đã nghỉ" (suspended) hoặc cho học lại (active). Dữ liệu giữ nguyên, không xoá gì.
 * "pending_consent" KHÔNG đổi được ở đây: đó là chờ phụ huynh đồng ý, gia sư không được tự bật.
 */
export function checkStatusChange(from: string, to: SettableStatus): { ok: true; noop: boolean } | { ok: false; error: string } {
  if (from === ENROLLMENT_STATUS.PENDING_CONSENT) return { ok: false, error: "Em đang chờ phụ huynh đồng ý nên chưa đổi được trạng thái học." };
  if (from !== ENROLLMENT_STATUS.ACTIVE && from !== ENROLLMENT_STATUS.SUSPENDED) return { ok: false, error: "Trạng thái học hiện tại không hợp lệ." };
  return { ok: true, noop: from === to };
}

// ─── Chuỗi vắng của một em ở một lớp (HS-01) ────────────────────────────────────
/** `statusesNewestFirst`: trạng thái điểm danh của em ở các buổi của lớp, mới → cũ; `undefined` = ô trống (chưa điểm danh). */
export function absenceStreakOf(statusesNewestFirst: readonly (string | undefined)[]): number {
  let n = 0;
  for (const s of statusesNewestFirst) { if (s === "absent" || s === "excused") n++; else break; }
  return n;
}

// ─── Điểm danh 90 ngày (DD-07) và lịch sử buổi đã học (HS-08) ───────────────────
export interface AttRow { dateKey: string; status: string; courseName: string }

export interface AttendanceWindow {
  fromKey: string; toKey: string; days: number;
  /** Số bản ghi có trạng thái hợp lệ (mẫu số). */
  n: number;
  /** % chuyên cần (hệ số 1 / 0,9 / 0,8 / 0,5), null nếu n dưới mẫu tối thiểu: "chưa đủ dữ liệu". */
  rate: number | null;
  counts: Record<"present" | "late" | "excused" | "absent", number>;
  rows: AttRow[];
}

/** Bản ghi điểm danh nằm trong `days` ngày gần nhất tính đến `todayKey` (gồm cả hai đầu), mới → cũ. Ngày tương lai bị cắt. */
export function attendanceWindow(rows: readonly AttRow[], todayKey: string, days = ATTENDANCE_WINDOW_DAYS): AttendanceWindow {
  if (!isValidDateKey(todayKey)) throw new Error(`todayKey không hợp lệ: ${todayKey}`);
  const fromKey = addDaysKey(todayKey, -(days - 1));
  const inWin = rows.filter(r => isValidDateKey(r.dateKey) && r.dateKey >= fromKey && r.dateKey <= todayKey && isAttendanceStatus(r.status))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || a.courseName.localeCompare(b.courseName, "vi"));
  const counts = { present: 0, late: 0, excused: 0, absent: 0 };
  for (const r of inWin) counts[r.status as keyof typeof counts]++;
  const { n, rate } = rateOf(inWin);
  return { fromKey, toKey: todayKey, days, n, rate, counts, rows: inWin };
}

/** Buổi ĐÃ HỌC = em có mặt hoặc đi muộn (cùng nghĩa với "buổi đã dạy" của taughtSessions). Mới → cũ. */
export function learnedSessions(rows: readonly AttRow[], todayKey: string): AttRow[] {
  return rows.filter(r => (r.status === "present" || r.status === "late") && r.dateKey <= todayKey).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

// ─── Wizard tạo lớp (LO-03) ─────────────────────────────────────────────────────
export const WIZARD_WEEKS_MIN = 1;
export const WIZARD_WEEKS_MAX = 8;
export interface WizardSlot { dayOfWeek: number; startTime: string; endTime: string }

/** Số buổi lịch lặp sinh ra trong `weeks` tuần kể từ `firstKey` (gồm ngày đó). Chỉ để HIỂN THỊ trên nút; buổi thật do lịch tuần sinh ra, không ghi thêm bản ghi nào. */
export function previewSessionCount(slots: readonly WizardSlot[], firstKey: string, weeks: number): number {
  if (!isValidDateKey(firstKey) || !slots.length) return 0;
  const w = Math.min(WIZARD_WEEKS_MAX, Math.max(WIZARD_WEEKS_MIN, Math.floor(weeks) || WIZARD_WEEKS_MIN));
  const toKey = addDaysKey(firstKey, w * 7 - 1);
  return expandOccurrences(slots.map((s, i) => ({ id: `s${i}`, courseId: "x", ...s })), firstKey, toKey).length;
}

export function createButtonLabel(n: number): string { return n > 0 ? `Tạo lớp + ${n} buổi` : "Tạo lớp"; }

/** Kiểm các khung giờ của wizard. Trả lỗi tiếng Việt đầu tiên hoặc null. */
export function validateSlots(slots: readonly WizardSlot[]): string | null {
  const seen = new Set<string>();
  for (const s of slots) {
    if (!Number.isInteger(s.dayOfWeek) || s.dayOfWeek < 0 || s.dayOfWeek > 6) return "Ngày trong tuần không hợp lệ.";
    if (!/^\d{2}:\d{2}$/.test(s.startTime) || !/^\d{2}:\d{2}$/.test(s.endTime)) return "Giờ học chưa đúng định dạng.";
    if (s.endTime <= s.startTime) return "Giờ kết thúc phải sau giờ bắt đầu.";
    const k = `${s.dayOfWeek}|${s.startTime}|${s.endTime}`;
    if (seen.has(k)) return "Có hai khung giờ trùng nhau.";
    seen.add(k);
  }
  return null;
}

export const WEEKDAY_LABEL = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"] as const;
export const weekdayOfKey = (key: string): string => WEEKDAY_LABEL[dayOfWeekOfKey(key)];

/** Tối đa bao nhiêu em thêm một lượt vào lớp (LO-09). */
export const ADD_STUDENTS_MAX = 50;
