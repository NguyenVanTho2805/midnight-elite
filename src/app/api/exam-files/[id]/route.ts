import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedResource, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

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
