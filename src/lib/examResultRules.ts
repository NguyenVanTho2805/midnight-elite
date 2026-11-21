// SCL-A (P1-2, P2-7) — luật THUẦN cho điểm đề: ai xem được bảng điểm / chi tiết đề gắn lớp, điểm tự khai hợp lệ, dòng bảng điểm trả cho người xem.
// Không DB. Phần đọc DB ở src/lib/examResultAccessServer.ts. Test: tools/local-e2e/t-scl-a-lib.ts.
import { canWriteAttempt } from "@/lib/attemptAccess";

export interface ClassExamViewer {
  userId: string;
  role: "student" | "admin";
  adminRole?: string | null;
}
export interface ClassExamFacts {
  courseId: string | null;
  examOwnerId: string | null;
  courseOwnerId: string | null;
  price: number | null;
  /** đồng giảng / bộ môn đang hiệu lực của lớp (đọc lại DB) */
  isHelper: boolean;
  enrollment: { status: string } | null;
  hasGuestAccess: boolean;
}

/** Đề gắn lớp chỉ cho người trong lớp: quản trị, chủ lớp, chủ đề, đồng giảng đang hiệu lực, học sinh đang học (đề thu phí: khách đã được duyệt). Đề không lớp: ai đăng nhập cũng được. */
export function canSeeClassExam(v: ClassExamViewer, f: ClassExamFacts): boolean {
  if (!f.courseId) return true;
  if (v.role === "admin") {
    if (v.adminRole === "admin_super" || v.adminRole === "admin_content") return true;
    if (v.adminRole !== "teacher") return false;
    return f.courseOwnerId === v.userId || f.examOwnerId === v.userId || f.isHelper;
  }
  return canWriteAttempt({ courseId: f.courseId, price: f.price, enrollment: f.enrollment, hasGuestAccess: f.hasGuestAccess });
}

/** Lỗi của điểm TỰ KHAI (đề Azota), hoặc null nếu nhận được. Đề phải đang mở, không nháp; điểm trong [0, tổng điểm của đề]. */
export function selfScoreError(exam: { active: boolean; isDraft: boolean; totalPoints: number }, score: unknown): string | null {
  if (!exam.active || exam.isDraft) return "Đề này chưa mở để nộp điểm.";
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > exam.totalPoints) {
    return `Điểm không hợp lệ (0–${exam.totalPoints}).`;
  }
  return null;
}

/** Dòng bảng điểm trả cho người xem: người không được thấy tên đầy đủ (học sinh…) không nhận userId, chỉ nhận cờ isMe cho dòng của chính mình. */
export function boardRowFor<R extends { userId: string; user: { name: string } }>(row: R, meId: string, fullNames: boolean, mask: (n: string) => string) {
  const { userId, ...rest } = row;
  const isMe = userId === meId;
  if (fullNames) return { ...rest, userId, isMe };
  return { ...rest, user: { name: mask(row.user.name) }, isMe };
}
