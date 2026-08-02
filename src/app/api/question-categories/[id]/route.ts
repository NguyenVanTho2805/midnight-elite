import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// true nếu `candidateId` nằm trong chuỗi tổ tiên của `id` (kể cả chính nó) —
// dùng để chặn di chuyển 1 đầu mục vào bên trong chính nhánh con của nó
// (sẽ tạo vòng lặp vô hạn trong cây).
async function isDescendantOrSelf(id: string, candidateId: string): Promise<boolean> {
  let current: string | null = candidateId;
  while (current) {
    if (current === id) return true;
    const node: { parentId: string | null } | null = await prisma.questionCategory.findUnique({
      where: { id: current }, select: { parentId: true },
    });
    current = node?.parentId ?? null;
  }
  return false;
}

// PATCH /api/question-categories/[id] — đổi tên/di chuyển sang cha khác/sắp
// thứ tự. Không có khái niệm chủ sở hữu — ai có quyền MANAGE_CURRICULUM đều
// sửa được (dùng chung giữa mọi giáo viên).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    const existing = await prisma.questionCategory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy đầu mục" }, { status: 404 });

    const { name, parentId, sortOrder } = await req.json() as {
      name?: string; parentId?: string | null; sortOrder?: number;
    };

    if (parentId !== undefined && parentId !== null) {
      if (await isDescendantOrSelf(id, parentId)) {
        return NextResponse.json({ error: "Không thể di chuyển đầu mục vào chính nhánh con của nó" }, { status: 400 });
      }
    }

    const item = await prisma.questionCategory.update({
      where: { id },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(parentId !== undefined ? { parentId: parentId || null } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });
    return NextResponse.json(item);
  } catch (e) {
    console.error("[PATCH /api/question-categories/[id]]", e);
    return NextResponse.json({ error: "Cập nhật đầu mục thất bại" }, { status: 400 });
  }
}

// DELETE /api/question-categories/[id] — chặn xoá nếu còn đầu mục con hoặc
// còn câu hỏi gắn vào (tránh xoá nhầm cả nhánh cây hoặc làm câu hỏi mồ côi).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    const [childCount, itemCount] = await Promise.all([
      prisma.questionCategory.count({ where: { parentId: id } }),
      prisma.questionBankItem.count({ where: { categoryId: id } }),
    ]);
    if (childCount > 0) {
      return NextResponse.json({ error: `Còn ${childCount} đầu mục con — xoá hết trước` }, { status: 409 });
    }
    if (itemCount > 0) {
      return NextResponse.json({ error: `Còn ${itemCount} câu hỏi gắn vào đầu mục này — chuyển/xoá hết trước` }, { status: 409 });
    }

    await prisma.questionCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy đầu mục" }, { status: 404 });
    }
    console.error("[DELETE /api/question-categories/[id]]", id, e);
    return NextResponse.json({ error: "Xoá đầu mục thất bại" }, { status: 400 });
  }
}
