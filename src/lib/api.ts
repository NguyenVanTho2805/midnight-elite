// ─── API fetch helpers ────────────────────────────────────────────────────────

// Luôn tương đối (same-origin) — admin.* và domain chính là 2 origin khác nhau
// từ khi tách domain (src/middleware.ts). Dùng NEXT_PUBLIC_APP_URL ở đây sẽ đẩy
// request sang origin khác, làm mất cookie phiên đăng nhập (credentials:
// "same-origin" không gửi cookie cross-origin) dù request tới cùng 1 deployment.
const BASE = "";

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
    saveToBank: (examId: string, qid: string, data: SaveToBankInput) =>
      apiFetch<QuestionBankItemFull>(
        `/api/exams/${examId}/questions/${qid}/save-to-bank`,
        { method: "POST", body: JSON.stringify(data) }
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
  // ── Ngân hàng câu hỏi (dùng chung giữa các giáo viên) ────────────────────
  questionBank: {
    list: (params?: { search?: string; categoryId?: string; difficulty?: string; status?: BankItemStatus; mine?: boolean; page?: number; pageSize?: number; withStats?: boolean }) => {
      const qs = params
        ? Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
        : [];
      return apiFetch<{ items: QuestionBankItemFull[]; total: number }>(
        `/api/question-bank${qs.length ? "?" + new URLSearchParams(qs) : ""}`
      );
    },
    create: (data: QuestionBankItemInput) =>
      apiFetch<QuestionBankItemFull>("/api/question-bank", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: QuestionBankItemInput) =>
      apiFetch<QuestionBankItemFull>(`/api/question-bank/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/question-bank/${id}`, { method: "DELETE" }),
    checkDuplicate: (data: { text: string; categoryId: string }) =>
      apiFetch<{
        match: QuestionBankItemFull | null;
        similar: { item: QuestionBankItemFull; similarity: number }[];
        semantic: { item: QuestionBankItemFull; similarity: number }[];
      }>("/api/question-bank/check-duplicate", { method: "POST", body: JSON.stringify(data) }),
    submit: (id: string) =>
      apiFetch<QuestionBankItemFull>(`/api/question-bank/${id}/submit`, { method: "PATCH" }),
    review: (id: string, data: { decision: "approve" | "reject"; reason?: string }) =>
      apiFetch<QuestionBankItemFull>(`/api/question-bank/${id}/review`, { method: "POST", body: JSON.stringify(data) }),
    copy: (ids: string[], targetCategoryId: string) =>
      apiFetch<{ copied: number }>("/api/question-bank/copy", { method: "POST", body: JSON.stringify({ ids, targetCategoryId }) }),
  },
  // ── Cây đầu mục ngân hàng câu hỏi (không giới hạn số tầng) ───────────────
  questionCategories: {
    list: () => apiFetch<QuestionCategoryFull[]>("/api/question-categories"),
    create: (data: { name: string; parentId?: string | null }) =>
      apiFetch<QuestionCategoryFull>("/api/question-categories", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; parentId?: string | null; sortOrder?: number }) =>
      apiFetch<QuestionCategoryFull>(`/api/question-categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/question-categories/${id}`, { method: "DELETE" }),
    duplicate: (id: string, name?: string) =>
      apiFetch<{ id: string; name: string }>(`/api/question-categories/${id}/duplicate`, {
        method: "POST", body: JSON.stringify({ name }),
      }),
    duplicates: (id: string) =>
      apiFetch<{ groups: DuplicateGroup[] }>(`/api/question-categories/${id}/duplicates`),
  },
  // ── Ngân hàng đề thi (lưu trữ file gốc, tách câu riêng theo yêu cầu) ─────
  examFiles: {
    list: () => apiFetch<ExamFileFull[]>("/api/exam-files"),
    upload: async (file: File, folderId?: string | null): Promise<ExamFileFull> => {
      const formData = new FormData();
      formData.append("file", file);
      if (folderId) formData.append("folderId", folderId);
      const res = await fetch("/api/exam-files", { method: "POST", credentials: "same-origin", body: formData });
      if (!res.ok) {
        const fallback = `Upload thất bại (${res.status})`;
        const err = await res.json().catch(() => ({ error: fallback }));
        throw new Error(err.error || fallback);
      }
      return res.json() as Promise<ExamFileFull>;
    },
    move: (id: string, folderId: string | null) =>
      apiFetch<ExamFileFull>(`/api/exam-files/${id}`, { method: "PATCH", body: JSON.stringify({ folderId }) }),
    remove: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/exam-files/${id}`, { method: "DELETE" }),
    extract: (id: string) =>
      apiFetch<AiExtractResult>(`/api/exam-files/${id}/extract`, { method: "POST" }),
  },
  // ── Thư mục Ngân hàng đề thi (1 cấp phẳng, có chủ sở hữu) ────────────────
  examFileFolders: {
    list: () => apiFetch<ExamFileFolderFull[]>("/api/exam-file-folders"),
    create: (name: string) =>
      apiFetch<ExamFileFolderFull>("/api/exam-file-folders", { method: "POST", body: JSON.stringify({ name }) }),
    update: (id: string, name: string) =>
      apiFetch<ExamFileFolderFull>(`/api/exam-file-folders/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    remove: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/exam-file-folders/${id}`, { method: "DELETE" }),
  },
  // ── Bài tập tự nộp (song song với Lesson.azotaUrl, không thay thế) ───────
  assignments: {
    listByLesson: (lessonId: string) =>
      apiFetch<AssignmentFull[]>(`/api/lessons/${lessonId}/assignments`),
    create: (lessonId: string, data: AssignmentInput) =>
      apiFetch<AssignmentFull>(`/api/lessons/${lessonId}/assignments`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: AssignmentInput) =>
      apiFetch<AssignmentFull>(`/api/assignments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/assignments/${id}`, { method: "DELETE" }),
    submit: (id: string, data: { fileUrl: string; fileName?: string }) =>
      apiFetch<AssignmentSubmissionFull>(`/api/assignments/${id}/submit`, { method: "POST", body: JSON.stringify(data) }),
    listSubmissions: (id: string) =>
      apiFetch<AssignmentSubmissionFull[]>(`/api/assignments/${id}/submissions`),
    grade: (id: string, submissionId: string, data: { score: number; comment?: string }) =>
      apiFetch<AssignmentSubmissionFull>(`/api/assignments/${id}/submissions/${submissionId}/grade`, { method: "PATCH", body: JSON.stringify(data) }),
    // ── Bài tập "làm trên web" (mode: interactive) ──────────────────────────
    getAnswer: (id: string) => apiFetch<AssignmentAnswerData>(`/api/assignments/${id}/answer`),
    saveAnswer: (id: string, data: { questionId: string; optionId?: string | null; textAnswer?: string | null }) =>
      apiFetch<{ success: boolean }>(`/api/assignments/${id}/answer`, { method: "PATCH", body: JSON.stringify(data) }),
    gradeQuestion: (id: string, questionId: string, data: { userId: string; pointsAwarded: number; teacherComment?: string }) =>
      apiFetch<AssignmentAnswerRow>(`/api/assignments/${id}/questions/${questionId}/grade`, { method: "PATCH", body: JSON.stringify(data) }),
    getResults: (id: string) => apiFetch<AssignmentResultsData>(`/api/assignments/${id}/results`),
  },
  // ── Khung giờ học cố định hàng tuần (TKB) ─────────────────────────────────
  classSchedules: {
    listByCourse: (courseId: string) =>
      apiFetch<ClassScheduleFull[]>(`/api/courses/${courseId}/class-schedules`),
    create: (courseId: string, data: ClassScheduleInput) =>
      apiFetch<ClassScheduleFull>(`/api/courses/${courseId}/class-schedules`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<ClassScheduleInput> & { active?: boolean }) =>
      apiFetch<ClassScheduleFull>(`/api/class-schedules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/class-schedules/${id}`, { method: "DELETE" }),
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
  courseId?: string | null; courseName?: string | null; price?: number | null;
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
  sourceBankItemId?: string | null;
  options: ExamOptionFull[];
}
export interface ExamQuestionInput {
  text: string; type?: QuestionType; imageUrl?: string; points?: number; explanation?: string;
  sectionLabel?: string | null;
  sectionMinutes?: number | null;
  sourceBankItemId?: string | null;
  // Mức độ AI gợi ý khi tách câu từ Ngân hàng đề thi (xem ParsedQuestion.difficulty
  // trong examQuestionParser.ts) — không dùng ở luồng tạo/sửa đề thi thông thường.
  difficulty?: Difficulty | null;
  // Gợi ý Chương/Bài AI suy luận được — cùng phạm vi sử dụng với difficulty ở
  // trên, xem ParsedQuestion.suggestedChapter/suggestedLesson.
  suggestedChapter?: string;
  suggestedLesson?: string;
  options: { text: string; isCorrect: boolean; subLabel?: string }[];
}

// Kết quả trích xuất câu hỏi bằng AI — cùng shape với ParseResult của
// examQuestionParser.ts để màn hình review dùng chung không cần sửa.
export interface AiExtractResult {
  questions: ExamQuestionInput[];
  errors: { block: number; message: string }[];
}

// Ngân hàng câu hỏi — độc lập với ExamQuestion (xem ghi chú ở
// QuestionBankItem trong prisma/schema.prisma: không share row trực tiếp).
export type Difficulty = "NB" | "TH" | "VD" | "VDC";
// Giai đoạn 6 — quy trình duyệt, xem ghi chú ở QuestionBankItem.status trong
// prisma/schema.prisma.
export type BankItemStatus = "draft" | "pending" | "approved";
export interface QuestionBankOptionFull {
  id: string; order: number; text: string; isCorrect: boolean;
  subLabel?: "a" | "b" | "c" | "d" | null;
}
// Cây đầu mục ngân hàng câu hỏi — không giới hạn số tầng, client tự dựng cây/
// đường dẫn (breadcrumb) từ danh sách phẳng này qua parentId, xem
// src/app/api/question-categories/route.ts.
export interface QuestionCategoryFull {
  id: string; name: string; parentId: string | null; sortOrder: number;
  // Số câu hỏi gắn TRỰC TIẾP vào đầu mục này (chưa gồm con cháu) — cộng dồn
  // lên cây ở client để có tổng số câu kiểu "PHẦN 1 (1036 câu)".
  count: number;
  // Cùng ý nghĩa với count nhưng tách theo mức độ — cộng dồn lên cây để hiện
  // phân bổ NB/TH/VD/VDC mỗi Chương/Bài.
  difficultyCounts: Record<Difficulty, number>;
  // Cùng ý nghĩa với count nhưng tách theo dạng câu hỏi — cộng dồn lên cây để
  // hiện phân bổ MC/Tự luận/Đúng-Sai/Trả lời ngắn mỗi Chương/Bài.
  typeCounts: Record<QuestionType, number>;
}

// Kết quả quét trùng lặp hàng loạt 1 ngân hàng, xem
// src/app/api/question-categories/[id]/duplicates/route.ts — "exact" có thể
// nhiều hơn 2 câu (cùng nhóm hash), "fuzzy"/"semantic" luôn đúng 2 câu (so
// theo cặp, không gom cụm).
export interface DuplicateItem {
  id: string; text: string; categoryPath: string; status: BankItemStatus;
}
export interface DuplicateGroup {
  tier: "exact" | "fuzzy" | "semantic";
  similarity: number;
  items: DuplicateItem[];
}

// Ngân hàng đề thi — chỉ lưu trữ file gốc, xem src/app/api/exam-files/route.ts.
export interface ExamFileFull {
  id: string; fileName: string; fileUrl: string; fileType: string;
  ownerId: string | null; owner: { name: string } | null;
  folderId: string | null; folder: { id: string; name: string } | null;
  createdAt: string;
}

// Thư mục Ngân hàng đề thi — 1 cấp phẳng, xem src/app/api/exam-file-folders/route.ts.
export interface ExamFileFolderFull {
  id: string; name: string; ownerId: string | null; createdAt: string;
}

// Bài tập tự nộp — song song với Lesson.azotaUrl, xem prisma/schema.prisma.
export interface AssignmentFull {
  id: string; lessonId: string; title: string; instructions: string | null;
  fileUrl: string | null; fileName: string | null; maxPoints: number;
  dueDate: string | null; ownerId: string | null; createdAt: string;
  submissionCount: number;
  // "file" (mặc định, nộp file) | "interactive" (làm trực tiếp trên web, xem AssignmentQuestion).
  mode: string; questionCount: number;
  // Chỉ có giá trị khi người gọi là học viên (xem GET /api/lessons/[lessonId]/assignments) — undefined với admin.
  mySubmission?: AssignmentSubmissionFull | null;
}
export interface AssignmentQuestionInput {
  text: string; type?: "MC" | "ESSAY"; points?: number; imageUrl?: string;
  options: { text: string; isCorrect?: boolean }[];
}
export interface AssignmentInput {
  title: string; instructions?: string; fileUrl?: string; fileName?: string;
  maxPoints?: number; dueDate?: string | null;
  // Chỉ gửi lúc TẠO bài tập "interactive" — không sửa được câu hỏi sau khi tạo
  // (xem ghi chú ở AssignmentForm), nên PUT không bao giờ cần 2 field này.
  mode?: string; questions?: AssignmentQuestionInput[];
}
// Bài làm của học viên cho 1 bài tập "interactive" — xem GET
// /api/assignments/[id]/answer. isCorrect/option.isCorrect/explanation đều
// null khi chưa khoá (locked=false) — server chủ động ẩn, không phải thiếu dữ liệu.
export interface AssignmentAnswerView {
  id: string; order: number; text: string; imageUrl: string | null; points: number; type: "MC" | "ESSAY";
  explanation: string | null;
  options: { id: string; order: number; text: string; isCorrect: boolean | null }[];
  myAnswer: {
    optionId: string | null; textAnswer: string | null; isCorrect: boolean | null;
    pointsAwarded: number | null; teacherComment: string | null;
  } | null;
}
export interface AssignmentAnswerData {
  locked: boolean; dueDate: string | null;
  completion: { answered: number; total: number };
  questions: AssignmentAnswerView[];
}
export interface AssignmentAnswerRow {
  id: string; questionId: string; userId: string; optionId: string | null; textAnswer: string | null;
  isCorrect: boolean | null; pointsAwarded: number | null; teacherComment: string | null; updatedAt: string;
}
// Bảng chấm/theo dõi tiến độ cho giáo viên — xem GET /api/assignments/[id]/results.
export interface AssignmentResultAnswer {
  optionId: string | null; textAnswer: string | null; isCorrect: boolean | null;
  pointsAwarded: number | null; teacherComment: string | null;
}
export interface AssignmentResultsData {
  dueDate: string | null; totalPoints: number;
  questions: {
    id: string; order: number; text: string; type: "MC" | "ESSAY"; points: number;
    options: { id: string; text: string; isCorrect: boolean }[];
  }[];
  students: {
    userId: string; name: string; studentId: string | null;
    completion: { answered: number; total: number }; score: number;
    answers: Record<string, AssignmentResultAnswer>;
  }[];
}
// Khung giờ học cố định hàng tuần của 1 khoá (TKB) — xem prisma/schema.prisma ClassSchedule.
export interface ClassScheduleFull {
  id: string; courseId: string;
  dayOfWeek: number; startTime: string; endTime: string;
  note: string | null; active: boolean; createdAt: string;
}
export interface ClassScheduleInput {
  dayOfWeek: number; startTime: string; endTime: string; note?: string;
}

export interface AssignmentSubmissionFull {
  id: string; assignmentId: string; userId: string;
  fileUrl: string; fileName: string | null; submittedAt: string;
  score: number | null; comment: string | null; gradedAt: string | null; gradedBy: string | null;
  // Chỉ có khi admin gọi listSubmissions (include user).
  user?: { id: string; name: string; studentId: number | null };
}
export interface QuestionBankItemFull {
  id: string; type: QuestionType; text: string;
  imageUrl?: string | null; points: number; explanation?: string | null;
  categoryId: string; difficulty: Difficulty; tags: string[] | null;
  ownerId: string | null; owner: { name: string } | null;
  createdAt: string; updatedAt: string;
  options: QuestionBankOptionFull[];
  status: BankItemStatus;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  // Giai đoạn 4 — chỉ có khi gọi questionBank.list({ withStats: true }).
  usageCount?: number;
  examCount?: number;
  correctRatio?: number | null;
}
export interface QuestionBankItemInput {
  type: QuestionType; text: string; imageUrl?: string; points?: number; explanation?: string;
  categoryId: string; difficulty: Difficulty; tags?: string[];
  options: { text: string; isCorrect: boolean; subLabel?: string }[];
}
// Lưu 1 câu có sẵn trong đề vào ngân hàng (hồi tố) — chỉ cần phân loại, nội
// dung/đáp án server tự copy từ ExamQuestion hiện có, xem save-to-bank/route.ts.
export interface SaveToBankInput {
  categoryId: string; difficulty: Difficulty; tags?: string[];
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
