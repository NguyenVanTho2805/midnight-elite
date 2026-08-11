import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedResource, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// PATCH /api/exam-files/[id] — chuyển file sang thư mục khác (hoặc bỏ khỏi
// thư mục nếu folderId: null).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await prisma.examFile.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy file" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, existing.ownerId);
    if (isNextResponse(auth)) return auth;

    const { folderId } = await req.json() as { folderId?: string | null };

    if (folderId) {
      const folder = await prisma.examFileFolder.findUnique({ where: { id: folderId }, select: { ownerId: true } });
      if (!folder) return NextResponse.json({ error: "Thư mục không tồn tại" }, { status: 400 });
      if (!ownsResource(auth, folder.ownerId)) {
        return NextResponse.json({ error: "Bạn không có quyền với thư mục này" }, { status: 403 });
      }
    }

    const item = await prisma.examFile.update({
      where: { id },
      data: { folderId: folderId || null },
      include: { owner: { select: { name: true } }, folder: { select: { id: true, name: true } } },
    });
    return NextResponse.json(item);
  } catch (e) {
    console.error("[PATCH /api/exam-files/[id]]", id, e);
    return NextResponse.json({ error: "Chuyển thư mục thất bại" }, { status: 400 });
  }
}

// DELETE /api/exam-files/[id] — chỉ xoá bản ghi lưu trữ (không đụng tới câu
// hỏi/đề thi đã tách ra trước đó, nếu có — những câu đó đã COPY độc lập vào
// QuestionBankItem/ExamQuestion rồi).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await prisma.examFile.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy file" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, existing.ownerId);
    if (isNextResponse(auth)) return auth;

    await prisma.examFile.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/exam-files/[id]]", id, e);
    return NextResponse.json({ error: "Xoá thất bại" }, { status: 400 });
  }
}
