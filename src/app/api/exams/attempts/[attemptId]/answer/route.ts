import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { attemptWriteBlock } from "@/lib/attemptAccess";
import { finalizeAttempt, isSectionLocked } from "@/lib/examGrading";

// PATCH /api/exams/attempts/[attemptId]/answer — autosave 1 câu trả lời
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { attemptId } = await params;

  try {
    const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.userId !== session.userId) {
      return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
    }
    // Học sinh bị tạm dừng ở lớp giữa chừng thì không ghi thêm vào lượt (cùng quy tắc với /start).
    const blocked = await attemptWriteBlock(session.userId, attempt.examId);
    if (blocked) return NextResponse.json({ error: blocked.error, code: blocked.code }, { status: 403 });

    if (attempt.status === "in_progress" && attempt.expiresAt.getTime() <= Date.now()) {
      await finalizeAttempt(attempt.id, { status: "expired", at: attempt.expiresAt });
      return NextResponse.json({ error: "Đã hết giờ làm bài", code: "expired" }, { status: 409 });
    }
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ error: "Bài thi đã kết thúc", code: "finished" }, { status: 409 });
    }

    const { questionId, optionId, textAnswer } = await req.json() as {
      questionId?: string; optionId?: string; textAnswer?: string;
    };
    if (!questionId || (!optionId && textAnswer === undefined)) {
      return NextResponse.json({ error: "Thiếu questionId/optionId hoặc textAnswer" }, { status: 400 });
    }

    if (optionId) {
      // Câu MC — chọn 1 trong N đáp án.
      // BU-04: câu phải thuộc ĐÚNG đề của lượt này (không ghi đáp án vào câu của đề khác).
      const option = await prisma.examOption.findFirst({
        where: { id: optionId, questionId, question: { examId: attempt.examId } },
        include: { question: { select: { sectionLabel: true } } },
      });
      if (!option) return NextResponse.json({ error: "Đáp án không hợp lệ" }, { status: 400 });
      if (isSectionLocked(attempt.sectionWindows, option.question.sectionLabel)) {
        return NextResponse.json({ error: "Phần này đã hết giờ", code: "section_locked" }, { status: 409 });
      }

      await prisma.examAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        create: { attemptId, questionId, optionId },
        update: { optionId, textAnswer: null },
      });
    } else {
      // Câu ESSAY (gõ chữ tự do, chờ giáo viên chấm tay) hoặc SHORT_ANSWER
      // (gõ tự do, chấm tự động bằng so khớp text lúc nộp — xem examGrading.ts) —
      // cả 2 đều lưu vào textAnswer, chỉ khác nhau ở cách chấm sau này.
      const question = await prisma.examQuestion.findFirst({
        where: { id: questionId, examId: attempt.examId, type: { in: ["ESSAY", "SHORT_ANSWER"] } },
      });
      if (!question) return NextResponse.json({ error: "Câu hỏi không hợp lệ" }, { status: 400 });
      if (isSectionLocked(attempt.sectionWindows, question.sectionLabel)) {
        return NextResponse.json({ error: "Phần này đã hết giờ", code: "section_locked" }, { status: 409 });
      }

      await prisma.examAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        create: { attemptId, questionId, textAnswer: textAnswer ?? "" },
        update: { textAnswer: textAnswer ?? "", optionId: null },
      });
    }

    // BU-04: giờ máy chủ + hạn lượt để chip lưu hiện giờ máy chủ và đồng hồ tự hiệu chỉnh mỗi lần lưu.
    const serverNow = new Date().toISOString();
    return NextResponse.json({ success: true, savedAt: serverNow, serverNow, expiresAt: attempt.expiresAt.toISOString() });
  } catch (e) {
    console.error("[PATCH /api/exams/attempts/[attemptId]/answer]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
