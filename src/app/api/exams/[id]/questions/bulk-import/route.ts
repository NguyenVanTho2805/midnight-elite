import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { parseBulkText } from "@/lib/examQuestionParser";

// POST /api/exams/[id]/questions/bulk-import — admin: nhập hàng loạt câu hỏi từ text
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  try {
    const { text } = await req.json() as { text?: string };
    if (!text?.trim()) {
      return NextResponse.json({ error: "Thiếu nội dung để nhập" }, { status: 400 });
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

    const { questions, errors } = parseBulkText(text);

    if (questions.length === 0) {
      return NextResponse.json({ imported: 0, errors }, { status: 400 });
    }

    const maxOrder = await prisma.examQuestion.aggregate({
      where: { examId },
      _max: { order: true },
    });
    let nextOrder = (maxOrder._max.order ?? 0) + 1;

    await prisma.$transaction(
      questions.map(q => {
        const order = nextOrder++;
        return prisma.examQuestion.create({
          data: {
            id: `eq-${crypto.randomUUID()}`,
            examId,
            order,
            text: q.text,
            points: 1,
            options: {
              create: q.options.map((o, idx) => ({
                id: `eo-${crypto.randomUUID()}`,
                order: idx,
                text: o.text,
                isCorrect: o.isCorrect,
              })),
            },
          },
        });
      })
    );

    return NextResponse.json({ imported: questions.length, errors });
  } catch (e) {
    console.error("[POST /api/exams/[id]/questions/bulk-import]", e);
    return NextResponse.json({ error: "Nhập hàng loạt thất bại" }, { status: 400 });
  }
}
