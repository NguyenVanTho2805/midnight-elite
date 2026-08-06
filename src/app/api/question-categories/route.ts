import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/question-categories — toàn bộ cây đầu mục (danh sách PHẲNG, client
// tự dựng cây/breadcrumb qua parentId) — dùng chung giữa mọi giáo viên, không
// có khái niệm chủ sở hữu (khác QuestionBankItem/Course/Exam). Kèm `count`
// (số câu hỏi gắn TRỰC TIẾP vào đầu mục đó, chưa gồm con cháu) — client tự
// cộng dồn lên cây để hiện tổng số câu như "PHẦN 1 (1036 câu)" kiểu Azota,
// không cần route riêng vì cây thường chỉ vài chục-vài trăm node.
export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const [items, counts] = await Promise.all([
      prisma.questionCategory.findMany({
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.questionBankItem.groupBy({ by: ["categoryId"], _count: true }),
    ]);
    const countByCategory = new Map(counts.map(c => [c.categoryId, c._count]));
    const shaped = items.map(item => ({ ...item, count: countByCategory.get(item.id) ?? 0 }));
    return NextResponse.json(shaped);
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
