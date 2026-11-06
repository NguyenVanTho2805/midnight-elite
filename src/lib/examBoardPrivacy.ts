// NO-0511 — ai được thấy TÊN ĐẦY ĐỦ trên bảng điểm một đề (GET /api/exam-results?examId=). THUẦN: không DB.
// Quản trị (admin_super / admin_content) luôn; gia sư (adminRole "teacher") chỉ khi là chủ đề hoặc chủ lớp gắn với đề; học sinh / người khác: tên che.
import type { SessionPayload } from "@/lib/session";

export function canSeeFullStudentNames(
  session: Pick<SessionPayload, "userId" | "role" | "adminRole">,
  exam: { examOwnerId: string | null; courseOwnerId: string | null },
): boolean {
  if (session.role !== "admin") return false;
  if (session.adminRole === "admin_super" || session.adminRole === "admin_content") return true;
  if (session.adminRole !== "teacher") return false;
  return exam.examOwnerId === session.userId || exam.courseOwnerId === session.userId;
}
