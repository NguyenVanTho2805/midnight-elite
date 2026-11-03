// TUT-003 — "câu hỏi của học sinh trong lớp chưa trả lời" cho Hộp việc của gia sư. MỘT định nghĩa dùng chung cho bộ đếm (tutorDashboard) và dòng chi tiết
// (tutorInboxServer) để số đỏ trên thanh module luôn khớp với số dòng trong Hộp việc. Không Prisma ở đây (chỉ kiểu) để test được.
//
// Một câu hỏi tính là CHƯA TRẢ LỜI khi: thuộc lớp của gia sư; kind="question"; đã hiện (published, chưa xoá mềm); không do chính gia sư đăng;
// CHƯA có trả lời nào (chưa xoá) của gia sư; và chưa có câu trả lời được chọn đúng (acceptedReplyId trống — học sinh khác đã giải xong thì thôi).
// Dòng chi tiết chỉ có tiêu đề câu hỏi + tên lớp + giờ hỏi, KHÔNG có tên em (như yêu cầu vào lớp).
import type { Prisma } from "@/generated/prisma/client";

export function unansweredQuestionWhere(tutorId: string): Prisma.ThreadWhereInput {
  return {
    kind: "question",
    status: "published",
    deletedAt: null,
    acceptedReplyId: null,
    course: { ownerId: tutorId },
    authorId: { not: tutorId },
    replies: { none: { authorId: tutorId, deletedAt: null } },
  };
}

/** Chữ một dòng việc: tiêu đề câu hỏi (rút gọn) — thiếu tiêu đề (bài cũ) thì lấy đầu nội dung. */
export function questionRowTitle(q: { title: string | null; content: string }, max = 80): string {
  const t = (q.title && q.title.trim() ? q.title : q.content).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
