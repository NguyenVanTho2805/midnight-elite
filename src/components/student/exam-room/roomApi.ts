// Hợp đồng phòng thi phía học sinh theo BU-04 mục 4. TẠM đặt cạnh giao diện vì `src/lib/examRoomApi.ts` (stu-code) chưa có lúc dựng;
// khi tệp đó vào nhánh, đổi import ở đây sang `@/lib/examRoomApi` và xoá phần kiểu trùng — hình dạng dữ liệu bám đúng mục 4, chỉ thêm trường tuỳ chọn.
// Mọi trường mới là TUỲ CHỌN: máy chủ chưa lên bản BU-04 thì giao diện chạy như đề cũ (không chế độ, không khung giờ).
import type { ExamAttemptReview, ExamAttemptState, ExamGate, ExamSubmitResult } from "@/lib/api";

export type ExamMode = "practice" | "test" | null;

export type RoomBlockReason = NonNullable<ExamGate["blockReason"]> | "not_open" | "closed";
export interface RoomGate extends Omit<ExamGate, "blockReason" | "exam"> {
  exam: ExamGate["exam"] & { mode?: ExamMode };
  window?: { state: "none" | "not_open" | "open" | "closed"; opensAt: string | null; closesAt: string | null };
  feedback?: "instant" | "none";
  blockReason: RoomBlockReason | null;
}
export interface RoomStart extends ExamAttemptState {
  examId?: string; mode?: ExamMode; feedback?: "instant" | "none"; variantCode?: number | null; windowClosesAt?: string | null;
}
export interface RoomSubmit extends ExamSubmitResult { mode?: ExamMode; answersOpenAt?: string | null }
export interface RoomReview extends ExamAttemptReview {
  exam?: { id: string; title: string; mode: ExamMode; showLeaderboard: boolean };
  answersOpenAt?: string | null; canRetake?: boolean;
}

/** Câu trả lời của /check (mục 4.5). Chỉ vẽ những gì máy chủ trả; không suy ra đáp án. */
export interface CheckResult {
  questionId: string; state: "hint" | "solved" | "revealed"; correct: boolean; tries: number;
  rightCount?: number; hint: string | null; canReveal: boolean;
  answer: null | { correctOptionIds: string[]; correctText: string | null; clusterTruths: { optionId: string; isTrue: boolean }[] };
  explanation: string | null; revealBlockedReason: null | "never" | "hide_wrong";
}

export interface AssignmentItem {
  id: string; title: string; mode: ExamMode; source: "lop" | "link" | "thu-vien"; courseName: string | null;
  opensAt: string | null; dueAt: string | null;
  state: "chua-mo" | "dang-mo" | "da-dong" | "dang-lam" | "cho-cong-bo" | "da-lam";
  attempts: { used: number; max: number | null }; best: { score: number; total: number } | null;
  questionCount: number; durationMinutes: number | null;
}

export class RoomApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public data?: Record<string, unknown>) { super(message); }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init, headers: { ...(init?.body ? { "content-type": "application/json" } : {}) } });
  } catch { throw new RoomApiError("Lỗi kết nối, thử lại sau", 0, "network"); }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new RoomApiError(typeof data.error === "string" ? data.error : "Có lỗi xảy ra", res.status, typeof data.code === "string" ? data.code : undefined, data);
  return data as T;
}
const post = (body?: unknown): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const roomApi = {
  gate: (examId: string) => call<RoomGate>(`/api/exams/${examId}/gate`),
  start: (examId: string, password?: string) => call<RoomStart>(`/api/exams/${examId}/start`, post({ password })),
  submit: (attemptId: string) => call<RoomSubmit>(`/api/exams/attempts/${attemptId}/submit`, post()),
  review: (attemptId: string) => call<RoomReview>(`/api/exams/attempts/${attemptId}/review`),
  tabEvent: (attemptId: string) => call<{ tabSwitchCount: number }>(`/api/exams/attempts/${attemptId}/tab-event`, { method: "PATCH" }),
  check: (attemptId: string, questionId: string, action: "check" | "reveal" = "check") =>
    call<CheckResult>(`/api/exams/attempts/${attemptId}/check`, post({ questionId, action })),
  assignments: () => call<{ serverNow: string; items: AssignmentItem[] }>("/api/student/de-thi"),
};

/** Một lần lưu đáp án. KHÔNG nuốt lỗi: trả mã để chip lưu biết đây là mất mạng hay hết giờ. */
export type SavePayload =
  | { kind: "opt"; questionId: string; optionId: string }
  | { kind: "text"; questionId: string; text: string }
  | { kind: "bool"; questionId: string; optionId: string; value: boolean };
export type SaveOutcome =
  | { ok: true; savedAt: string | null; serverNow: string | null; expiresAt: string | null }
  | { ok: false; code: "expired" | "finished" | "section_locked" | "network" | "other"; error: string };

export async function saveAnswer(attemptId: string, p: SavePayload): Promise<SaveOutcome> {
  const url = p.kind === "bool" ? `/api/exams/attempts/${attemptId}/answer-bool` : `/api/exams/attempts/${attemptId}/answer`;
  const body = p.kind === "opt" ? { questionId: p.questionId, optionId: p.optionId }
    : p.kind === "text" ? { questionId: p.questionId, textAnswer: p.text }
    : { optionId: p.optionId, answerTrue: p.value };
  try {
    const d = await call<{ savedAt?: string; serverNow?: string; expiresAt?: string }>(url, { method: "PATCH", body: JSON.stringify(body) });
    return { ok: true, savedAt: d.savedAt ?? null, serverNow: d.serverNow ?? null, expiresAt: d.expiresAt ?? null };
  } catch (e) {
    const err = e as RoomApiError;
    if (err.code === "network" || err.status === 0) return { ok: false, code: "network", error: err.message };
    const msg = err.message ?? "";
    const code = err.code === "expired" || /hết giờ/i.test(msg) ? "expired"
      : err.code === "finished" || /kết thúc/i.test(msg) ? "finished"
      : err.code === "section_locked" || /Phần này/.test(msg) ? "section_locked"
      : err.status >= 500 || err.status === 429 ? "network" : "other";
    return { ok: false, code, error: msg };
  }
}
