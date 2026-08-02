import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/question-categories — toàn bộ cây đầu mục (danh sách PHẲNG, client
// tự dựng cây/breadcrumb qua parentId) — dùng chung giữa mọi giáo viên, không
// có khái niệm chủ sở hữu (khác QuestionBankItem/Course/Exam).
export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const items = await prisma.questionCategory.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(items);
  } catch (e) {
    console.error("[GET /api/question-categories]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

// POST /api/question-categories — tạo đầu mục mới ở bất kỳ tầng nào
// (parentId null = tầng gốc).
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const { name, parentId } = await req.json() as { name?: string; parentId?: string | null };
    if (!name?.trim()) {
      return NextResponse.json({ error: "Thiếu tên đầu mục" }, { status: 400 });
    }
    if (parentId) {
      const parent = await prisma.questionCategory.findUnique({ where: { id: parentId } });
      if (!parent) return NextResponse.json({ error: "Đầu mục cha không tồn tại" }, { status: 400 });
    }

    const item = await prisma.questionCategory.create({
      data: { name: name.trim(), parentId: parentId || null },
    });
    return NextResponse.json(item);
  } catch (e) {
    console.error("[POST /api/question-categories]", e);
    return NextResponse.json({ error: "Tạo đầu mục thất bại" }, { status: 400 });
  }
}
