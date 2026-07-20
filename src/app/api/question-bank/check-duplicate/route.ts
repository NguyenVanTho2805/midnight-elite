import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { computeContentHash } from "@/lib/questionDedup";

// POST /api/question-bank/check-duplicate — Giai đoạn 3.5 Cấp 1 (trùng Y HỆT).
// Tra theo hash nội dung đã chuẩn hoá, LUÔN thu hẹp theo subject+topic trước
// (đúng tối ưu bắt buộc trong tài liệu thiết kế — tránh so toàn bộ ngân hàng).
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const { text, subject, topic } = await req.json() as { text?: string; subject?: string; topic?: string };
    if (!text?.trim() || !subject?.trim() || !topic?.trim()) {
      return NextResponse.json({ error: "Thiếu nội dung/môn học/chủ đề" }, { status: 400 });
    }

    const match = await prisma.questionBankItem.findFirst({
      where: { subject: subject.trim(), topic: topic.trim(), contentHash: computeContentHash(text) },
      include: { options: { orderBy: { order: "asc" } }, owner: { select: { name: true } } },
    });

    return NextResponse.json({ match });
  } catch (e) {
    console.error("[POST /api/question-bank/check-duplicate]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
