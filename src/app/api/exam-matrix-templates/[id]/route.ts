import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedResource, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// DELETE /api/exam-matrix-templates/[id] — chủ sở hữu hoặc admin_content/
// admin_super mới xoá được (ownsResource, giống mọi tài nguyên có ownerId
// khác trong dự án). Không có PUT — sửa ma trận nghĩa là lưu 1 bản mới, giữ
// tối giản đúng tinh thần các tính năng phụ khác của Ngân hàng câu hỏi.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const item = await prisma.examMatrixTemplate.findUnique({ where: { id }, select: { ownerId: true } });
  if (!item) return NextResponse.json({ error: "Không tìm thấy ma trận" }, { status: 404 });

  const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, item.ownerId);
  if (isNextResponse(auth)) return auth;

  try {
    await prisma.examMatrixTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/exam-matrix-templates/[id]]", e);
    return NextResponse.json({ error: "Xoá ma trận thất bại" }, { status: 400 });
  }
}
