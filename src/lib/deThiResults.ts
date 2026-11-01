// BU-03 P3 — kết quả một đề (5 khối + bảng điểm). THUẦN: không prisma, không next. Dữ liệu vào là các hàng đã nạp; ra là số liệu trình bày.
// KHÔNG bao giờ chứa tên học sinh ở `buildKetQua` (khối thống kê); tên chỉ có ở `buildScoreTable` (bảng điểm / Excel, chỉ gia sư chủ đề).
// Chỉ TRÌNH BÀY số liệu có sẵn (ExamAttempt.score, ExamAnswer) — không sinh điểm mới. Thang hiển thị: 10 (điểm lượt thi quy về tổng điểm đề gốc rồi chia).
//
// Đơn vị (hợp đồng với tut-dev):
//   basic.avg/median/max/min và frequency[].score: THANG 10, làm tròn 2 chữ số; basic.passRate và questions[].correctRate: TỈ LỆ 0–1 (0,5 = 50%), 4 chữ số.
//   basic.attempts = số lượt ĐÃ NỘP (không tính đang làm dở); thống kê điểm chỉ tính lượt "tính được" (đã nộp, không còn tự luận chờ chấm, có điểm) — cùng luật buildQuizAnalytics.
import { buildQuizAnalytics, essayNeedsGrading, percentOf, type QzAnswer, type QzAttempt, type QzQuestion } from "@/lib/quizGrade";
import { variantCode, variantKey } from "@/lib/deThiVariants";

export const PASS_PERCENT = 50;            // đạt = từ 5/10
export const FLAG_MAX_RATE = 0.3;          // câu đúng dưới 30% …
export const FLAG_MIN_ANSWERED = 3;        // … và có ít nhất 3 lượt trả lời → đánh dấu "cần xem lại"
export const DISTRIBUTION_LABELS = ["0–<20%", "20–<40%", "40–<60%", "60–<80%", "80–100%"] as const;
export const FREQUENCY_STEP = 0.5;

export interface RExam { id: string; variantNo: number; totalPoints: number }
export interface RQuestion { id: string; examId: string; order: number; type: string; points: number; text: string; options: { id: string; text: string; isCorrect: boolean; subLabel?: string | null }[] }
export interface RAttempt { id: string; userId: string; examId: string; status: string; score: number | null; totalPoints: number | null; tabSwitchCount: number; startedAt: Date; submittedAt: Date | null }
export type RAnswer = QzAnswer;
export interface RBool { attemptId: string; optionId: string; answerTrue: boolean | null }
export interface ResultsInput { exams: RExam[]; questions: RQuestion[]; attempts: RAttempt[]; answers: RAnswer[]; booleans: RBool[]; passPercent?: number }

export interface KetQua {
  basic: { attempts: number; students: number; avg: number | null; median: number | null; max: number | null; min: number | null; passRate: number | null; avgDurationSec: number | null };
  distribution: { label: (typeof DISTRIBUTION_LABELS)[number]; count: number }[];
  frequency: { score: number; count: number }[];
  questions: { order: number; variantKey: string; correctRate: number; answered: number; avgSec: number | null; flagged: boolean }[];
  variants: { variantNo: number; code: number; attempts: number; avg: number | null }[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
/** Làm tròn tới bội gần nhất của 0,5 (x.25 → x.5, x.75 → x+1 vì Math.round làm tròn nửa lên). */
export const toHalfStep = (x: number): number => Math.round(x / FREQUENCY_STEP) * FREQUENCY_STEP;

interface Prepared {
  rootTotal: number;
  attempts: RAttempt[];            // điểm đã quy về tổng điểm đề gốc
  submitted: RAttempt[];
  scored: { a: RAttempt; score10: number }[];
  qzQuestions: QzQuestion[];
  examNo: Map<string, number>;
}

function prepare(i: ResultsInput): Prepared {
  const root = i.exams.find(e => e.variantNo === 1) ?? i.exams[0];
  const rootTotal = root?.totalPoints ?? 10;
  const totalOf = new Map(i.exams.map(e => [e.id, e.totalPoints] as const));
  // Mã đề con thường cùng tổng điểm; nếu lệch thì quy về thang đề gốc để các mã so được với nhau.
  const attempts = i.attempts.map(a => {
    const t = totalOf.get(a.examId) ?? rootTotal;
    return a.score !== null && t > 0 && t !== rootTotal ? { ...a, score: (a.score / t) * rootTotal } : a;
  });
  const submitted = attempts.filter(a => a.status !== "in_progress");
  const essayIds = new Set(i.questions.filter(q => q.type === "ESSAY").map(q => q.id));
  const submittedIds = new Set(submitted.map(a => a.id));
  const pending = new Set<string>();
  for (const an of i.answers) if (submittedIds.has(an.attemptId) && essayIds.has(an.questionId) && essayNeedsGrading(an)) pending.add(an.attemptId);
  const scored: Prepared["scored"] = [];
  for (const a of submitted) {
    if (pending.has(a.id) || a.score === null) continue;
    const p = percentOf(a, rootTotal);
    if (p !== null) scored.push({ a, score10: r2(p / 10) });
  }
  const qzQuestions: QzQuestion[] = i.questions.map(q => ({ id: q.id, type: q.type, points: q.points, options: q.options.map(o => ({ id: o.id, isCorrect: o.isCorrect, text: o.text })) }));
  return { rootTotal, attempts, submitted, scored, qzQuestions, examNo: new Map(i.exams.map(e => [e.id, e.variantNo] as const)) };
}

const asQz = (a: RAttempt): QzAttempt => ({ id: a.id, userId: a.userId, status: a.status, score: a.score, totalPoints: a.totalPoints, tabSwitchCount: a.tabSwitchCount, startedAt: a.startedAt, submittedAt: a.submittedAt });

interface Acc { order: number; key: string; counted: number; correctSum: number; answered: number }

/** Thống kê từng câu của MỘT mã đề (gộp theo khoá câu ở hàm gọi). MC / trả lời ngắn / tự luận lấy từ buildQuizAnalytics; nhiều đáp án và Đúng-Sai 4 ý tính thêm ở đây. */
function questionAccs(exam: RExam, i: ResultsInput, p: Prepared): { q: RQuestion; counted: number; correctSum: number; answered: number }[] {
  const qs = i.questions.filter(q => q.examId === exam.id).sort((a, b) => a.order - b.order);
  const atts = p.attempts.filter(a => a.examId === exam.id);
  const attIds = new Set(atts.map(a => a.id));
  const an = buildQuizAnalytics({
    examTotal: exam.totalPoints,
    questions: p.qzQuestions.filter(q => qs.some(x => x.id === q.id)),
    attempts: atts.map(asQz),
    answers: i.answers.filter(a => attIds.has(a.attemptId)),
  });
  const stat = new Map(an.questions.map(s => [s.questionId, s] as const));
  const subIds = p.submitted.filter(a => a.examId === exam.id).map(a => a.id);
  return qs.map(q => {
    const s = stat.get(q.id);
    if (q.type === "MC_MULTI" || q.type === "TRUE_FALSE_CLUSTER") {
      const optIds = new Set(q.options.map(o => o.id));
      let correctSum = 0, answered = 0;
      for (const aid of subIds) {
        const rows = i.booleans.filter(b => b.attemptId === aid && optIds.has(b.optionId));
        if (q.type === "MC_MULTI") {
          const ticked = new Set(rows.filter(b => b.answerTrue === true).map(b => b.optionId));
          if (ticked.size === 0) continue;
          answered++;
          const right = new Set(q.options.filter(o => o.isCorrect).map(o => o.id));
          if (right.size > 0 && ticked.size === right.size && [...ticked].every(id => right.has(id))) correctSum++;
        } else {
          const by = new Map(rows.map(b => [b.optionId, b.answerTrue] as const));
          if (![...by.values()].some(v => v !== null)) continue;
          answered++;
          const n = q.options.length || 1;
          correctSum += q.options.filter(o => by.get(o.id) === o.isCorrect).length / n; // ý trống tính là chưa đúng
        }
      }
      return { q, counted: subIds.length, correctSum, answered };
    }
    if (!s) return { q, counted: 0, correctSum: 0, answered: 0 };
    if (q.type === "ESSAY") return { q, counted: s.counted, correctSum: (s.essayAvgRatio ?? 0) * s.counted, answered: s.counted + s.pendingEssays };
    return { q, counted: s.counted, correctSum: s.correct ?? 0, answered: s.counted - s.blank };
  });
}

/** 5 khối kết quả của MỘT đề (đã gộp mọi mã đề). KHÔNG có tên học sinh. */
export function buildKetQua(i: ResultsInput): KetQua {
  const p = prepare(i);
  const passPct = i.passPercent ?? PASS_PERCENT;
  const exams = [...i.exams].sort((a, b) => a.variantNo - b.variantNo);

  const scores = p.scored.map(s => s.score10);
  const durations = p.submitted.filter(a => a.submittedAt).map(a => Math.max(0, Math.round((a.submittedAt!.getTime() - a.startedAt.getTime()) / 1000)));
  const passN = p.scored.filter(s => s.score10 * 10 >= passPct).length;
  const basic: KetQua["basic"] = {
    attempts: p.submitted.length,
    students: new Set(p.submitted.map(a => a.userId)).size,
    avg: scores.length ? r2(mean(scores)) : null,
    median: scores.length ? r2(median(scores)!) : null,
    max: scores.length ? Math.max(...scores) : null,
    min: scores.length ? Math.min(...scores) : null,
    passRate: scores.length ? r4(passN / scores.length) : null,
    avgDurationSec: durations.length ? Math.round(mean(durations)) : null,
  };

  // Khối 2 — 5 khoảng %: dùng buildQuizAnalytics (một công thức với trang thống kê cũ); chỉ đổi nhãn sang "0–<20%".
  const pooled = buildQuizAnalytics({ examTotal: p.rootTotal, questions: p.qzQuestions, attempts: p.attempts.map(asQz), answers: i.answers });
  const distribution = pooled.distribution.map((d, k) => ({ label: DISTRIBUTION_LABELS[k], count: d.count }));

  // Khối 3 — tần số điểm bước 0,5 trên thang 10: đủ 21 mốc 0…10 (kể cả mốc 0 lượt) để vẽ biểu đồ không phải tự lấp.
  const steps = Math.round(10 / FREQUENCY_STEP);
  const freq = new Map<number, number>();
  for (const s of scores) { const k = toHalfStep(s); freq.set(k, (freq.get(k) ?? 0) + 1); }
  const frequency = Array.from({ length: steps + 1 }, (_, k) => ({ score: k * FREQUENCY_STEP, count: freq.get(k * FREQUENCY_STEP) ?? 0 }));

  // Khối 4 — từng câu, gộp theo variantKey xuyên mã đề; thứ tự theo đề gốc (câu chỉ có ở mã con xếp sau).
  const accs = new Map<string, Acc>();
  const rootExam = exams.find(e => e.variantNo === 1) ?? exams[0];
  let nextOrder = rootExam ? i.questions.filter(q => q.examId === rootExam.id).length : 0;
  // Đề gốc xử lý trước (sắp theo variantNo) để thứ tự câu lấy từ đề gốc.
  for (const e of exams) {
    const seen = new Map<string, number>(); // cùng một câu lặp hai lần trong một đề vẫn là hai dòng
    questionAccs(e, i, p).forEach((r, idx) => {
      const key = variantKey({ type: r.q.type, text: r.q.text, options: r.q.options });
      const nth = (seen.get(key) ?? 0) + 1; seen.set(key, nth);
      const id = `${key}#${nth}`;
      let acc = accs.get(id);
      if (!acc) { acc = { order: e.id === rootExam.id ? idx + 1 : ++nextOrder, key, counted: 0, correctSum: 0, answered: 0 }; accs.set(id, acc); }
      acc.counted += r.counted; acc.correctSum += r.correctSum; acc.answered += r.answered;
    });
  }
  const questions = [...accs.values()].sort((a, b) => a.order - b.order).map(a => {
    const correctRate = a.counted > 0 ? r4(a.correctSum / a.counted) : 0;
    return { order: a.order, variantKey: a.key, correctRate, answered: a.answered, avgSec: null as number | null, flagged: a.answered >= FLAG_MIN_ANSWERED && correctRate < FLAG_MAX_RATE };
  });

  // Khối 5 — theo mã đề.
  const variants = exams.map(e => {
    const mine = p.scored.filter(s => s.a.examId === e.id).map(s => s.score10);
    return { variantNo: e.variantNo, code: variantCode(e.variantNo), attempts: p.submitted.filter(a => a.examId === e.id).length, avg: mine.length ? r2(mean(mine)) : null };
  });

  return { basic, distribution, frequency, questions, variants };
}

// ── Bảng điểm (CÓ TÊN — chỉ gia sư chủ đề) ───────────────────────────────────────────────────────
export const CHON_VALUES = ["dau", "cuoi", "cao-nhat"] as const;
export type Chon = (typeof CHON_VALUES)[number];
export const isChon = (v: unknown): v is Chon => typeof v === "string" && (CHON_VALUES as readonly string[]).includes(v);
export const CHON_DEFAULT: Chon = "cao-nhat";
export const CHON_LABEL: Record<Chon, string> = { dau: "Lần làm đầu", cuoi: "Lần làm cuối", "cao-nhat": "Lần điểm cao nhất" };

export interface ScoreRow { attemptId: string; studentName: string; score: number | null; submittedAt: string; durationSec: number | null; variantNo: number; tabSwitchCount: number }

/**
 * Mỗi học sinh một dòng, theo lựa chọn: `dau` lượt nộp sớm nhất, `cuoi` muộn nhất, `cao-nhat` điểm cao nhất (hoà → lượt sớm hơn).
 * `score` thang 10; `null` = đã nộp nhưng còn tự luận chờ chấm. Lượt đang làm dở không có dòng. Xếp theo tên (vi), rồi giờ nộp.
 * `tabSwitchCount` chỉ ĐỌC từ lượt thi (KiN chỉ ghi nhận, không phạt).
 */
export function buildScoreTable(i: ResultsInput & { names: ReadonlyMap<string, string> }, chon: Chon): ScoreRow[] {
  const p = prepare(i);
  const score10 = new Map(p.scored.map(s => [s.a.id, s.score10] as const));
  const when = (a: RAttempt) => (a.submittedAt ?? a.startedAt).getTime();
  const byUser = new Map<string, RAttempt[]>();
  for (const a of p.submitted) byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a]);
  const rows: ScoreRow[] = [];
  for (const [userId, list] of byUser) {
    list.sort((a, b) => when(a) - when(b) || a.id.localeCompare(b.id));
    const pick = chon === "dau" ? list[0] : chon === "cuoi" ? list[list.length - 1]
      : list.reduce((best, a) => ((score10.get(a.id) ?? -1) > (score10.get(best.id) ?? -1) ? a : best), list[0]);
    rows.push({
      attemptId: pick.id, studentName: i.names.get(userId) ?? "Học viên",
      score: score10.get(pick.id) ?? null, submittedAt: (pick.submittedAt ?? pick.startedAt).toISOString(),
      durationSec: pick.submittedAt ? Math.max(0, Math.round((pick.submittedAt.getTime() - pick.startedAt.getTime()) / 1000)) : null,
      variantNo: p.examNo.get(pick.examId) ?? 1, tabSwitchCount: pick.tabSwitchCount,
    });
  }
  return rows.sort((a, b) => a.studentName.localeCompare(b.studentName, "vi") || a.submittedAt.localeCompare(b.submittedAt));
}
