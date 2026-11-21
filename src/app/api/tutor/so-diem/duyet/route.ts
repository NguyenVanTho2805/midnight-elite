// SCL-C (Q5) — POST (form) duyệt điểm TỰ KHAI (ExamResult.pendingReview=true, đề Azota): resultId, action = duyet | sua | tu-choi, score (khi sửa).
// Chỉ chủ lớp / Chủ nhiệm của lớp gắn đề (courseAccess `score.write`): lớp khác 403, không có 404. Kết quả ⇒ 303 về sổ điểm của lớp kèm ?ghi=.
// Duyệt / sửa ⇒ pendingReview=false: điểm vào báo cáo tháng và bảng xếp hạng của đề. Từ chối ⇒ xoá dòng điểm (học sinh khai lại được, lại chờ duyệt).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess } from "@/lib/courseAccessServer";
import { logAction } from "@/lib/auditLog";
import { isReviewAction, parseScoreInput, soDiemBack } from "@/lib/soDiem";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const fd = await req.formData().catch(() => null);
  // SCL-G-SD: mo=<ô> từ hộp "bài nộp" ⇒ điểm sửa sai thì mở lại đúng ô; xong thì đóng hộp.
  const back = (req: NextRequest, courseId: string, ghi: string) =>
    NextResponse.redirect(new URL(soDiemBack(courseId, ghi, fd?.get("mo")), req.url), { status: 303, headers: NO_STORE });
  const resultId = fd?.get("resultId"), action = fd?.get("action");
  if (typeof resultId !== "string" || !resultId || resultId.length > 100 || !isReviewAction(action)) return NextResponse.json({ error: "Thiếu điểm cần duyệt" }, { status: 400, headers: NO_STORE });
  const r = await prisma.examResult.findUnique({ where: { id: resultId }, select: { id: true, userId: true, examId: true, score: true, pendingReview: true, exam: { select: { courseId: true, totalPoints: true } } } });
  if (!r || !r.exam.courseId) return NextResponse.json({ error: "Không tìm thấy điểm" }, { status: 404, headers: NO_STORE });
  const acc = await requireCourseAccess(r.exam.courseId, "score.write");
  if (!acc.ok) return acc.res;
  const courseId = r.exam.courseId;
  if (!r.pendingReview) return back(req, courseId, "khong-co");

  if (action === "tu-choi") {
    const gone = await prisma.$transaction(async tx => {
      const d = await tx.examResult.deleteMany({ where: { id: r.id, pendingReview: true } });
      if (d.count) await tx.exam.updateMany({ where: { id: r.examId, participants: { gt: 0 } }, data: { participants: { decrement: 1 } } });
      return d.count;
    });
    if (!gone) return back(req, courseId, "khong-co");
    await logAction(acc.session.userId, "exam_result.reject", "ExamResult", r.id, { examId: r.examId, userId: r.userId });
    return back(req, courseId, "da-tu-choi");
  }
  let score = r.score;
  if (action === "sua") {
    const s = parseScoreInput(fd?.get("score"), r.exam.totalPoints);
    if (s === null) return back(req, courseId, "diem-sai");
    score = s;
  }
  // Chỉ dòng còn chờ duyệt (học sinh khai lại giữa chừng thì dòng vẫn chờ, nhưng điểm mới — không ghi đè bằng số cũ của form).
  const u = await prisma.examResult.updateMany({ where: { id: r.id, pendingReview: true, ...(action === "duyet" ? { score: r.score } : {}) }, data: { score, pendingReview: false } });
  if (!u.count) return back(req, courseId, "khong-co");
  await logAction(acc.session.userId, "exam_result.approve", "ExamResult", r.id, { examId: r.examId, userId: r.userId, edited: action === "sua" });
  return back(req, courseId, action === "sua" ? "da-sua" : "da-duyet");
}
