// ─── API fetch helpers ────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",  // always send session cookie
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
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
  },
  // ── Exam attempts (học viên làm bài) ────────────────────────────────────
  examAttempts: {
    start: (examId: string) =>
      apiFetch<ExamAttemptState>(`/api/exams/${examId}/start`, { method: "POST" }),
    get: (attemptId: string) =>
      apiFetch<ExamAttemptState>(`/api/exams/attempts/${attemptId}`),
    answer: (attemptId: string, questionId: string, optionId: string) =>
      apiFetch<{ success: boolean }>(`/api/exams/attempts/${attemptId}/answer`, {
        method: "PATCH", body: JSON.stringify({ questionId, optionId }),
      }),
    submit: (attemptId: string) =>
      apiFetch<{ score: number; totalPoints: number; rank: number }>(
        `/api/exams/attempts/${attemptId}/submit`,
        { method: "POST" }
      ),
    history: (examId: string) =>
      apiFetch<ExamAttemptHistoryItem[]>(`/api/exams/${examId}/attempts?mine=true`),
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
}

// Dạng admin — bao gồm isCorrect (không được gửi cho học viên trước khi nộp bài)
export interface ExamOptionFull {
  id: string; order: number; text: string; isCorrect: boolean;
}
export interface ExamQuestionFull {
  id: string; examId: string; order: number; text: string;
  imageUrl?: string | null; points: number; explanation?: string | null;
  options: ExamOptionFull[];
}
export interface ExamQuestionInput {
  text: string; imageUrl?: string; points?: number; explanation?: string;
  options: { text: string; isCorrect: boolean }[];
}

// Dạng học viên — KHÔNG có isCorrect, chỉ gửi sau khi nộp bài
export interface ExamOptionPublic {
  id: string; order: number; text: string;
}
export interface ExamQuestionPublic {
  id: string; order: number; text: string;
  imageUrl?: string | null; points: number;
  options: ExamOptionPublic[];
}
export interface ExamAttemptState {
  attemptId: string;
  status?: string;
  expiresAt?: string;
  questions?: ExamQuestionPublic[];
  answers?: Record<string, string | null>;
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
