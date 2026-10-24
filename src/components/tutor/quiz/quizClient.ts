// Dùng chung cho các màn quiz của gia sư (trình duyệt): kiểu dữ liệu trả từ /api/tutor/quiz/* và hàm gọi API.
import type { QuizQuestionType, RubricRow } from "@/lib/quizQuestion";

export interface QuizMeta {
  id: string; code: string; title: string; courseId: string | null; courseName: string | null;
  dateKey: string | null; time: string; durationMin: number;
  isDraft: boolean; active: boolean; status: "draft" | "upcoming" | "available" | "completed";
  versionNo: number; rootExamId: string | null; supersededById: string | null; versionNote: string | null;
  answerVisibility: "never" | "after_submit" | "after_exam_ends"; hideAnswerForWrong: boolean; showLeaderboard: boolean; hasPassword: boolean;
  totalPoints: number; questionCount: number; attemptCount: number; canEditInPlace: boolean;
}
export interface QuizOption { id?: string; text: string; isCorrect: boolean; subLabel: string | null }
export interface QuizQ {
  id: string; order: number; type: QuizQuestionType; text: string; points: number; imageUrl: string | null; explanation: string | null; hint: string | null;
  studentGuide: string | null; graderGuide: string | null; rubric: RubricRow[] | null; sectionLabel: string | null; options: QuizOption[];
}
export interface QuizDetail { exam: QuizMeta; questions: QuizQ[]; courses: { id: string; name: string }[] }

export interface ApiResult<T> { ok: boolean; status: number; data: T | null; error: string | null; code: string | null }

/** Gọi API JSON. Không ném lỗi: mạng đứt → { ok: false, status: 0 } với câu tiếng Việt cho người dùng. */
export async function qfetch<T = unknown>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method, credentials: "same-origin", cache: "no-store",
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null) as (T & { error?: string; code?: string }) | null;
    if (!res.ok) return { ok: false, status: res.status, data: null, error: json?.error ?? "Chưa thực hiện được. Thử lại sau ít phút.", code: json?.code ?? null };
    return { ok: true, status: res.status, data: json as T, error: null, code: null };
  } catch {
    return { ok: false, status: 0, data: null, error: "Mất kết nối. Kiểm tra mạng rồi thử lại.", code: null };
  }
}

export const QUIZ_BASE = "/lop-cua-toi/bai-tap/quiz";
export const quizHref = (id: string) => `${QUIZ_BASE}/${id}`;
export const versionsHref = (id: string) => `${QUIZ_BASE}/${id}/phien-ban`;
export const IMPORT_HREF = "/lop-cua-toi/bai-tap/nhap-de";

export const IMPORT_MAX_BYTES = 4 * 1024 * 1024; // giới hạn của API trích câu hỏi (body Vercel Serverless)
export const IMPORT_MIME = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png", "image/webp"] as const;
export const IMPORT_ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png,.webp";
export const mimeOfFile = (f: File): string => {
  if (f.type) return f.type;
  const n = f.name.toLowerCase();
  return n.endsWith(".pdf") ? "application/pdf" : n.endsWith(".docx") ? IMPORT_MIME[1] : n.endsWith(".png") ? "image/png" : n.endsWith(".webp") ? "image/webp" : /\.jpe?g$/.test(n) ? "image/jpeg" : "";
};
/** Câu báo lỗi nếu tệp không dùng được, hoặc null. */
export function fileProblem(f: File): string | null {
  if (!(IMPORT_MIME as readonly string[]).includes(mimeOfFile(f))) return `Tệp "${f.name}" chưa đúng định dạng. KiN đọc PDF, Word (.docx) và ảnh (JPG, PNG, WebP).`;
  if (f.size > IMPORT_MAX_BYTES) return `Tệp "${f.name}" nặng hơn 4 MB. Cô tách đề thành các tệp nhỏ hơn rồi nhập từng phần.`;
  if (f.size === 0) return `Tệp "${f.name}" trống.`;
  return null;
}
export const sizeText = (b: number): string => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
