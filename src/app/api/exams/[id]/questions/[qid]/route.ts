import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { validateQuestionOptions, type QuestionType } from "@/lib/examQuestionParser";

// PUT /api/exams/[id]/questions/[qid] — admin: sửa câu hỏi, thay toàn bộ options
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId, qid } = await params;

  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (!ownsResource(auth, exam.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
    }

    const body = await req.json();
    const { text, type, imageUrl, points, explanation, sectionLabel, sectionMinutes, options } = body as {
      text?: string;
      type?: QuestionType;
      imageUrl?: string;
      points?: number;
      explanation?: string;
      sectionLabel?: string | null;
      sectionMinutes?: number | null;
      options?: { text: string; isCorrect: boolean; subLabel?: string }[];
    };

    if (!text?.trim()) {
      return NextResponse.json({ error: "Thiếu nội dung câu hỏi" }, { status: 400 });
    }
    const questionType = type ?? "MC";
    const optionsErr = validateQuestionOptions(questionType, options ?? []);
    if (optionsErr) return NextResponse.json({ error: optionsErr }, { status: 400 });

    const question = await prisma.$transaction(async (tx) => {
      await tx.examOption.deleteMany({ where: { questionId: qid } });
      return tx.examQuestion.update({
        where: { id: qid },
        data: {
          type: questionType,
          text: text.trim(),
          imageUrl: imageUrl?.trim() || null,
          points: typeof points === "number" && points > 0 ? points : 1,
          explanation: explanation?.trim() || null,
          sectionLabel: sectionLabel?.trim() || null,
          sectionMinutes: sectionMinutes ?? null,
          options: {
            create: (options ?? []).map((o, idx) => ({
              id: `eo-${crypto.randomUUID()}`,
              order: idx,
              text: o.text.trim(),
              isCorrect: !!o.isCorrect,
              subLabel: o.subLabel ?? null,
            })),
          },
        },
        include: { options: { orderBy: { order: "asc" } } },
      });
    });

    return NextResponse.json(question);
  } catch (e) {
    console.error("[PUT /api/exams/[id]/questions/[qid]]", e);
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });
    }
    return NextResponse.json({ error: "Cập nhật câu hỏi thất bại" }, { status: 400 });
  }
}

// DELETE /api/exams/[id]/questions/[qid] — admin: xóa câu hỏi
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId, qid } = await params;

  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (!ownsResource(auth, exam.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
    }

    await prisma.examQuestion.delete({ where: { id: qid } });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DELETE /api/exams/[id]/questions/[qid]]", qid, msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
