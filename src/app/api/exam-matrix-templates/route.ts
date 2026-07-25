import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import type { QuestionType } from "@/lib/examQuestionParser";

const DIFFICULTIES = ["NB", "TH", "VD", "VDC"];
const QUESTION_TYPES: QuestionType[] = ["MC", "ESSAY", "TRUE_FALSE_CLUSTER", "SHORT_ANSWER"];

interface MatrixCellInput {
  topic?: string;
  difficulty?: string;
  type?: string | null;
  count?: number;
}

function validateCells(cells: unknown): string | null {
  if (!Array.isArray(cells) || cells.length === 0) return "Ma trận cần ít nhất 1 dòng chủ đề";
  for (const c of cells as MatrixCellInput[]) {
    if (!c.topic?.trim()) return "Thiếu chủ đề ở 1 dòng ma trận";
    if (!c.difficulty || !DIFFICULTIES.includes(c.difficulty)) return "Độ khó không hợp lệ ở 1 dòng ma trận";
    if (c.type != null && !QUESTION_TYPES.includes(c.type as QuestionType)) return "Loại câu không hợp lệ ở 1 dòng ma trận";
    if (!c.count || c.count <= 0) return "Số câu phải lớn hơn 0 ở 1 dòng ma trận";
  }
  return null;
}

// GET /api/exam-matrix-templates — danh sách ma trận đề đã lưu, DÙNG CHUNG
// giữa mọi giáo viên (không lọc theo ownerId, giống Ngân hàng câu hỏi) — lọc
// theo ?subject= nếu có.
export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const subject = new URL(req.url).searchParams.get("subject")?.trim();

  try {
    const items = await prisma.examMatrixTemplate.findMany({
      where: subject ? { subject } : {},
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { name: true } } },
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[GET /api/exam-matrix-templates]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

// POST /api/exam-matrix-templates — lưu 1 ma trận mới, ownerId luôn là người
// đang đăng nhập.
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { name, subject, cells } = body as { name?: string; subject?: string; cells?: unknown };

    if (!name?.trim()) return NextResponse.json({ error: "Thiếu tên ma trận" }, { status: 400 });
    if (!subject?.trim()) return NextResponse.json({ error: "Thiếu môn học" }, { status: 400 });
    const cellsErr = validateCells(cells);
    if (cellsErr) return NextResponse.json({ error: cellsErr }, { status: 400 });

    const item = await prisma.examMatrixTemplate.create({
      data: { name: name.trim(), subject: subject.trim(), cells: cells as object, ownerId: auth.userId },
      include: { owner: { select: { name: true } } },
    });
    return NextResponse.json(item);
  } catch (e) {
    console.error("[POST /api/exam-matrix-templates]", e);
    return NextResponse.json({ error: "Lưu ma trận thất bại" }, { status: 400 });
  }
}
