import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedResource, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// PATCH /api/exam-file-folders/[id] — đổi tên thư mục.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await prisma.examFileFolder.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy thư mục" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, existing.ownerId);
    if (isNextResponse(auth)) return auth;

    const { name } = await req.json() as { name?: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: "Thiếu tên thư mục" }, { status: 400 });
    }

    const item = await prisma.examFileFolder.update({ where: { id }, data: { name: name.trim() } });
    return NextResponse.json(item);
  } catch (e) {
    console.error("[PATCH /api/exam-file-folders/[id]]", id, e);
    return NextResponse.json({ error: "Đổi tên thất bại" }, { status: 400 });
  }
}

// DELETE /api/exam-file-folders/[id] — chặn xoá nếu còn file trong thư mục
// (tránh mất tổ chức âm thầm — file KHÔNG bị xoá theo dù DB cho phép SetNull,
// buộc phải chuyển/xoá file trước).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await prisma.examFileFolder.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy thư mục" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, existing.ownerId);
    if (isNextResponse(auth)) return auth;

    const fileCount = await prisma.examFile.count({ where: { folderId: id } });
    if (fileCount > 0) {
      return NextResponse.json({ error: `Còn ${fileCount} file trong thư mục — chuyển/xoá hết trước` }, { status: 409 });
    }

    await prisma.examFileFolder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/exam-file-folders/[id]]", id, e);
    return NextResponse.json({ error: "Xoá thư mục thất bại" }, { status: 400 });
  }
}
