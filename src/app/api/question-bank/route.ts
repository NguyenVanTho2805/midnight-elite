import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { validateQuestionOptions, type QuestionType } from "@/lib/examQuestionParser";
import { computeContentHash } from "@/lib/questionDedup";
import { computeBankItemStats } from "@/lib/questionBankStats";
import { initialStatusFor, isReviewer } from "@/lib/questionBankWorkflow";

const DIFFICULTIES = ["NB", "TH", "VD", "VDC"];

// GET /api/question-bank — danh sách ngân hàng câu hỏi, DÙNG CHUNG giữa mọi
// giáo viên (không lọc theo ownerId — khác Course/Exam) — hỗ trợ search + lọc
// theo subject/topic/difficulty/status + phân trang.
//
// Giai đoạn 6 — phạm vi hiển thị theo status: MẶC ĐỊNH (không truyền `mine`)
// chỉ trả về status="approved" — đây là an toàn ngầm định, đảm bảo
// QuestionBankPicker/AutoDrawModal (đều gọi list() không kèm `mine`) không
// bao giờ vô tình rút phải câu draft/pending của người khác vào đề đang
// soạn. Trang quản lý chính (`ngan-hang-cau-hoi/page.tsx`) truyền
// `mine=true` để giáo viên thấy thêm câu NHÁP/CHỜ DUYỆT của chính mình bên
// cạnh mọi câu đã duyệt của người khác. admin_content/admin_super luôn thấy
// TẤT CẢ mọi trạng thái (cần để duyệt hàng chờ), bất kể `mine`.
export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const subject = searchParams.get("subject")?.trim();
  const topic = searchParams.get("topic")?.trim();
  const difficulty = searchParams.get("difficulty")?.trim();
  const status = searchParams.get("status")?.trim();
  const mine = searchParams.get("mine") === "true";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));
  // Giai đoạn 4 — tính usageCount/examCount/correctRatio chỉ khi cần (trang
  // danh sách chính), KHÔNG bật ở QuestionBankPicker (chọn câu lúc soạn đề)
  // để tránh cõng thêm truy vấn cho luồng không cần thống kê.
  const withStats = searchParams.get("withStats") === "true";

  const statusScope = isReviewer(auth.adminRole)
    ? {}
    : mine
      ? { OR: [{ status: "approved" }, { ownerId: auth.userId }] }
      : { status: "approved" };

  const where = {
    ...statusScope,
    ...(search ? { text: { contains: search, mode: "insensitive" as const } } : {}),
    ...(subject ? { subject } : {}),
    ...(topic ? { topic } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(status ? { status } : {}),
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

    if (!withStats) return NextResponse.json({ items, total });

    const statsById = await computeBankItemStats(items.map(i => i.id));
    const itemsWithStats = items.map(item => ({
      ...item,
      ...(statsById.get(item.id) ?? { usageCount: 0, examCount: 0, correctRatio: null }),
    }));
    return NextResponse.json({ items: itemsWithStats, total });
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
        status: initialStatusFor(auth.adminRole),
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
