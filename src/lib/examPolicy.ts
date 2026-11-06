// STU-001 — Chính sách HIỆU LỰC của một đề thi phía học sinh (thuần: không prisma, không React — test được bằng `npx tsx`).
//
// Vấn đề: đề thi thử công khai (không gắn lớp) để mặc định `answerVisibility = "after_submit"`, `hideAnswerForWrong = false`
// và không có dòng QuizAttemptLimit (= không giới hạn lượt) → học sinh nộp bừa, xem đáp án, thi lại, điểm cao nhất lên bảng xếp hạng.
//
// Phương án (b) đã chốt (docs/kin/phong-ban/dac-ta/STU-001.md §4.2):
//   • Đề công khai (`courseId === null`) CHỈ bị KiN ghi đè ("guarded") khi gia sư chưa đụng cài đặt nào trong ba
//     (after_submit && hideAnswerForWrong=false && không có limit hợp lệ). Khi đó: tối đa 2 lượt; hạn đề hợp lệ → đáp án hiện
//     sau khi đề hết hạn HOẶC khi em dùng hết lượt; hạn đề không hợp lệ → hiện ngay nhưng ẩn đáp án câu sai tới khi hết lượt.
//   • Gia sư đặt bất kỳ một trong ba → tôn trọng trọn bộ ba (kể cả không giới hạn lượt). Đề gắn lớp → luôn tôn trọng, không đổi hành vi.
//   • `answerVisibility` thô lạ (rác) → coi là "never" (an toàn hơn mở).
//
// Mọi mốc giờ là giờ máy chủ (ctx.now); không bao giờ đọc giờ từ trình duyệt. Hạn đề dựng theo +07:00 CỐ ĐỊNH, không theo TZ của tiến trình.

import { examStartInstant } from "@/lib/examData";
export type AnswerVisibility = "never" | "after_submit" | "after_exam_ends";
export type AnswersLockedReason = "until_exam_ends" | "until_attempts_exhausted" | "never" | null;
export const PUBLIC_DEFAULT_MAX_ATTEMPTS = 2;

export interface ExamPolicyInput {
  courseId: string | null;
  /** Chuỗi thô từ DB; giá trị lạ coi như "never". */
  answerVisibility: string;
  hideAnswerForWrong: boolean;
  date: string;
  time: string;
  duration: string;
}
export interface AttemptLimitInput { maxAttempts: number | null | undefined }

export interface PolicyContext {
  /** used >= maxAttempts hiệu lực VÀ không còn lượt đang làm (chưa quá expiresAt). Không đưa = false. Chỉ có tác dụng khi `guarded`. */
  attemptsExhausted?: boolean;
  /** Giờ máy chủ; mặc định new Date(). Test truyền vào để cố định. */
  now?: Date;
}

export interface EffectiveExamPolicy {
  isPublic: boolean;
  /** true = đề công khai, gia sư chưa đụng cài đặt nào → KiN áp mặc định an toàn. */
  guarded: boolean;
  answerVisibility: AnswerVisibility;
  hideAnswerForWrong: boolean;
  /** null = không giới hạn. */
  maxAttempts: number | null;
  /** Hạn đề hợp lệ không (date dd/mm/yyyy thật; time HH:mm hoặc rỗng → 00:00). */
  hasValidWindow: boolean;
  /** false khi !hasValidWindow. */
  windowEnded: boolean;
  /** Đáp án đúng/lời giải được trả ở review? (chưa tính giữ điểm examHold — resultVisibility thu hẹp sau). */
  canSeeAnswers: boolean;
  /** Khác null khi còn bất kỳ đáp án nào bị giấu (kể cả chỉ giấu câu sai). */
  answersLockedReason: AnswersLockedReason;
}

const VN_OFFSET_MINUTES = 7 * 60;

export function isPublicExam(exam: { courseId: string | null }): boolean {
  return exam.courseId === null;
}

/** Chuẩn hoá limit: số nguyên > 0 → số đó; 0/âm/NaN/null/undefined/không nguyên → null. */
export function normalizeMaxAttempts(limit?: AttemptLimitInput | null): number | null {
  const m = limit?.maxAttempts;
  return typeof m === "number" && Number.isInteger(m) && m > 0 ? m : null;
}

/** Gia sư đã đụng ít nhất một trong ba: answerVisibility !== "after_submit" || hideAnswerForWrong || limit có maxAttempts hợp lệ. */
export function tutorConfigured(exam: ExamPolicyInput, limit?: AttemptLimitInput | null): boolean {
  return exam.answerVisibility !== "after_submit" || exam.hideAnswerForWrong === true || normalizeMaxAttempts(limit) !== null;
}

/** Cùng quy tắc với examGrading.parseDurationMinutes (số đầu tiên trong chuỗi; không có → 60) — chép lại để tệp này không kéo prisma vào. */
function durationMinutes(duration: string): number {
  const m = (duration ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : 60;
}

/**
 * null nếu date không phải dd/mm/yyyy hợp lệ (kiểm round-trip ngày/tháng/năm, năm 4 chữ số) hoặc time không phải HH:mm (rỗng → 00:00).
 * Giờ dựng theo +07:00 cố định, không theo TZ tiến trình.
 */
export function parseExamWindow(exam: { date: string; time: string; duration: string }): { startsAt: Date; endsAt: Date } | null {
  const dm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((exam.date ?? "").trim());
  if (!dm) return null;
  const day = +dm[1], month = +dm[2], year = +dm[3];
  const timeRaw = (exam.time ?? "").trim();
  let hh = 0, mi = 0;
  if (timeRaw !== "") {
    const tm = /^(\d{1,2}):(\d{2})$/.exec(timeRaw);
    if (!tm) return null;
    hh = +tm[1]; mi = +tm[2];
    if (hh > 23 || mi > 59) return null;
  }
  // Round-trip qua UTC để bắt 31/02, tháng 13, ngày 00…
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  const startsAt = new Date(Date.UTC(year, month - 1, day, hh, mi) - VN_OFFSET_MINUTES * 60_000);
  const endsAt = new Date(startsAt.getTime() + durationMinutes(exam.duration) * 60_000);
  return { startsAt, endsAt };
}

/**
 * Bản sao đúng hành vi của examGrading.hasExamWindowEnded (kể cả lỗi của nó: date rỗng → 01/01/2000 → "đã hết hạn"; date rác → Invalid Date →
 * không bao giờ hết hạn; giờ +07:00 cố định). CHỈ dùng cho đề không guarded khi hạn không hợp lệ — để không hồi quy đề gắn lớp /
 * gia sư đã đặt `after_exam_ends`. Nợ §9 câu 4: đợt sau đổi hasExamWindowEnded sang parseExamWindow rồi bỏ hàm này.
 */
function legacyWindowEnded(exam: { date: string; time: string; duration: string }, now: Date): boolean {
  const startsAt = examStartInstant(exam.date, exam.time); // +07:00 cố định (trước đây theo TZ tiến trình)
  const endsAt = new Date(startsAt.getTime() + durationMinutes(exam.duration) * 60_000);
  return endsAt.getTime() <= now.getTime();
}

function normalizeVisibility(raw: string): AnswerVisibility {
  return raw === "after_submit" || raw === "after_exam_ends" || raw === "never" ? raw : "never";
}

export function effectiveExamPolicy(exam: ExamPolicyInput, limit?: AttemptLimitInput | null, ctx: PolicyContext = {}): EffectiveExamPolicy {
  const now = ctx.now ?? new Date();
  const isPublic = isPublicExam(exam);
  const win = parseExamWindow(exam);
  const hasValidWindow = win !== null;
  const windowEnded = win ? win.endsAt.getTime() <= now.getTime() : false;
  const guarded = isPublic && !tutorConfigured(exam, limit);

  if (!guarded) {
    // Dòng 1–2: tôn trọng trọn bộ cài đặt của gia sư (đề gắn lớp hoặc gia sư đã đặt). attemptsExhausted KHÔNG mở khoá.
    const av = normalizeVisibility(exam.answerVisibility);
    const canSeeAnswers =
      av === "after_submit" ? true :
      av === "after_exam_ends" ? (hasValidWindow ? windowEnded : legacyWindowEnded(exam, now)) :
      false;
    const answersLockedReason: AnswersLockedReason =
      av === "never" ? "never" :
      av === "after_exam_ends" && !canSeeAnswers ? "until_exam_ends" :
      null;
    return {
      isPublic, guarded: false, answerVisibility: av, hideAnswerForWrong: exam.hideAnswerForWrong === true,
      maxAttempts: normalizeMaxAttempts(limit), hasValidWindow, windowEnded, canSeeAnswers, answersLockedReason,
    };
  }

  const exhausted = ctx.attemptsExhausted === true;
  if (hasValidWindow) {
    // Dòng 3–5: đáp án hiện khi đề hết hạn hoặc em đã dùng hết lượt.
    const canSeeAnswers = windowEnded || exhausted;
    return {
      isPublic, guarded: true, answerVisibility: "after_exam_ends", hideAnswerForWrong: false,
      maxAttempts: PUBLIC_DEFAULT_MAX_ATTEMPTS, hasValidWindow, windowEnded, canSeeAnswers,
      answersLockedReason: canSeeAnswers ? null : "until_exam_ends",
    };
  }
  // Dòng 6–7: hạn đề không hợp lệ → không có mốc "hết hạn" để chờ; hiện ngay nhưng giấu đáp án câu sai tới khi hết lượt.
  return {
    isPublic, guarded: true, answerVisibility: "after_submit", hideAnswerForWrong: !exhausted,
    maxAttempts: PUBLIC_DEFAULT_MAX_ATTEMPTS, hasValidWindow: false, windowEnded: false, canSeeAnswers: true,
    answersLockedReason: exhausted ? null : "until_attempts_exhausted",
  };
}
