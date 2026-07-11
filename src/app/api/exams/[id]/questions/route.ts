import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/exams/[id]/questions — admin: danh sách câu hỏi kèm đáp án đúng
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  try {
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
    const { text, imageUrl, points, explanation, options } = body as {
      text?: string;
      imageUrl?: string;
      points?: number;
      explanation?: string;
      options?: { text: string; isCorrect: boolean }[];
    };

    if (!text?.trim()) {
      return NextResponse.json({ error: "Thiếu nội dung câu hỏi" }, { status: 400 });
    }
    if (!Array.isArray(options) || options.length < 2) {
      return NextResponse.json({ error: "Cần ít nhất 2 đáp án" }, { status: 400 });
    }
    if (!options.some(o => o.isCorrect)) {
      return NextResponse.json({ error: "Phải có ít nhất 1 đáp án đúng" }, { status: 400 });
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

    const maxOrder = await prisma.examQuestion.aggregate({
      where: { examId },
      _max: { order: true },
    });

    const question = await prisma.examQuestion.create({
      data: {
        id: `eq-${crypto.randomUUID()}`,
        examId,
        order: (maxOrder._max.order ?? 0) + 1,
        text: text.trim(),
        imageUrl: imageUrl?.trim() || null,
        points: typeof points === "number" && points > 0 ? points : 1,
        explanation: explanation?.trim() || null,
        options: {
          create: options.map((o, idx) => ({
            id: `eo-${crypto.randomUUID()}`,
            order: idx,
            text: o.text.trim(),
            isCorrect: !!o.isCorrect,
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
