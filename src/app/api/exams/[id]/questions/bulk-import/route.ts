import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
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

    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (!ownsResource(auth, exam.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
    }

    const { questions, errors } = parseBulkText(text);

    if (questions.length === 0) {
      // Không phải lỗi server — trả 200 kèm danh sách lỗi để client hiển thị
      // rõ lý do (status 400 sẽ bị apiFetch nuốt thành "Request failed" chung chung)
      return NextResponse.json({ imported: 0, errors });
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
            type: q.type,
            text: q.text,
            imageUrl: q.imageUrl?.trim() || null,
            points: 1,
            sectionLabel: q.sectionLabel?.trim() || null,
            options: {
              create: q.options.map((o, idx) => ({
                id: `eo-${crypto.randomUUID()}`,
                order: idx,
                text: o.text,
                isCorrect: o.isCorrect,
                subLabel: o.subLabel ?? null,
              })),
            },
          },
        });
      }),
      { timeout: 30000 }
    );

    return NextResponse.json({ imported: questions.length, errors });
  } catch (e) {
    console.error("[POST /api/exams/[id]/questions/bulk-import]", e);
    return NextResponse.json({ error: "Nhập hàng loạt thất bại" }, { status: 400 });
  }
}
