// BU-04 — HỢP ĐỒNG kiểu giữa phòng thi (stu-dev) và API phòng thi (stu-code). Chỉ `import type` ở phía giao diện; các hàm fetch mỏng ở cuối tệp.
// Quy ước: mọi mốc giờ là ISO từ MÁY CHỦ (`serverNow`, `expiresAt`…); trình duyệt tính chênh lệch bằng quizRoom.clockOffsetMs.
// KHÔNG kiểu nào ở đây có `isCorrect`, `explanation`, `graderGuide`, đáp án câu điền ngắn: những thứ đó chỉ nằm ở `review` (sau khi nộp)
// và ở `check` (luyện tập, theo chính sách máy chủ) — xem ReviewQuestion / PracticeCheckResponse.
// Tệp này THUẦN (không prisma, không next): an toàn để import từ component.
import type { ExamMode } from "@/lib/deThiAssign";
import type { AnswersLockedReason } from "@/lib/examPolicy"; // STU-001: chỉ kiểu; examPolicy.ts thuần, không prisma

export type { ExamMode };

// ── Chung ─────────────────────────────────────────────────────────────────────
export interface ApiErrorBody { error: string; code?: string }
export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; error: string; data: Record<string, unknown> | null };

/** Mã lỗi `code` mà phòng thi cần phân biệt (còn lại coi là lỗi chung). */
export type RoomErrorCode =
  | "not_open" | "closed" | "attempts_exhausted" | "past_deadline" | "SUPERSEDED"
  | "expired" | "finished" | "section_locked" | "enrollment_suspended" | "enrollment_removed"
  | "not_practice" | "no_feedback" | "not_answered" | "not_checkable" | "reveal_too_early" | "already_done" | "not_submitted"
  | "network";

// ── Cổng vào đề: GET /api/exams/[id]/gate ────────────────────────────────────
export type BlockReason =
  | "not_enrolled" | "enrollment_suspended" | "payment_required" | "attempts_exhausted" | "no_questions" | "past_deadline" | "not_open" | "closed";
export type WindowState = "none" | "not_open" | "open" | "closed";
/** "instant" = luyện tập được chấm từng câu; "none" = không (kiểm tra, hoặc đề đang giữ điểm tới khi công bố). */
export type PracticeFeedbackMode = "instant" | "none";

export interface GateResponse {
  exam: {
    id: string; // ID GỐC (mã con quy về gốc)
    title: string; category: string; date: string; time: string;
    durationMinutes: number; questionCount: number;
    hasPassword: boolean; hasEssay: boolean; hasQuestions: boolean;
    mode: ExamMode | null; // null = đề cũ, hành vi cũ
  };
  window: { state: WindowState; opensAt: string | null; closesAt: string | null };
  feedback: PracticeFeedbackMode;
  klass: { id: string; name: string; tutorName: string | null } | null;
  enrolled: boolean | null;
  attempts: { used: number; max: number | null; remaining: number | null; resumable: boolean; label: string };
  deadline: { dueAt: string; state: string } | null;
  /** STU-001: chính sách hiệu lực để màn cổng nói trước khi nào đáp án hiện. */
  policy?: { guarded: boolean; answersLockedReason: AnswersLockedReason };
  serverNow: string;
  canStart: boolean;
  blockReason: BlockReason | null;
}

// ── Vào phòng thi / tiếp tục: POST /api/exams/[id]/start ─────────────────────
export interface RoomOption { id: string; order: number; text: string; subLabel: string | null }
export interface RoomQuestion {
  id: string; order: number; type: string; text: string; imageUrl: string | null; points: number;
  sectionLabel: string | null; studentGuide: string | null;
  options: RoomOption[]; // SHORT_ANSWER: luôn rỗng
}
export interface SectionWindowDTO { label: string | null; endsAt: string }

export interface StartResponse {
  attemptId: string;
  examId: string; // gốc
  mode: ExamMode | null;
  feedback: PracticeFeedbackMode;
  variantCode: number | null; // 101, 102… ; null nếu đề không có mã
  windowClosesAt: string | null;
  serverNow: string;
  expiresAt: string;
  sectionWindows: SectionWindowDTO[] | null;
  questions: RoomQuestion[];
  answers: Record<string, string | null>;
  textAnswers: Record<string, string>;
  boolAnswers: Record<string, boolean | null>;
  tabSwitchCount: number;
}

// ── Lưu đáp án: PATCH …/answer và …/answer-bool ──────────────────────────────
export type SaveAnswerBody =
  | { kind: "option"; questionId: string; optionId: string }
  | { kind: "text"; questionId: string; textAnswer: string }
  | { kind: "bool"; optionId: string; answerTrue: boolean };
export interface SaveAnswerResponse { success: true; savedAt: string; serverNow: string; expiresAt: string }

// ── Chấm từng câu (chỉ luyện tập): POST …/check ──────────────────────────────
export type PracticeState = "hint" | "solved" | "revealed";
export interface PracticeAnswerReveal {
  correctOptionIds: string[];
  correctText: string | null;
  clusterTruths: { optionId: string; isTrue: boolean }[];
}
export interface PracticeCheckResponse {
  questionId: string;
  state: PracticeState;
  correct: boolean;
  tries: number;
  rightCount?: number; // chỉ câu Đúng–Sai
  hint: string | null; // chỉ khi state === "hint"
  canReveal: boolean;
  answer: PracticeAnswerReveal | null; // null khi state === "hint" HOẶC chính sách không cho
  explanation: string | null;
  revealBlockedReason: null | "never" | "hide_wrong";
}

// ── Nộp bài: POST …/submit ───────────────────────────────────────────────────
export interface SubmitResponse {
  score: number | null; totalPoints: number; rank: number | null; coinsEarned: number;
  held: boolean; pendingManual: boolean; status: string; submittedAt: string | null; expired: boolean; receipt: string;
  mode: ExamMode | null;
  answersOpenAt: string | null;
}

// ── Chữa bài / xem lại: GET …/review ─────────────────────────────────────────
export interface ReviewQuestion {
  id: string; type: string; text: string; points: number; sectionLabel: string | null;
  correctionPending?: boolean;
  textAnswer?: string | null; pointsAwarded?: number | null; teacherComment?: string | null;
  studentOptionId?: string | null; studentAnswer?: string | null;
  correctAnswer?: string | null; isCorrect?: boolean | null; explanation?: string | null;
  options?: { id: string; text: string; subLabel?: string | null; isCorrect?: boolean | null; picked?: boolean; studentAnswerTrue?: boolean | null }[];
}
export interface ReviewResponse {
  attemptId: string; score: number | null; held: boolean; pendingManual: boolean; totalPoints: number;
  canSeeAnswers: boolean; correctableCount: number;
  exam: { id: string; title: string; mode: ExamMode | null; showLeaderboard: boolean };
  answersOpenAt: string | null;
  canRetake: boolean;
  /** STU-001: vì sao đáp án còn bị giấu (null = không giấu gì); đề công khai bị KiN áp mặc định an toàn không; số lượt hiệu lực. Thiếu trường = máy chủ cũ. */
  answersLockedReason?: AnswersLockedReason;
  publicGuarded?: boolean;
  attemptsMax?: number | null;
  questions: ReviewQuestion[];
}

// ── Danh sách đề của học sinh: GET /api/student/de-thi ───────────────────────
export type AssignmentState = "chua-mo" | "dang-mo" | "da-dong" | "dang-lam" | "cho-cong-bo" | "da-lam";
export type AssignmentSource = "lop" | "link" | "thu-vien";
export interface AssignmentItem {
  id: string; // gốc
  title: string; mode: ExamMode | null; source: AssignmentSource; courseName: string | null;
  opensAt: string | null; dueAt: string | null;
  state: AssignmentState;
  attempts: { used: number; max: number | null };
  best: { score: number; total: number } | null;
  questionCount: number; durationMinutes: number | null;
}
export interface AssignmentsResponse { serverNow: string; items: AssignmentItem[] }

// ── Hàm fetch mỏng ───────────────────────────────────────────────────────────
async function call<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, code: "network", error: "Không kết nối được. Em kiểm tra mạng rồi thử lại.", data: null };
  }
  let json: unknown = null;
  try { json = await res.json(); } catch { /* không phải JSON */ }
  if (res.ok) return { ok: true, status: res.status, data: json as T };
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  return {
    ok: false, status: res.status,
    code: typeof o.code === "string" ? o.code : `http_${res.status}`,
    error: typeof o.error === "string" ? o.error : "Có lỗi xảy ra. Em thử lại nhé.",
    data: o,
  };
}

const enc = encodeURIComponent;
export const examRoomApi = {
  gate: (examId: string) => call<GateResponse>("GET", `/api/exams/${enc(examId)}/gate`),
  start: (examId: string, password?: string) => call<StartResponse>("POST", `/api/exams/${enc(examId)}/start`, password ? { password } : {}),
  /** KHÔNG nuốt lỗi: `ok:false` + `code` để chip lưu biết (`expired` ⇒ chuyển sang màn hết giờ, không phải lỗi mạng). */
  saveAnswer: (attemptId: string, b: SaveAnswerBody) => {
    if (b.kind === "bool") return call<SaveAnswerResponse>("PATCH", `/api/exams/attempts/${enc(attemptId)}/answer-bool`, { optionId: b.optionId, answerTrue: b.answerTrue });
    if (b.kind === "text") return call<SaveAnswerResponse>("PATCH", `/api/exams/attempts/${enc(attemptId)}/answer`, { questionId: b.questionId, textAnswer: b.textAnswer });
    return call<SaveAnswerResponse>("PATCH", `/api/exams/attempts/${enc(attemptId)}/answer`, { questionId: b.questionId, optionId: b.optionId });
  },
  check: (attemptId: string, questionId: string, action: "check" | "reveal" = "check") =>
    call<PracticeCheckResponse>("POST", `/api/exams/attempts/${enc(attemptId)}/check`, { questionId, action }),
  submit: (attemptId: string) => call<SubmitResponse>("POST", `/api/exams/attempts/${enc(attemptId)}/submit`),
  review: (attemptId: string) => call<ReviewResponse>("GET", `/api/exams/attempts/${enc(attemptId)}/review`),
  tabEvent: (attemptId: string) => call<{ success: boolean }>("PATCH", `/api/exams/attempts/${enc(attemptId)}/tab-event`),
  listAssignments: () => call<AssignmentsResponse>("GET", "/api/student/de-thi"),
};
