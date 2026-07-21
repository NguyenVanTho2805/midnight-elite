import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { computeContentHash } from "@/lib/questionDedup";
import { isReviewer } from "@/lib/questionBankWorkflow";
import { findSimilarBankItems } from "@/lib/questionBankSimilarity";
import { findSemanticBankItems } from "@/lib/embeddings";

// POST /api/question-bank/check-duplicate — 3 tầng chạy TUẦN TỰ, tầng sau
// chỉ chạy khi tầng trước không tìm thấy gì (mỗi tầng đắt hơn tầng trước,
// không lãng phí khi đã có câu trả lời chắc chắn hơn): Cấp 1 (trùng Y HỆT,
// hash) → Cấp 2 (trùng GIỐNG CHUỖI, pg_trgm) → Cấp 3 (trùng GIỐNG NGHĨA,
// embedding — 1 lệnh gọi Gemini + 1 truy vấn vector, tầng tốn kém nhất). Cả
// 3 cấp đều thu hẹp theo subject+topic trước khi so (đúng tối ưu bắt buộc
// trong tài liệu thiết kế).
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

    const similar = match
      ? []
      : await findSimilarBankItems({ text, subject: subject.trim(), topic: topic.trim(), userId: auth.userId, isReviewer: isReviewer(auth.adminRole) });

    const semantic = match || similar.length > 0
      ? []
      : await findSemanticBankItems({ text, subject: subject.trim(), topic: topic.trim(), userId: auth.userId, isReviewer: isReviewer(auth.adminRole) });

    return NextResponse.json({ match, similar, semantic });
  } catch (e) {
    console.error("[POST /api/question-bank/check-duplicate]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
