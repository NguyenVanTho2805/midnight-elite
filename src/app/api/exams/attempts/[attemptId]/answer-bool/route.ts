import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { attemptWriteBlock } from "@/lib/attemptAccess";
import { finalizeAttempt, isSectionLocked } from "@/lib/examGrading";

// PATCH /api/exams/attempts/[attemptId]/answer-bool — autosave 1 ý (a/b/c/d)
// của câu TRUE_FALSE_CLUSTER. Mỗi ý là 1 dòng ExamAnswerBoolean riêng vì học
// sinh trả lời đúng/sai độc lập cho từng ý, không phải chọn 1 trong 4 như MC.
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
    if (blocked) return NextResponse.json({ error: blocked, code: "enrollment_suspended" }, { status: 403 });

    if (attempt.status === "in_progress" && attempt.expiresAt.getTime() <= Date.now()) {
      await finalizeAttempt(attempt.id, { status: "expired", at: attempt.expiresAt });
      return NextResponse.json({ error: "Đã hết giờ làm bài", code: "expired" }, { status: 409 });
    }
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ error: "Bài thi đã kết thúc", code: "finished" }, { status: 409 });
    }

    const { optionId, answerTrue } = await req.json() as { optionId?: string; answerTrue?: boolean };
    if (!optionId || typeof answerTrue !== "boolean") {
      return NextResponse.json({ error: "Thiếu optionId/answerTrue" }, { status: 400 });
    }

    const option = await prisma.examOption.findFirst({
      where: { id: optionId, question: { examId: attempt.examId, type: { in: ["TRUE_FALSE_CLUSTER", "MC_MULTI"] } } }, // BU-04: ý phải thuộc đúng đề của lượt // MC_MULTI (QZ-03): mỗi ô tích là một dòng answerTrue
      include: { question: { select: { sectionLabel: true } } },
    });
    if (!option) return NextResponse.json({ error: "Ý trả lời không hợp lệ" }, { status: 400 });
    if (isSectionLocked(attempt.sectionWindows, option.question.sectionLabel)) {
      return NextResponse.json({ error: "Phần này đã hết giờ", code: "section_locked" }, { status: 409 });
    }

    await prisma.examAnswerBoolean.upsert({
      where: { attemptId_optionId: { attemptId, optionId } },
      create: { attemptId, optionId, answerTrue },
      update: { answerTrue },
    });

    const serverNow = new Date().toISOString();
    return NextResponse.json({ success: true, savedAt: serverNow, serverNow, expiresAt: attempt.expiresAt.toISOString() });
  } catch (e) {
    console.error("[PATCH /api/exams/attempts/[attemptId]/answer-bool]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
