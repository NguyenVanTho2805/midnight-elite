import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { validateQuestionOptions, type ParsedQuestion } from "@/lib/examQuestionParser";

// POST /api/exams/[id]/questions/bulk-create — admin: tạo hàng loạt câu hỏi ĐÃ CẤU TRÚC SẴN
// (không parse text — dùng khi client đã parse + cho admin review/sửa trước, ví dụ lúc tạo đề thi mới)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (!ownsResource(auth, exam.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
    }

    const { items } = await req.json() as { items?: ParsedQuestion[] };
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Thiếu danh sách câu hỏi" }, { status: 400 });
    }

    for (const [idx, item] of items.entries()) {
      if (!item.text?.trim()) {
        return NextResponse.json({ error: `Câu ${idx + 1}: thiếu nội dung` }, { status: 400 });
      }
      const optionsErr = validateQuestionOptions(item.type ?? "MC", item.options ?? []);
      if (optionsErr) return NextResponse.json({ error: `Câu ${idx + 1}: ${optionsErr}` }, { status: 400 });
    }

    const maxOrder = await prisma.examQuestion.aggregate({
      where: { examId },
      _max: { order: true },
    });
    let nextOrder = (maxOrder._max.order ?? 0) + 1;

    await prisma.$transaction(
      items.map(q => {
        const order = nextOrder++;
        const type = q.type ?? "MC";
        return prisma.examQuestion.create({
          data: {
            id: `eq-${crypto.randomUUID()}`,
            examId,
            order,
            type,
            text: q.text.trim(),
            points: typeof q.points === "number" && q.points > 0 ? q.points : 1,
            options: {
              create: q.options.map((o, idx) => ({
                id: `eo-${crypto.randomUUID()}`,
                order: idx,
                text: o.text.trim(),
                isCorrect: !!o.isCorrect,
                subLabel: o.subLabel ?? null,
              })),
            },
          },
        });
      })
    );

    return NextResponse.json({ created: items.length });
  } catch (e) {
    console.error("[POST /api/exams/[id]/questions/bulk-create]", e);
    return NextResponse.json({ error: "Tạo hàng loạt câu hỏi thất bại" }, { status: 400 });
  }
}
