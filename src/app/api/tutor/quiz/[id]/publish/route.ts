// QZ-04 / QZ-07 — PHÁT HÀNH một bản nháp. Chạy lại luật kiểm cho TỪNG câu (câu thiếu đáp án từ bản nháp nhập tệp bị chặn ở đây).
// Nếu bản nháp là phiên bản mới của một quiz đã có: bản đang dùng được đánh dấu "đã bị thay" (supersededById) — câu hỏi, đáp án,
// bài làm và điểm của bản cũ KHÔNG bị đụng; học sinh đang làm dở bản cũ vẫn nộp được vào bản cũ.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { notifyMany } from "@/lib/notify";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { computeExamStatus } from "@/lib/examData";
import { describeValidity } from "@/lib/quizQuestion";
import { keyFromDmy, loadOwnedQuiz, loadQuestions, logChange, supersededBlock, toInput, tutorOwnsCourse } from "@/lib/quizServer";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedQuiz(auth.userId, id);
    if (isNextResponse(got)) return got;
    const sup = supersededBlock(got.exam); if (sup) return sup;
    const e = got.exam;
    if (!e.isDraft) return NextResponse.json({ error: "Quiz này đã phát hành rồi." }, { status: 409 });

    const problems: string[] = [];
    if (!e.title.trim()) problems.push("Quiz chưa có tên.");
    if (!e.courseId || !(await tutorOwnsCourse(auth.userId, e.courseId))) problems.push("Chọn lớp sẽ làm quiz này.");
    if (!keyFromDmy(e.date)) problems.push("Ngày mở bài chưa đúng.");
    const questions = await loadQuestions(id);
    if (questions.length === 0) problems.push("Quiz chưa có câu nào.");
    questions.forEach((q, i) => { const v = describeValidity(toInput(q)); if (!v.ok) problems.push(`Câu ${i + 1}: ${v.message}.`); });
    if (problems.length) return NextResponse.json({ error: "Chưa phát hành được. " + problems[0], problems }, { status: 400 });

    const now = new Date();
    const status = computeExamStatus(e.date, e.time, true);
    await prisma.$transaction(async tx => {
      await tx.exam.update({ where: { id }, data: { isDraft: false, active: true, status } });
      if (e.rootExamId) {
        // Thay bản đang dùng của cùng chuỗi (nếu có). updateMany để không ném lỗi khi chuỗi chưa có bản nào đang dùng.
        await tx.exam.updateMany({
          where: { OR: [{ id: e.rootExamId }, { rootExamId: e.rootExamId }], id: { not: id }, supersededById: null, isDraft: false },
          data: { supersededById: id, supersededAt: now },
        });
      }
      await logChange(tx, { examId: id, rootExamId: e.rootExamId, actorId: auth.userId, kind: e.rootExamId ? "version_published" : "publish", note: e.rootExamId ? `Phát hành phiên bản v${e.versionNo}` : "Phát hành quiz" });
    });

    // Báo học sinh trong lớp khi quiz ĐẦU TIÊN ra mắt (phiên bản mới không báo lại: tránh nhắn một nội dung hai lần). Chữ không có tên học sinh.
    if (!e.rootExamId && e.courseId) {
      const enr = await prisma.enrollment.findMany({ where: { courseId: e.courseId, status: ENROLLMENT_STATUS.ACTIVE }, select: { userId: true } });
      await notifyMany([...new Set(enr.map(x => x.userId))], { type: "exam_new", title: "Có bài kiểm tra mới", message: `Quiz mới trong lớp: "${e.title}"`, link: "/student/thi-thu" });
    }
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("[POST /api/tutor/quiz/[id]/publish]", err);
    return NextResponse.json({ error: "Chưa phát hành được. Thử lại sau ít phút." }, { status: 500 });
  }
}
