import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { computeContentHash } from "@/lib/questionDedup";
import { isReviewer } from "@/lib/questionBankWorkflow";

// POST /api/question-bank/check-duplicate — Giai đoạn 3.5 Cấp 1 (trùng Y HỆT).
// Tra theo hash nội dung đã chuẩn hoá, LUÔN thu hẹp theo subject+topic trước
// (đúng tối ưu bắt buộc trong tài liệu thiết kế — tránh so toàn bộ ngân hàng).
//
// Giai đoạn 6 — chỉ so khớp với câu đã "approved" (công khai) hoặc câu CỦA
// CHÍNH NGƯỜI ĐANG GỌI (mọi trạng thái) — không để lộ sự tồn tại của
// draft/pending của người khác qua cảnh báo trùng (kênh rò rỉ thông tin
// không chủ đích). admin_content/admin_super thấy được mọi trạng thái, kể
// cả không phải của mình, vì họ vốn đã xem được toàn bộ ngân hàng.
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const { text, subject, topic } = await req.json() as { text?: string; subject?: string; topic?: string };
    if (!text?.trim() || !subject?.trim() || !topic?.trim()) {
      return NextResponse.json({ error: "Thiếu nội dung/môn học/chủ đề" }, { status: 400 });
    }

    const statusScope = isReviewer(auth.adminRole) ? {} : { OR: [{ status: "approved" }, { ownerId: auth.userId }] };
    const match = await prisma.questionBankItem.findFirst({
      where: { ...statusScope, subject: subject.trim(), topic: topic.trim(), contentHash: computeContentHash(text) },
      include: { options: { orderBy: { order: "asc" } }, owner: { select: { name: true } } },
    });

    return NextResponse.json({ match });
  } catch (e) {
    console.error("[POST /api/question-bank/check-duplicate]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
