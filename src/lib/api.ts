// ─── API fetch helpers ────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",  // always send session cookie
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    // HTTP/2 luôn trả statusText rỗng — không rơi về chuỗi rỗng nếu JSON parse lỗi.
    const fallback = `Request failed (${res.status})`;
    const err = await res.json().catch(() => ({ error: fallback }));
    throw new Error(err.error || fallback);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // ── Courses ──────────────────────────────────────────────────────────────
  courses: {
    list:   (params?: Record<string, string>) =>
      apiFetch<CourseFull[]>(`/api/courses${params ? "?" + new URLSearchParams(params) : ""}`),
    get:    (id: string) => apiFetch<CourseWithCurriculum>(`/api/courses/${id}`),
    create: (data: Partial<CourseFull>) =>
      apiFetch<CourseFull>("/api/courses", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CourseFull>) =>
      apiFetch<CourseFull>(`/api/courses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/courses/${id}`, { method: "DELETE" }),
  },
  // ── Exams ────────────────────────────────────────────────────────────────
  exams: {
    list:   (params?: Record<string, string>) =>
      apiFetch<ExamFull[]>(`/api/exams${params ? "?" + new URLSearchParams(params) : ""}`),
    get:    (id: string) => apiFetch<ExamFull>(`/api/exams/${id}`),
    create: (data: Partial<ExamFull>) =>
      apiFetch<ExamFull>("/api/exams", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<ExamFull>) =>
      apiFetch<ExamFull>(`/api/exams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/exams/${id}`, { method: "DELETE" }),
    // Trích xuất câu hỏi bằng AI từ file đề thi gốc (PDF/Word/ảnh) — không dùng
    // apiFetch vì nó ép Content-Type: application/json, không hợp với FormData.
    aiExtractQuestions: async (examFile: File, answerKeyFile?: File): Promise<AiExtractResult> => {
      const formData = new FormData();
      formData.append("examFile", examFile);
      if (answerKeyFile) formData.append("answerKeyFile", answerKeyFile);
      const res = await fetch(`${BASE}/api/exams/ai-extract-questions`, {
        method: "POST", credentials: "same-origin", body: formData,
      });
      if (!res.ok) {
        // HTTP/2 luôn trả statusText rỗng, và lỗi 504 timeout của Vercel không
        // phải JSON — không được rơi về chuỗi rỗng, phải luôn có nội dung rõ ràng.
        const fallback = res.status === 504
          ? "Quá thời gian xử lý — thử lại với file ít câu hơn hoặc ít ảnh hơn"
          : `Trích xuất thất bại (lỗi ${res.status})`;
        const err = await res.json().catch(() => ({ error: fallback }));
        throw new Error(err.error || fallback);
      }
      return res.json() as Promise<AiExtractResult>;
    },
  },
  // ── Exam guest access (duyệt phí thủ công cho guest) ────────────────────────
  examGuestAccess: {
    list: (examId: string) =>
      apiFetch<ExamGuestAccessFull[]>(`/api/exams/${examId}/guest-access`),
    grant: (examId: string, email: string) =>
      apiFetch<ExamGuestAccessFull>(`/api/exams/${examId}/guest-access`, {
        method: "POST", body: JSON.stringify({ email }),
      }),
    revoke: (examId: string, userId: string) =>
      apiFetch<{ success: boolean }>(`/api/exams/${examId}/guest-access/${userId}`, { method: "DELETE" }),
  },
  // ── Exam questions (admin authoring) ────────────────────────────────────
  examQuestions: {
    list: (examId: string) =>
      apiFetch<ExamQuestionFull[]>(`/api/exams/${examId}/questions`),
    create: (examId: string, data: ExamQuestionInput) =>
      apiFetch<ExamQuestionFull>(`/api/exams/${examId}/questions`, {
        method: "POST", body: JSON.stringify(data),
      }),
    update: (examId: string, qid: string, data: ExamQuestionInput) =>
      apiFetch<ExamQuestionFull>(`/api/exams/${examId}/questions/${qid}`, {
        method: "PUT", body: JSON.stringify(data),
      }),
    remove: (examId: string, qid: string) =>
      apiFetch<{ success: boolean }>(`/api/exams/${examId}/questions/${qid}`, { method: "DELETE" }),
    reorder: (examId: string, order: { id: string; order: number }[]) =>
      apiFetch<{ success: boolean }>(`/api/exams/${examId}/questions/reorder`, {
        method: "PUT", body: JSON.stringify({ order }),
      }),
    bulkImport: (examId: string, text: string) =>
      apiFetch<{ imported: number; errors: { block: number; message: string }[] }>(
        `/api/exams/${examId}/questions/bulk-import`,
        { method: "POST", body: JSON.stringify({ text }) }
      ),
    bulkCreate: (examId: string, items: ExamQuestionInput[]) =>
      apiFetch<{ created: number }>(
        `/api/exams/${examId}/questions/bulk-create`,
        { method: "POST", body: JSON.stringify({ items }) }
      ),
    setPoints: (examId: string, totalPoints: number) =>
      apiFetch<{ updated: number; totalPoints: number }>(
        `/api/exams/${examId}/questions/set-points`,
        { method: "PUT", body: JSON.stringify({ totalPoints }) }
      ),
  },
  // ── Exam attempts nhìn từ phía admin/giáo viên ──────────────────────────────
  examAttemptsAdmin: {
    list: (examId: string) =>
      apiFetch<ExamAttemptAdminRow[]>(`/api/exams/${examId}/attempts/admin`),
    detail: (attemptId: string) =>
      apiFetch<ExamAttemptAdminDetail>(`/api/exams/attempts/${attemptId}/admin`),
    gradeEssay: (attemptId: string, questionId: string, points: number, comment: string) =>
      apiFetch<{ success: boolean; score: number | null }>(
        `/api/exams/attempts/${attemptId}/answers/${questionId}/grade`,
        { method: "PATCH", body: JSON.stringify({ points, comment }) }
      ),
  },
  // ── Exam attempts (học viên làm bài) ────────────────────────────────────
  examAttempts: {
    start: (examId: string, password?: string) =>
      apiFetch<ExamAttemptState>(`/api/exams/${examId}/start`, {
        method: "POST", body: JSON.stringify({ password }),
      }),
    get: (attemptId: string) =>
      apiFetch<ExamAttemptState>(`/api/exams/attempts/${attemptId}`),
    answer: (attemptId: string, questionId: string, optionId: string) =>
      apiFetch<{ success: boolean }>(`/api/exams/attempts/${attemptId}/answer`, {
        method: "PATCH", body: JSON.stringify({ questionId, optionId }),
      }),
    answerEssay: (attemptId: string, questionId: string, textAnswer: string) =>
      apiFetch<{ success: boolean }>(`/api/exams/attempts/${attemptId}/answer`, {
        method: "PATCH", body: JSON.stringify({ questionId, textAnswer }),
      }),
    answerBool: (attemptId: string, optionId: string, answerTrue: boolean) =>
      apiFetch<{ success: boolean }>(`/api/exams/attempts/${attemptId}/answer-bool`, {
        method: "PATCH", body: JSON.stringify({ optionId, answerTrue }),
      }),
    submit: (attemptId: string) =>
      apiFetch<{ score: number; totalPoints: number; rank: number }>(
        `/api/exams/attempts/${attemptId}/submit`,
        { method: "POST" }
      ),
    history: (examId: string) =>
      apiFetch<ExamAttemptHistoryItem[]>(`/api/exams/${examId}/attempts?mine=true`),
    tabEvent: (attemptId: string) =>
      apiFetch<{ success: boolean; tabSwitchCount: number }>(
        `/api/exams/attempts/${attemptId}/tab-event`,
        { method: "PATCH" }
      ),
    review: (attemptId: string) =>
      apiFetch<ExamAttemptReview>(`/api/exams/attempts/${attemptId}/review`),
  },
};

// ─── API types (mirrors Prisma models) ───────────────────────────────────────

export interface CourseFull {
  id: string; adminId: number;
  name: string; adminName: string; shortTitle: string;
  category: string; instructor: string; teacherAvatar: string;
  openDate: string; types: string[];
  tag?: string | null; tagColor?: string | null;
  introVideo?: string | null;
  zaloGroupLink?: string | null;
  bg: string; strip: string;
  price: number; originalPrice?: number | null;
  lessons: number; hours: number;
  status: boolean; createdAt: string;
}

export interface SectionFull {
  id: string; title: string; order: number; courseId: string;
  chapters: ChapterFull[];
}
export interface ChapterFull {
  id: string; title: string; order: number; sectionId: string;
  lessons: LessonFull[];
}
export interface LessonFull {
  id: string; code: string; title: string; type: string;
  duration?: string | null; isLocked: boolean; isFree: boolean;
  statsVideos: number; statsMaterials: number; statsViews: number;
  order: number; chapterId: string;
}

export interface CourseWithCurriculum extends CourseFull {
  sections: SectionFull[];
}

export interface ExamFull {
  id: string; code: string; title: string; category: string;
  date: string; time: string; duration: string; questions: number;
  status: string; azotaUrl?: string | null;
  participants: number; active: boolean; activeGuest: boolean; guestCanTake: boolean; createdAt: string;
  hasQuestions: boolean;
  courseId?: string | null; price?: number | null;
  clusterScorePercents?: number[] | null; // [1 ý, 2 ý, 3 ý, 4 ý đúng] theo %, null = mặc định 10/25/50/100
  hasPassword?: boolean; // KHÔNG BAO GIỜ có field password thô trong response — server chỉ trả cờ này
  password?: string; // chỉ dùng khi GỬI lên để đặt/đổi mật khẩu, không bao giờ có mặt khi server trả về
  showLeaderboard?: boolean;
  answerVisibility?: "never" | "after_submit" | "after_exam_ends";
  hideAnswerForWrong?: boolean;
  totalPoints: number; // tổng điểm hiển thị cuối cùng cho học viên — mặc định 150
}

export interface ExamGuestAccessFull {
  id: string; userId: string; examId: string; grantedBy: string; grantedAt: string;
  user: { id: string; name: string; email: string };
}

export interface ExamAttemptAdminRow {
  id: string; status: string; score: number | null; totalPoints: number | null;
  startedAt: string; submittedAt: string | null; tabSwitchCount: number;
  ungradedEssayCount: number;
  user: { id: string; name: string; email: string };
}

export interface ExamAttemptAdminDetailOption {
  id: string; text: string; isCorrect: boolean;
  subLabel?: "a" | "b" | "c" | "d" | null;
  studentAnswerTrue: boolean | null;
}
export interface ExamAttemptAdminDetailQuestion {
  id: string; type: QuestionType; text: string; points: number;
  options: ExamAttemptAdminDetailOption[];
  studentOptionId: string | null;
  textAnswer: string | null;
  pointsAwarded: number | null;
  teacherComment: string | null;
}
export interface ExamAttemptAdminDetail {
  id: string; status: string; score: number | null; totalPoints: number;
  startedAt: string; submittedAt: string | null; tabSwitchCount: number;
  user: { id: string; name: string; email: string };
  questions: ExamAttemptAdminDetailQuestion[];
}

export type QuestionType = "MC" | "ESSAY" | "TRUE_FALSE_CLUSTER" | "SHORT_ANSWER";

// ─── Xem lại bài làm (học viên, sau khi nộp) ───────────────────────────────────
export interface ExamReviewOptionMC { id: string; text: string; isCorrect: boolean | null; }
export interface ExamReviewOptionCluster {
  id: string; text: string; subLabel?: "a" | "b" | "c" | "d" | null;
  studentAnswerTrue: boolean | null; isCorrect: boolean | null;
}
export type ExamReviewQuestion =
  | { id: string; type: "MC"; text: string; points: number; sectionLabel: string | null; studentOptionId: string | null; options: ExamReviewOptionMC[]; explanation: string | null }
  | { id: string; type: "TRUE_FALSE_CLUSTER"; text: string; points: number; sectionLabel: string | null; options: ExamReviewOptionCluster[] }
  | { id: string; type: "ESSAY"; text: string; points: number; sectionLabel: string | null; textAnswer: string | null; pointsAwarded: number | null; teacherComment: string | null }
  | { id: string; type: "SHORT_ANSWER"; text: string; points: number; sectionLabel: string | null; studentAnswer: string | null; correctAnswer: string | null; isCorrect: boolean | null };
export interface ExamAttemptReview {
  attemptId: string; score: number | null; totalPoints: number;
  canSeeAnswers: boolean; questions: ExamReviewQuestion[];
}

// Dạng admin — bao gồm isCorrect (không được gửi cho học viên trước khi nộp bài)
export interface ExamOptionFull {
  id: string; order: number; text: string; isCorrect: boolean;
  subLabel?: "a" | "b" | "c" | "d" | null; // chỉ có ở TRUE_FALSE_CLUSTER
}
export interface ExamQuestionFull {
  id: string; examId: string; order: number; type: QuestionType; text: string;
  imageUrl?: string | null; points: number; explanation?: string | null;
  sectionLabel?: string | null;
  sectionMinutes?: number | null;
  options: ExamOptionFull[];
}
export interface ExamQuestionInput {
  text: string; type?: QuestionType; imageUrl?: string; points?: number; explanation?: string;
  sectionLabel?: string | null;
  sectionMinutes?: number | null;
  options: { text: string; isCorrect: boolean; subLabel?: string }[];
}

// Kết quả trích xuất câu hỏi bằng AI — cùng shape với ParseResult của
// examQuestionParser.ts để màn hình review dùng chung không cần sửa.
export interface AiExtractResult {
  questions: ExamQuestionInput[];
  errors: { block: number; message: string }[];
}

// Dạng học viên — KHÔNG có isCorrect, chỉ gửi sau khi nộp bài
export interface ExamOptionPublic {
  id: string; order: number; text: string;
  subLabel?: "a" | "b" | "c" | "d" | null;
}
export interface ExamQuestionPublic {
  id: string; order: number; type: QuestionType; text: string;
  imageUrl?: string | null; points: number;
  sectionLabel?: string | null;
  options: ExamOptionPublic[];
}
export interface ExamSectionWindow {
  label: string | null;
  endsAt: string; // ISO
}
export interface ExamAttemptState {
  attemptId: string;
  status?: string;
  expiresAt?: string;
  sectionWindows?: ExamSectionWindow[] | null;
  questions?: ExamQuestionPublic[];
  answers?: Record<string, string | null>;
  textAnswers?: Record<string, string>;
  boolAnswers?: Record<string, boolean | null>; // key = optionId (mệnh đề con)
  score?: number | null;
  totalPoints?: number;
}
export interface ExamAttemptHistoryItem {
  id: string;
  status: string;
  score: number | null;
  submittedAt: string | null;
  startedAt: string;
}
