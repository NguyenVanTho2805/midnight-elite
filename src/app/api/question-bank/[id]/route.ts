import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedResource, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { validateQuestionOptions, type QuestionType } from "@/lib/examQuestionParser";
import { computeContentHash } from "@/lib/questionDedup";

const DIFFICULTIES = ["NB", "TH", "VD", "VDC"];

// PUT /api/question-bank/[id] — sửa câu hỏi trong ngân hàng, thay toàn bộ
// options. Chỉ chủ sở hữu (hoặc admin_super/admin_content) được sửa — xem
// requireOwnedResource trong src/lib/auth-guard.ts.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await prisma.questionBankItem.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, existing.ownerId);
    if (isNextResponse(auth)) return auth;

    const body = await req.json();
    const { text, type, imageUrl, points, explanation, subject, topic, difficulty, tags, options } = body as {
      text?: string;
      type?: QuestionType;
      imageUrl?: string;
      points?: number;
      explanation?: string;
      subject?: string;
      topic?: string;
      difficulty?: string;
      tags?: string[];
      options?: { text: string; isCorrect: boolean; subLabel?: string }[];
    };

    if (!text?.trim()) {
      return NextResponse.json({ error: "Thiếu nội dung câu hỏi" }, { status: 400 });
    }
    if (!subject?.trim() || !topic?.trim()) {
      return NextResponse.json({ error: "Thiếu môn học hoặc chủ đề" }, { status: 400 });
    }
    if (!difficulty || !DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json({ error: "Độ khó không hợp lệ" }, { status: 400 });
    }
    const questionType = type ?? "MC";
    const optionsErr = validateQuestionOptions(questionType, options ?? []);
    if (optionsErr) return NextResponse.json({ error: optionsErr }, { status: 400 });

    const item = await prisma.$transaction(async (tx) => {
      await tx.questionBankOption.deleteMany({ where: { itemId: id } });
      return tx.questionBankItem.update({
        where: { id },
        data: {
          type: questionType,
          text: text.trim(),
          imageUrl: imageUrl?.trim() || null,
          points: typeof points === "number" && points > 0 ? points : 1,
          explanation: explanation?.trim() || null,
          subject: subject.trim(),
          topic: topic.trim(),
          difficulty,
          tags: tags && tags.length > 0 ? tags : undefined,
          contentHash: computeContentHash(text),
          options: {
            create: (options ?? []).map((o, idx) => ({
              order: idx,
              text: o.text.trim(),
              isCorrect: !!o.isCorrect,
              subLabel: o.subLabel ?? null,
            })),
          },
        },
        include: { options: { orderBy: { order: "asc" } }, owner: { select: { name: true } } },
      });
    });

    return NextResponse.json(item);
  } catch (e) {
    console.error("[PUT /api/question-bank/[id]]", e);
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });
    }
    return NextResponse.json({ error: "Cập nhật câu hỏi thất bại" }, { status: 400 });
  }
}

// DELETE /api/question-bank/[id] — xoá câu hỏi khỏi ngân hàng. Chỉ chủ sở
// hữu (hoặc admin_super/admin_content) được xoá.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await prisma.questionBankItem.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, existing.ownerId);
    if (isNextResponse(auth)) return auth;

    await prisma.questionBankItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DELETE /api/question-bank/[id]]", id, msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
