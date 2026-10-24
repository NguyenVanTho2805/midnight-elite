// QZ-08 / QZ-06: quy tắc THUẦN cho chấm quiz hỗn hợp, công bố và phân tích kết quả (không DB; phần chạm DB ở quizGradeServer.ts).
// Mọi số hiển thị cho gia sư (điểm tự luận, số bài chờ chấm, tỉ lệ đúng từng câu, phân bố điểm) đi qua đây, để một công thức duy nhất
// vừa dùng ở trang vừa được test so khớp với truy vấn gốc.
import { shortAnswerCorrect } from "@/lib/examCorrection";

/** Câu tự luận của một lượt: có dòng trả lời, có chữ thật, và gia sư chưa chấm (null ≠ 0 điểm). Bỏ trống = không có gì để chấm. */
export function essayNeedsGrading(a: { textAnswer: string | null; pointsAwarded: number | null } | null | undefined): boolean {
  return !!a && !!a.textAnswer?.trim() && a.pointsAwarded === null;
}

export type GradeState = "cho" | "da_cham" | "cong_bo";
export const GRADE_STATE_LABEL: Record<GradeState, string> = { cho: "Chờ chấm", da_cham: "Đã chấm", cong_bo: "Đã công bố" };

/** Chờ chấm: còn câu tự luận chưa chấm. Đã chấm: chấm hết nhưng chưa công bố. Đã công bố: có dòng công bố (công bố thắng mọi trạng thái khác). */
export function gradeState(o: { pendingEssays: number; published: boolean }): GradeState {
  if (o.published) return "cong_bo";
  return o.pendingEssays > 0 ? "cho" : "da_cham";
}

/**
 * Lượt này có đang bị GIỮ điểm với học sinh không. Đề không có chính sách (đề cũ) → không bao giờ giữ, hành vi cũ nguyên vẹn.
 * Giữ = chính sách bật VÀ chưa công bố.
 */
export function isHeld(policy: { holdUntilPublish: boolean } | null | undefined, published: boolean): boolean {
  return !!policy?.holdUntilPublish && !published;
}

export type PointsCheck = { ok: true; value: number } | { ok: false; error: string };
/** Điểm một câu tự luận: số hữu hạn, 0 ≤ điểm ≤ điểm tối đa của câu; làm tròn 0,01. Chuỗi "1,5" cũng nhận. */
export function validateEssayPoints(raw: unknown, max: number): PointsCheck {
  const n = typeof raw === "string" ? Number(raw.trim().replace(",", ".")) : raw;
  if (typeof n !== "number" || !Number.isFinite(n) || (typeof raw === "string" && raw.trim() === "")) return { ok: false, error: `Điểm phải từ 0 đến ${fmtPoints(max)}.` };
  if (n < 0 || n > max) return { ok: false, error: `Điểm phải từ 0 đến ${fmtPoints(max)}.` };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export const COMMENT_MAX = 2000;
export function normalizeComment(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Nhận xét phải là chữ." };
  const t = raw.trim();
  if (t.length > COMMENT_MAX) return { ok: false, error: `Nhận xét tối đa ${COMMENT_MAX} ký tự.` };
  return { ok: true, value: t || null };
}

/** Công bố được khi bài đã nộp (không còn làm dở) và không còn câu tự luận nào chưa chấm. */
export function publishEligibility(o: { attemptStatus: string; pendingEssays: number }): { ok: true } | { ok: false; reason: string } {
  if (o.attemptStatus === "in_progress") return { ok: false, reason: "Học sinh chưa nộp bài." };
  if (o.pendingEssays > 0) return { ok: false, reason: `Còn ${o.pendingEssays} câu tự luận chưa chấm.` };
  return { ok: true };
}

/** Gom một lô: tách lượt công bố được và lượt bị bỏ qua kèm lý do (không công bố nửa vời cho bài chưa chấm xong). */
export function planPublishBatch(attempts: { id: string; attemptStatus: string; pendingEssays: number; published: boolean }[]) {
  const toPublish: string[] = [], alreadyPublished: string[] = [], skipped: { id: string; reason: string }[] = [];
  for (const a of attempts) {
    if (a.published) { alreadyPublished.push(a.id); continue; }
    const e = publishEligibility(a);
    if (e.ok) toPublish.push(a.id); else skipped.push({ id: a.id, reason: e.reason });
  }
  return { toPublish, alreadyPublished, skipped };
}

/** Điểm in ra: bỏ số 0 thừa, dấu phẩy thập phân kiểu Việt ("1,5"). */
export function fmtPoints(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

// ── Phân tích kết quả (QZ-06) ────────────────────────────────────────────────────────────────────────────────

export interface QzQuestion { id: string; type: string; points: number; options: { id: string; isCorrect: boolean; text: string }[] }
export interface QzAttempt { id: string; userId: string; status: string; score: number | null; totalPoints: number | null; tabSwitchCount: number; startedAt: Date; submittedAt: Date | null }
export interface QzAnswer { attemptId: string; questionId: string; optionId: string | null; textAnswer: string | null; pointsAwarded: number | null }

export interface QuestionStat {
  questionId: string; order: number; type: string; points: number;
  /** Số lượt đã nộp mà câu này tính được (MC/điền ngắn: mọi lượt đã nộp; tự luận: lượt đã được chấm). */
  counted: number;
  /** MC/điền ngắn: số lượt đúng. Tự luận: null. Cụm đúng/sai: null (chấm theo bậc, không có "đúng/sai" một chiều). */
  correct: number | null;
  /** Tự luận: điểm trung bình đã chấm / điểm tối đa (0..1); loại khác null. */
  essayAvgRatio: number | null;
  blank: number;
  pendingEssays: number;
}

export interface Distribution { label: string; from: number; to: number; count: number }

export interface QuizAnalytics {
  attemptCount: number;         // mọi lượt, kể cả đang làm dở
  submittedCount: number;       // đã nộp / hết giờ
  inProgressCount: number;
  studentCount: number;         // số học sinh khác nhau đã có lượt
  scoredCount: number;          // số lượt được tính vào điểm (đã nộp và không còn tự luận chờ chấm)
  waitingCount: number;         // số lượt đã nộp nhưng còn tự luận chờ chấm (KHÔNG tính vào điểm)
  avgPercent: number | null;    // trung bình % điểm trên các lượt tính được
  maxPercent: number | null;
  minPercent: number | null;
  distribution: Distribution[]; // 5 khoảng theo % điểm
  questions: QuestionStat[];
}

const BUCKETS: [number, number, string][] = [[0, 20, "0–20%"], [20, 40, "20–40%"], [40, 60, "40–60%"], [60, 80, "60–80%"], [80, 100.0001, "80–100%"]];

export function percentOf(a: { score: number | null; totalPoints: number | null }, examTotal: number): number | null {
  if (a.score === null || !(examTotal > 0)) return null;
  return Math.round((a.score / examTotal) * 10000) / 100;
}

/**
 * Chỉ TRÌNH BÀY số liệu có sẵn (ExamAttempt, ExamAnswer, đáp án đúng); không sinh thêm điểm. Không chứa tên học sinh.
 * `examTotal` = Exam.totalPoints (thang điểm quy đổi của đề).
 */
export function buildQuizAnalytics(o: { examTotal: number; questions: QzQuestion[]; attempts: QzAttempt[]; answers: QzAnswer[] }): QuizAnalytics {
  const submitted = o.attempts.filter(a => a.status !== "in_progress");
  const submittedIds = new Set(submitted.map(a => a.id));
  const essayIds = new Set(o.questions.filter(q => q.type === "ESSAY").map(q => q.id));
  const ansByAttempt = new Map<string, QzAnswer[]>();
  for (const a of o.answers) { if (!submittedIds.has(a.attemptId)) continue; ansByAttempt.set(a.attemptId, [...(ansByAttempt.get(a.attemptId) ?? []), a]); }

  const pendingOf = (attemptId: string) => (ansByAttempt.get(attemptId) ?? []).filter(a => essayIds.has(a.questionId) && essayNeedsGrading(a)).length;
  const scored = submitted.filter(a => pendingOf(a.id) === 0 && a.score !== null);
  const pcts = scored.map(a => percentOf(a, o.examTotal)).filter((p): p is number => p !== null);

  const distribution = BUCKETS.map(([from, to, label]) => ({ label, from, to: Math.min(to, 100), count: pcts.filter(p => p >= from && p < to).length }));

  const questions: QuestionStat[] = o.questions.map((q, i) => {
    const rows = new Map<string, QzAnswer>();
    for (const a of o.answers) if (a.questionId === q.id && submittedIds.has(a.attemptId)) rows.set(a.attemptId, a);
    let correct: number | null = null, counted = submitted.length, blank = 0, pendingEssays = 0, essayAvgRatio: number | null = null;
    if (q.type === "MC") {
      correct = 0;
      for (const at of submitted) {
        const r = rows.get(at.id);
        if (!r?.optionId) { blank++; continue; }
        if (q.options.find(op => op.id === r.optionId)?.isCorrect) correct++;
      }
    } else if (q.type === "SHORT_ANSWER") {
      correct = 0;
      const right = q.options.find(op => op.isCorrect)?.text;
      for (const at of submitted) {
        const r = rows.get(at.id);
        if (!r?.textAnswer?.trim()) { blank++; continue; }
        if (shortAnswerCorrect(r.textAnswer, right)) correct++;
      }
    } else if (q.type === "ESSAY") {
      let sum = 0, n = 0;
      for (const at of submitted) {
        const r = rows.get(at.id);
        if (!r?.textAnswer?.trim()) { blank++; continue; }
        if (r.pointsAwarded === null) { pendingEssays++; continue; }
        sum += r.pointsAwarded; n++;
      }
      counted = n;
      essayAvgRatio = n > 0 && q.points > 0 ? Math.round((sum / n / q.points) * 10000) / 10000 : null;
    }
    return { questionId: q.id, order: i + 1, type: q.type, points: q.points, counted, correct, essayAvgRatio, blank, pendingEssays };
  });

  return {
    attemptCount: o.attempts.length,
    submittedCount: submitted.length,
    inProgressCount: o.attempts.length - submitted.length,
    studentCount: new Set(o.attempts.map(a => a.userId)).size,
    scoredCount: pcts.length,
    waitingCount: submitted.filter(a => pendingOf(a.id) > 0).length,
    avgPercent: pcts.length ? Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 100) / 100 : null,
    maxPercent: pcts.length ? Math.max(...pcts) : null,
    minPercent: pcts.length ? Math.min(...pcts) : null,
    distribution,
    questions,
  };
}
