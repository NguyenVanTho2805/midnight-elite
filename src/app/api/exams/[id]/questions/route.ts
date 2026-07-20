import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { validateQuestionOptions, type QuestionType } from "@/lib/examQuestionParser";

// GET /api/exams/[id]/questions — admin: danh sách câu hỏi kèm đáp án đúng
export async function GET(
  _req: NextRequest,
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

    const questions = await prisma.examQuestion.findMany({
      where: { examId },
      orderBy: { order: "asc" },
      include: { options: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json(questions);
  } catch (e) {
    console.error("[GET /api/exams/[id]/questions]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

// POST /api/exams/[id]/questions — admin: tạo 1 câu hỏi + options lồng nhau
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  try {
    const body = await req.json();
    const { text, type, imageUrl, points, explanation, sectionLabel, options } = body as {
      text?: string;
      type?: QuestionType;
      imageUrl?: string;
      points?: number;
      explanation?: string;
      sectionLabel?: string | null;
      options?: { text: string; isCorrect: boolean; subLabel?: string }[];
    };

    if (!text?.trim()) {
      return NextResponse.json({ error: "Thiếu nội dung câu hỏi" }, { status: 400 });
    }
    const questionType = type ?? "MC";
    const optionsErr = validateQuestionOptions(questionType, options ?? []);
    if (optionsErr) return NextResponse.json({ error: optionsErr }, { status: 400 });

    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (!ownsResource(auth, exam.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
    }

    const maxOrder = await prisma.examQuestion.aggregate({
      where: { examId },
      _max: { order: true },
    });

    const question = await prisma.examQuestion.create({
      data: {
        id: `eq-${crypto.randomUUID()}`,
        examId,
        order: (maxOrder._max.order ?? 0) + 1,
        type: questionType,
        text: text.trim(),
        imageUrl: imageUrl?.trim() || null,
        points: typeof points === "number" && points > 0 ? points : 1,
        explanation: explanation?.trim() || null,
        sectionLabel: sectionLabel?.trim() || null,
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

    return NextResponse.json(question, { status: 201 });
  } catch (e) {
    console.error("[POST /api/exams/[id]/questions]", e);
    return NextResponse.json({ error: "Tạo câu hỏi thất bại" }, { status: 400 });
  }
}
