// BU-04 — khung giờ làm bài của đề MODE=test. THUẦN (không prisma, không next, không đọc đồng hồ ngầm: `now` luôn do người gọi truyền vào).
// Mốc giờ dựng bằng +07:00 tường minh (qua classSessions.instantOf) nên KHÔNG phụ thuộc múi giờ (TZ) của máy chủ.
// Khung = [mở, mở + thời lượng]. Không có cột đóng riêng (câu hỏi 1 của chủ, mặc định: không thêm).
// Hàm cũ examGrading.hasExamWindowEnded / examData.computeExamStatus dùng múi giờ máy chủ — CHƯA đổi (nợ COO 02/11, chờ chủ quyết); mã mới dùng tệp này.
import { instantOf, isValidDateKey, parseHm } from "@/lib/classSessions";

const DMY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** "05/11/2026" → "2026-11-05"; sai định dạng / ngày không tồn tại → null. */
export function dateKeyFromDmy(dmy: string | null | undefined): string | null {
  const m = DMY_RE.exec((dmy ?? "").trim());
  if (!m) return null;
  const key = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isValidDateKey(key) ? key : null;
}

/** "90 phút" → 90; không đọc được → 60 (cùng quy ước examGrading.parseDurationMinutes). */
export function durationMinutesOf(duration: string | null | undefined): number {
  const m = (duration ?? "").match(/\d+/);
  const n = m ? parseInt(m[0], 10) : 60;
  return n > 0 ? n : 60;
}

/** Giờ mở bài dạng thời điểm tuyệt đối (+07:00). Ngày/giờ sai → null. */
export function parseExamOpenAt(date: string | null | undefined, time: string | null | undefined): Date | null {
  const key = dateKeyFromDmy(date);
  const hm = parseHm(time);
  if (key === null || hm === null) return null;
  return instantOf(key, hm);
}

export interface WindowSource { date: string; time: string; duration: string }
export interface ExamWindow { opensAt: Date | null; closesAt: Date | null }

export function examWindowOf(exam: WindowSource): ExamWindow {
  const opensAt = parseExamOpenAt(exam.date, exam.time);
  if (!opensAt) return { opensAt: null, closesAt: null };
  return { opensAt, closesAt: new Date(opensAt.getTime() + durationMinutesOf(exam.duration) * 60_000) };
}

export type StartVerdict = "ok" | "not_open" | "closed";
/**
 * Có được BẮT ĐẦU lượt mới lúc `now` không (chỉ dùng cho mode=test). Đúng giờ mở = ok; đúng giờ đóng = closed.
 * Khung không đọc được (ngày/giờ hỏng) → "ok": không khoá học sinh vì dữ liệu hỏng; gia sư sẽ thấy ở màn giao đề.
 */
export function startVerdict(exam: WindowSource, now: Date): StartVerdict {
  const w = examWindowOf(exam);
  if (!w.opensAt || !w.closesAt) return "ok";
  if (now.getTime() < w.opensAt.getTime()) return "not_open";
  if (now.getTime() >= w.closesAt.getTime()) return "closed";
  return "ok";
}

export type WindowStateName = "none" | "not_open" | "open" | "closed";
/** Trạng thái hiện trên cổng vào đề. "none" khi không phải mode=test hoặc khung không đọc được. */
export function windowState(mode: string | null | undefined, exam: WindowSource, now: Date): WindowStateName {
  if (mode !== "test") return "none";
  const w = examWindowOf(exam);
  if (!w.opensAt) return "none";
  const v = startVerdict(exam, now);
  return v === "ok" ? "open" : v;
}

/**
 * Hạn của lượt: min(bắt đầu + thời lượng, cuối khung). Không bao giờ trước `startedAt` (không âm).
 * `windowClosesAt` null → chỉ theo thời lượng.
 */
export function clampExpiresAt(startedAt: Date, durationMin: number, windowClosesAt: Date | null): Date {
  const byDuration = startedAt.getTime() + Math.max(0, durationMin) * 60_000;
  const capped = windowClosesAt ? Math.min(byDuration, windowClosesAt.getTime()) : byDuration;
  return new Date(Math.max(startedAt.getTime(), capped));
}

/** Lúc đáp án mở khi `after_exam_ends` (= cuối khung); các chế độ khác → null (mở ngay hoặc không bao giờ). */
export function answersOpenAtOf(answerVisibility: string, exam: WindowSource): Date | null {
  if (answerVisibility !== "after_exam_ends") return null;
  return examWindowOf(exam).closesAt;
}
