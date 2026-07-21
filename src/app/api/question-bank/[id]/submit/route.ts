import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedResource, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// PATCH /api/question-bank/[id]/submit — Giai đoạn 6: người soạn (chủ sở
// hữu) gửi 1 câu đang "draft" đi duyệt → "pending". Chỉ hợp lệ từ "draft"
// (không cho gửi lại câu đã "pending"/"approved" — tránh gọi trùng vô nghĩa).
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await prisma.questionBankItem.findUnique({ where: { id }, select: { ownerId: true, status: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, existing.ownerId);
    if (isNextResponse(auth)) return auth;

    if (existing.status !== "draft") {
      return NextResponse.json({ error: "Câu này không ở trạng thái nháp, không thể gửi duyệt" }, { status: 409 });
    }

    const item = await prisma.questionBankItem.update({
      where: { id },
      data: { status: "pending", rejectionReason: null },
      include: { options: { orderBy: { order: "asc" } }, owner: { select: { name: true } } },
    });

    return NextResponse.json(item);
  } catch (e) {
    console.error("[PATCH /api/question-bank/[id]/submit]", e);
    return NextResponse.json({ error: "Gửi duyệt thất bại" }, { status: 400 });
  }
}
