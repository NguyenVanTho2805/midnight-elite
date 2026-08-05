import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedResource, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// PUT /api/assignments/[id] — sửa bài tập. Chỉ chủ sở hữu (hoặc
// admin_content/admin_super) được sửa.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await prisma.assignment.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy bài tập" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, existing.ownerId);
    if (isNextResponse(auth)) return auth;

    const body = await req.json();
    const { title, instructions, fileUrl, fileName, maxPoints, dueDate } = body as {
      title?: string; instructions?: string; fileUrl?: string; fileName?: string;
      maxPoints?: number; dueDate?: string | null;
    };
    if (!title?.trim()) {
      return NextResponse.json({ error: "Thiếu tiêu đề bài tập" }, { status: 400 });
    }

    const assignment = await prisma.assignment.update({
      where: { id },
      data: {
        title: title.trim(),
        instructions: instructions?.trim() || null,
        fileUrl: fileUrl?.trim() || null,
        fileName: fileName?.trim() || null,
        maxPoints: typeof maxPoints === "number" && maxPoints > 0 ? maxPoints : 10,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    return NextResponse.json(assignment);
  } catch (e) {
    console.error("[PUT /api/assignments/[id]]", id, e);
    return NextResponse.json({ error: "Cập nhật bài tập thất bại" }, { status: 400 });
  }
}

// DELETE /api/assignments/[id] — xoá bài tập (cascade xoá luôn bài học viên
// đã nộp — chấp nhận được vì đây là hành động chủ động của giáo viên, không
// phải xoá âm thầm).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await prisma.assignment.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy bài tập" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, existing.ownerId);
    if (isNextResponse(auth)) return auth;

    await prisma.assignment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/assignments/[id]]", id, e);
    return NextResponse.json({ error: "Xoá bài tập thất bại" }, { status: 400 });
  }
}
