import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

const EMPTY_DIFFICULTY_COUNTS = { NB: 0, TH: 0, VD: 0, VDC: 0 };
const EMPTY_TYPE_COUNTS = { MC: 0, ESSAY: 0, TRUE_FALSE_CLUSTER: 0, SHORT_ANSWER: 0 };

// GET /api/question-categories — toàn bộ cây đầu mục (danh sách PHẲNG, client
// tự dựng cây/breadcrumb qua parentId) — dùng chung giữa mọi giáo viên, không
// có khái niệm chủ sở hữu (khác QuestionBankItem/Course/Exam). Kèm `count`
// (số câu hỏi gắn TRỰC TIẾP vào đầu mục đó, chưa gồm con cháu), `difficultyCounts`
// (cùng ý nghĩa, tách theo NB/TH/VD/VDC) và `typeCounts` (tách theo dạng câu
// hỏi) — client tự cộng dồn lên cây để hiện tổng số câu + phân bổ như
// "PHẦN 1 (1036 câu)" kiểu Azota, không cần route riêng vì cây thường chỉ
// vài chục-vài trăm node.
export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const [items, counts, difficultyCounts, typeCounts] = await Promise.all([
      prisma.questionCategory.findMany({
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.questionBankItem.groupBy({ by: ["categoryId"], _count: true }),
      prisma.questionBankItem.groupBy({ by: ["categoryId", "difficulty"], _count: true }),
      prisma.questionBankItem.groupBy({ by: ["categoryId", "type"], _count: true }),
    ]);
    const countByCategory = new Map(counts.map(c => [c.categoryId, c._count]));
    const difficultyByCategory = new Map<string, typeof EMPTY_DIFFICULTY_COUNTS>();
    for (const row of difficultyCounts) {
      const entry = difficultyByCategory.get(row.categoryId) ?? { ...EMPTY_DIFFICULTY_COUNTS };
      if (row.difficulty in entry) entry[row.difficulty as keyof typeof EMPTY_DIFFICULTY_COUNTS] = row._count;
      difficultyByCategory.set(row.categoryId, entry);
    }
    const typeByCategory = new Map<string, typeof EMPTY_TYPE_COUNTS>();
    for (const row of typeCounts) {
      const entry = typeByCategory.get(row.categoryId) ?? { ...EMPTY_TYPE_COUNTS };
      if (row.type in entry) entry[row.type as keyof typeof EMPTY_TYPE_COUNTS] = row._count;
      typeByCategory.set(row.categoryId, entry);
    }
    const shaped = items.map(item => ({
      ...item,
      count: countByCategory.get(item.id) ?? 0,
      difficultyCounts: difficultyByCategory.get(item.id) ?? EMPTY_DIFFICULTY_COUNTS,
      typeCounts: typeByCategory.get(item.id) ?? EMPTY_TYPE_COUNTS,
    }));
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
