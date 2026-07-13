import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { finalizeAttempt } from "@/lib/examGrading";

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

    if (attempt.status === "in_progress" && attempt.expiresAt.getTime() <= Date.now()) {
      await finalizeAttempt(attempt.id, { status: "expired", at: attempt.expiresAt });
      return NextResponse.json({ error: "Đã hết giờ làm bài" }, { status: 409 });
    }
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ error: "Bài thi đã kết thúc" }, { status: 409 });
    }

    const { optionId, answerTrue } = await req.json() as { optionId?: string; answerTrue?: boolean };
    if (!optionId || typeof answerTrue !== "boolean") {
      return NextResponse.json({ error: "Thiếu optionId/answerTrue" }, { status: 400 });
    }

    const option = await prisma.examOption.findFirst({
      where: { id: optionId, question: { type: "TRUE_FALSE_CLUSTER" } },
    });
    if (!option) return NextResponse.json({ error: "Ý trả lời không hợp lệ" }, { status: 400 });

    await prisma.examAnswerBoolean.upsert({
      where: { attemptId_optionId: { attemptId, optionId } },
      create: { attemptId, optionId, answerTrue },
      update: { answerTrue },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[PATCH /api/exams/attempts/[attemptId]/answer-bool]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
