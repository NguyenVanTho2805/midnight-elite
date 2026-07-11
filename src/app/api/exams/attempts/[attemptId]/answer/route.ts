import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { finalizeAttempt } from "@/lib/examGrading";

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

    if (attempt.status === "in_progress" && attempt.expiresAt.getTime() <= Date.now()) {
      await finalizeAttempt(attempt.id, { status: "expired", at: attempt.expiresAt });
      return NextResponse.json({ error: "Đã hết giờ làm bài" }, { status: 409 });
    }
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ error: "Bài thi đã kết thúc" }, { status: 409 });
    }

    const { questionId, optionId } = await req.json() as { questionId?: string; optionId?: string };
    if (!questionId || !optionId) {
      return NextResponse.json({ error: "Thiếu questionId/optionId" }, { status: 400 });
    }

    const option = await prisma.examOption.findFirst({ where: { id: optionId, questionId } });
    if (!option) return NextResponse.json({ error: "Đáp án không hợp lệ" }, { status: 400 });

    await prisma.examAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: { attemptId, questionId, optionId },
      update: { optionId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[PATCH /api/exams/attempts/[attemptId]/answer]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
