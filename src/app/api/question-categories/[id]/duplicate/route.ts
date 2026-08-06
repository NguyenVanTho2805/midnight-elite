import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { initialStatusFor } from "@/lib/questionBankWorkflow";
import { copyBankItemEmbedding } from "@/lib/embeddings";

export const maxDuration = 60;

// POST /api/question-categories/[id]/duplicate — nhân bản cả 1 "ngân hàng"
// (đầu mục gốc): toàn bộ cây con + mọi câu hỏi bên trong, sang 1 đầu mục gốc
// mới. Chỉ áp dụng ở cấp gốc (không copy 1 nhánh con lẻ) — khớp đúng vị trí
// nút "Copy ngân hàng" trong thiết kế (luôn ở cấp ngân hàng, không phải cấp
// đầu mục con). Câu hỏi nhân bản luôn đi qua đúng quy trình duyệt như tạo
// mới (ownerId = người bấm copy, status theo initialStatusFor) — KHÔNG bỏ
// qua duyệt dù bản gốc đã "approved".
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    const source = await prisma.questionCategory.findUnique({ where: { id } });
    if (!source) return NextResponse.json({ error: "Không tìm thấy ngân hàng" }, { status: 404 });
    if (source.parentId !== null) {
      return NextResponse.json({ error: "Chỉ copy được cả ngân hàng (đầu mục gốc)" }, { status: 400 });
    }

    const { name } = await req.json().catch(() => ({})) as { name?: string };
    const newRootName = name?.trim() || `${source.name} (bản sao)`;

    const allCats = await prisma.questionCategory.findMany();
    const byParent = new Map<string, typeof allCats>();
    for (const c of allCats) {
      const key = c.parentId ?? "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }

    const result = await prisma.$transaction(async tx => {
      const idMap = new Map<string, string>(); // oldCategoryId -> newCategoryId

      async function cloneSubtree(oldId: string, newParentId: string | null, nameOverride?: string) {
        const old = allCats.find(c => c.id === oldId)!;
        const created = await tx.questionCategory.create({
          data: { name: nameOverride ?? old.name, parentId: newParentId, sortOrder: old.sortOrder },
        });
        idMap.set(oldId, created.id);
        for (const child of byParent.get(oldId) ?? []) {
          await cloneSubtree(child.id, created.id);
        }
      }
      await cloneSubtree(source.id, null, newRootName);

      const items = await tx.questionBankItem.findMany({
        where: { categoryId: { in: [...idMap.keys()] } },
        include: { options: { orderBy: { order: "asc" } } },
      });

      const itemIdMap: { oldId: string; newId: string }[] = [];
      for (const item of items) {
        const created = await tx.questionBankItem.create({
          data: {
            type: item.type, text: item.text, imageUrl: item.imageUrl,
            points: item.points, explanation: item.explanation,
            categoryId: idMap.get(item.categoryId)!,
            difficulty: item.difficulty, tags: item.tags ?? undefined,
            contentHash: item.contentHash, // text không đổi, copy thẳng
            ownerId: auth.userId, status: initialStatusFor(auth.adminRole),
            options: {
              create: item.options.map(o => ({ order: o.order, text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel })),
            },
          },
        });
        itemIdMap.push({ oldId: item.id, newId: created.id });
      }

      return { newRootId: idMap.get(source.id)!, itemIdMap };
    }, { timeout: 60000 });

    // Best-effort — copy thẳng vector embedding, không gọi lại Gemini.
    await Promise.all(result.itemIdMap.map(({ oldId, newId }) => copyBankItemEmbedding(oldId, newId)));

    return NextResponse.json({ id: result.newRootId, name: newRootName });
  } catch (e) {
    console.error("[POST /api/question-categories/[id]/duplicate]", id, e);
    return NextResponse.json({ error: "Copy ngân hàng thất bại" }, { status: 400 });
  }
}
