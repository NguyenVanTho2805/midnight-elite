// QZ — hạn nộp RIÊNG cho từng học sinh. THUẦN (không Prisma, không React) để test được.
//
// Luật (một chỗ duy nhất, cả máy chủ lẫn giao diện cùng đọc):
//  • Hạn riêng KHÔNG đổi lịch chung của đề (Exam.date / time / duration / active). Không có dòng riêng = học sinh theo lịch chung như cũ.
//  • Có hạn riêng: học sinh không BẮT ĐẦU lượt mới sau `dueAt`. Lượt đang làm dở không bị cắt — vẫn theo hạn giờ làm bài của chính lượt đó.
//  • Giờ nhập và hiển thị là GIỜ VIỆT NAM (UTC+7), không phụ thuộc múi giờ máy chủ.
//  • Hạn phải ở TƯƠNG LAI lúc đặt (đặt hạn đã qua = khoá em đó ngay, dễ nhầm → từ chối; muốn khoá thì tắt đề), và không quá xa (1 năm).
import { instantOf, isValidDateKey, parseHm } from "@/lib/classSessions";

const pad = (n: number) => String(n).padStart(2, "0");
/** "25/10/2026 20:00" theo giờ Việt Nam (tính tay, không phụ thuộc ICU của máy chủ). */
export function fmtDue(d: Date): string {
  const v = new Date(d.getTime() + 7 * 3_600_000);
  return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
}

export const DEADLINE_MAX_DAYS = 366;
export const DEADLINE_NOTE_MAX = 200;
export const DEADLINE_MAX_STUDENTS = 200;

export type ParsedDue = { ok: true; value: Date } | { ok: false; error: string };

/** "2026-10-25" + "20:00" (giờ VN) → thời điểm UTC. Sai ngày / giờ / ở quá khứ / quá xa → lỗi tiếng Việt. */
export function parseDueAt(dateKey: unknown, time: unknown, now: Date): ParsedDue {
  if (typeof dateKey !== "string" || !isValidDateKey(dateKey)) return { ok: false, error: "Ngày hạn nộp chưa đúng." };
  const hm = typeof time === "string" ? parseHm(time) : null;
  if (hm === null) return { ok: false, error: "Giờ hạn nộp chưa đúng (dạng 20:00)." };
  const at = instantOf(dateKey, hm);
  if (at.getTime() <= now.getTime()) return { ok: false, error: "Hạn nộp phải ở tương lai. Muốn khoá hẳn quiz thì tắt đề." };
  if (at.getTime() - now.getTime() > DEADLINE_MAX_DAYS * 86_400_000) return { ok: false, error: "Hạn nộp quá xa (tối đa 1 năm)." };
  return { ok: true, value: at };
}

export function normalizeDeadlineNote(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Ghi chú không hợp lệ." };
  const v = raw.trim();
  if (v.length > DEADLINE_NOTE_MAX) return { ok: false, error: `Ghi chú tối đa ${DEADLINE_NOTE_MAX} ký tự.` };
  return { ok: true, value: v || null };
}

export type DeadlineState = "none" | "open" | "passed";
/** Trạng thái hạn riêng của một học sinh lúc `now`. `due` null = không có hạn riêng. Đúng mốc `due` = đã quá hạn. */
export function deadlineState(due: Date | null | undefined, now: Date): DeadlineState {
  if (!due) return "none";
  return due.getTime() > now.getTime() ? "open" : "passed";
}

/** Học sinh có được BẮT ĐẦU lượt mới không (xét riêng hạn riêng; các cổng khác — lớp, mật khẩu, số lượt — do route kiểm). `resuming` = đang có lượt làm dở. */
export function canStartByDeadline(due: Date | null | undefined, now: Date, resuming: boolean): boolean {
  if (resuming) return true;
  return deadlineState(due, now) !== "passed";
}

export const DEADLINE_PASSED_MESSAGE = "Hạn nộp riêng của em cho quiz này đã qua. Cần làm thêm thì hỏi gia sư.";

/** Chữ cho học sinh ở cổng vào đề: nói thật là hạn riêng, không bịa lịch chung. */
export function studentDeadlineText(due: Date | null | undefined, now: Date): string | null {
  const s = deadlineState(due, now);
  if (s === "none" || !due) return null;
  return s === "open" ? `Hạn nộp riêng của em: ${fmtDue(due)}` : `Hạn nộp riêng của em đã qua (${fmtDue(due)})`;
}

export interface DeadlineRow { userId: string; dueAt: string; note: string | null }
/** Nhãn một dòng ở màn gia sư. */
export function deadlineRowLabel(dueAt: Date, now: Date): string {
  return `${fmtDue(dueAt)}${deadlineState(dueAt, now) === "passed" ? " · đã qua" : ""}`;
}

/** Ghi vào nhật ký đề: KHÔNG tên học sinh, chỉ số lượng và hạn. */
export function deadlineLogNote(kind: "set" | "clear", count: number, dueAt?: Date): string {
  return kind === "set" ? `Đặt hạn nộp riêng cho ${count} học sinh: ${dueAt ? fmtDue(dueAt) : ""}` : `Bỏ hạn nộp riêng của ${count} học sinh`;
}
