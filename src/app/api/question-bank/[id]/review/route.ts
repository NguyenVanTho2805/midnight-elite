import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { isReviewer } from "@/lib/questionBankWorkflow";

// POST /api/question-bank/[id]/review — Giai đoạn 6: admin_content/admin_super
// duyệt hoặc từ chối 1 câu đang "pending". KHÔNG dùng requireOwnedResource ở
// đây — quyền duyệt không phụ thuộc chủ sở hữu (kể cả chủ sở hữu của chính
// câu đó cũng không được tự duyệt bài mình, chỉ admin_content/admin_super
// mới được — enforce bằng isReviewer() thay vì ownsResource()).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;
  if (!isReviewer(auth.adminRole)) {
    return NextResponse.json({ error: "Chỉ quản trị viên mới được duyệt câu hỏi" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.questionBankItem.findUnique({ where: { id }, select: { status: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "Câu này không ở trạng thái chờ duyệt" }, { status: 409 });
    }

    const { decision, reason } = await req.json() as { decision?: "approve" | "reject"; reason?: string };
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ error: "Quyết định không hợp lệ" }, { status: 400 });
    }
    if (decision === "reject" && !reason?.trim()) {
      return NextResponse.json({ error: "Cần nhập lý do từ chối" }, { status: 400 });
    }

    const item = await prisma.questionBankItem.update({
      where: { id },
      data: decision === "approve"
        ? { status: "approved", rejectionReason: null, reviewedBy: auth.userId, reviewedAt: new Date() }
        : { status: "draft", rejectionReason: reason!.trim(), reviewedBy: auth.userId, reviewedAt: new Date() },
      include: { options: { orderBy: { order: "asc" } }, owner: { select: { name: true } } },
    });

    return NextResponse.json(item);
  } catch (e) {
    console.error("[POST /api/question-bank/[id]/review]", e);
    return NextResponse.json({ error: "Duyệt câu hỏi thất bại" }, { status: 400 });
  }
}
