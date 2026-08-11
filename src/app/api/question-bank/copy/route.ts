import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { initialStatusFor } from "@/lib/questionBankWorkflow";
import { copyBankItemEmbedding } from "@/lib/embeddings";

export const maxDuration = 60;

// POST /api/question-bank/copy — sao chép nhiều câu hỏi lẻ sang 1 đầu mục
// khác (khác "Copy ngân hàng" — copy cả cây). Không giới hạn trạng thái câu
// nguồn (khác "Thêm vào đề" chỉ nhận câu đã duyệt) — bản copy luôn đi qua
// lại đúng quy trình duyệt (status theo initialStatusFor, ownerId = người
// copy), không có rủi ro rò rỉ nội dung chưa duyệt ra chỗ công khai như
// luồng thêm-vào-đề, nên không cần chặn nguồn.
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const { ids, targetCategoryId } = await req.json() as { ids?: string[]; targetCategoryId?: string };
    if (!ids?.length || !targetCategoryId?.trim()) {
      return NextResponse.json({ error: "Thiếu câu hỏi hoặc đầu mục đích" }, { status: 400 });
    }

    const target = await prisma.questionCategory.findUnique({ where: { id: targetCategoryId } });
    if (!target) return NextResponse.json({ error: "Đầu mục đích không tồn tại" }, { status: 400 });

    const items = await prisma.questionBankItem.findMany({
      where: { id: { in: ids } },
      include: { options: { orderBy: { order: "asc" } } },
    });

    const idMap: { oldId: string; newId: string }[] = [];
    for (const item of items) {
      const created = await prisma.questionBankItem.create({
        data: {
          type: item.type, text: item.text, imageUrl: item.imageUrl,
          points: item.points, explanation: item.explanation,
          categoryId: targetCategoryId,
          difficulty: item.difficulty, tags: item.tags ?? undefined,
          contentHash: item.contentHash, // text không đổi, copy thẳng
          ownerId: auth.userId, status: initialStatusFor(auth.adminRole),
          options: {
            create: item.options.map(o => ({ order: o.order, text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel })),
          },
        },
      });
      idMap.push({ oldId: item.id, newId: created.id });
    }

    // Best-effort — copy thẳng vector embedding, không gọi lại Gemini.
    await Promise.all(idMap.map(({ oldId, newId }) => copyBankItemEmbedding(oldId, newId)));

    return NextResponse.json({ copied: idMap.length });
  } catch (e) {
    console.error("[POST /api/question-bank/copy]", e);
    return NextResponse.json({ error: "Sao chép thất bại" }, { status: 400 });
  }
}
