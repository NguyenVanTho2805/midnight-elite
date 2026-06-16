// ─── API fetch helpers ────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
};

// ─── API types (mirrors Prisma models) ───────────────────────────────────────

export interface CourseFull {
  id: string; adminId: number;
  name: string; adminName: string; shortTitle: string;
  category: string; instructor: string; teacherAvatar: string;
  openDate: string; types: string[];
  tag?: string | null; tagColor?: string | null;
  introVideo?: string | null;
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
  participants: number; active: boolean; createdAt: string;
}
