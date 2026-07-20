import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { validateQuestionOptions, type QuestionType } from "@/lib/examQuestionParser";
import { computeContentHash } from "@/lib/questionDedup";

const DIFFICULTIES = ["NB", "TH", "VD", "VDC"];

// GET /api/question-bank — danh sách ngân hàng câu hỏi, DÙNG CHUNG giữa mọi
// giáo viên (không lọc theo ownerId — khác Course/Exam) — hỗ trợ search + lọc
// theo subject/topic/difficulty + phân trang.
export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const subject = searchParams.get("subject")?.trim();
  const topic = searchParams.get("topic")?.trim();
  const difficulty = searchParams.get("difficulty")?.trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  const where = {
    ...(search ? { text: { contains: search, mode: "insensitive" as const } } : {}),
    ...(subject ? { subject } : {}),
    ...(topic ? { topic } : {}),
    ...(difficulty ? { difficulty } : {}),
  };

  try {
    const [items, total] = await Promise.all([
      prisma.questionBankItem.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          options: { orderBy: { order: "asc" } },
          owner: { select: { name: true } },
        },
      }),
      prisma.questionBankItem.count({ where }),
    ]);
    return NextResponse.json({ items, total });
  } catch (e) {
    console.error("[GET /api/question-bank]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

// POST /api/question-bank — thêm câu hỏi mới vào ngân hàng, ownerId luôn là
// người đang đăng nhập (không cho set người khác qua body).
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
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

    const item = await prisma.questionBankItem.create({
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
        ownerId: auth.userId,
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

    return NextResponse.json(item);
  } catch (e) {
    console.error("[POST /api/question-bank]", e);
    return NextResponse.json({ error: "Tạo câu hỏi thất bại" }, { status: 400 });
  }
}
