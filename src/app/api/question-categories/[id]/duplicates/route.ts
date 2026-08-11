import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { isReviewer } from "@/lib/questionBankWorkflow";

export const maxDuration = 60;

// Ngưỡng y hệt questionBankSimilarity.ts (Cấp 2) / embeddings.ts (Cấp 3) —
// giữ nguyên không đổi so với luồng chống trùng lúc thêm câu mới.
const FUZZY_THRESHOLD = 0.35;
const SEMANTIC_THRESHOLD = 0.82;
const MAX_PAIRS = 100;

interface DupItem { id: string; text: string; categoryPath: string; status: string }

function collectDescendantIds(rootId: string, allCats: { id: string; parentId: string | null }[]): string[] {
  const byParent = new Map<string, string[]>();
  for (const c of allCats) {
    const key = c.parentId ?? "";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c.id);
  }
  const result: string[] = [rootId];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const childId of byParent.get(current) ?? []) {
      result.push(childId);
      queue.push(childId);
    }
  }
  return result;
}

function categoryPathFor(categoryId: string, allCats: { id: string; name: string; parentId: string | null }[]): string {
  const byId = new Map(allCats.map(c => [c.id, c]));
  const chain: string[] = [];
  let current = byId.get(categoryId);
  while (current) {
    chain.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain.join(" / ");
}

// GET /api/question-categories/[id]/duplicates — quét trùng lặp HÀNG LOẠT
// trong 1 đầu mục + toàn bộ hậu duệ (thường gọi ở cấp ngân hàng) — khác
// check-duplicate/route.ts (so 1 câu MỚI với câu đã có, gọi khi thêm câu).
// Cùng 3 tầng, cùng ngưỡng, chỉ đổi từ "so 1-với-nhiều" sang self-join
// "nhiều-với-nhiều" trong phạm vi đã thu hẹp theo categoryId.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    const root = await prisma.questionCategory.findUnique({ where: { id } });
    if (!root) return NextResponse.json({ error: "Không tìm thấy đầu mục" }, { status: 404 });

    const allCats = await prisma.questionCategory.findMany();
    const scopeIds = collectDescendantIds(id, allCats);

    // Giống hệt statusScope ở check-duplicate/route.ts — không để lộ
    // draft/pending của người khác qua kết quả quét. Tách riêng biến nguyên
    // thuỷ (không dùng thẳng `auth`) vì TS không thu hẹp kiểu qua closure.
    const reviewer = isReviewer(auth.adminRole);
    const userId = auth.userId;
    const statusWhere = reviewer ? {} : { OR: [{ status: "approved" }, { ownerId: userId }] };
    // Bản raw SQL cần biệt danh bảng ("a"/"b") vì self-join — 2 bảng đều có
    // cột status/ownerId, dùng tên cột trần sẽ bị Postgres báo ambiguous.
    function statusSqlFor(alias: "a" | "b") {
      return reviewer
        ? Prisma.sql`TRUE`
        : Prisma.sql`(${Prisma.raw(alias)}."status" = 'approved' OR ${Prisma.raw(alias)}."ownerId" = ${userId})`;
    }

    // ── Tầng 1: y hệt (contentHash) ──────────────────────────────────────
    const hashGroups = await prisma.questionBankItem.groupBy({
      by: ["contentHash"],
      where: { categoryId: { in: scopeIds }, contentHash: { not: null }, ...statusWhere },
      _count: true,
    });
    const dupHashes = hashGroups.filter(g => g._count > 1).map(g => g.contentHash!);
    const exactItems = dupHashes.length > 0 ? await prisma.questionBankItem.findMany({
      where: { contentHash: { in: dupHashes }, categoryId: { in: scopeIds }, ...statusWhere },
      select: { id: true, text: true, categoryId: true, status: true, contentHash: true },
    }) : [];
    const exactByHash = new Map<string, typeof exactItems>();
    for (const item of exactItems) {
      const list = exactByHash.get(item.contentHash!) ?? [];
      list.push(item);
      exactByHash.set(item.contentHash!, list);
    }

    // ── Tầng 2: giống chuỗi (pg_trgm) ─────────────────────────────────────
    const fuzzyRows = await prisma.$queryRaw<{ aId: string; bId: string; sim: number }[]>(Prisma.sql`
      SELECT a."id" AS "aId", b."id" AS "bId", similarity(lower(a."text"), lower(b."text")) AS sim
      FROM "question_bank_items" a
      JOIN "question_bank_items" b ON a."id" < b."id"
      WHERE a."categoryId" = ANY(${scopeIds}) AND b."categoryId" = ANY(${scopeIds})
        AND ${statusSqlFor("a")} AND ${statusSqlFor("b")}
        AND similarity(lower(a."text"), lower(b."text")) > ${FUZZY_THRESHOLD}
      ORDER BY sim DESC
      LIMIT ${MAX_PAIRS}
    `);

    // ── Tầng 3: giống nghĩa (pgvector) ────────────────────────────────────
    const semanticRows = await prisma.$queryRaw<{ aId: string; bId: string; sim: number }[]>(Prisma.sql`
      SELECT a."id" AS "aId", b."id" AS "bId", 1 - (a."embedding" <=> b."embedding") AS sim
      FROM "question_bank_items" a
      JOIN "question_bank_items" b ON a."id" < b."id"
      WHERE a."categoryId" = ANY(${scopeIds}) AND b."categoryId" = ANY(${scopeIds})
        AND a."embedding" IS NOT NULL AND b."embedding" IS NOT NULL
        AND ${statusSqlFor("a")} AND ${statusSqlFor("b")}
        AND 1 - (a."embedding" <=> b."embedding") > ${SEMANTIC_THRESHOLD}
      ORDER BY sim DESC
      LIMIT ${MAX_PAIRS}
    `);

    const pairIds = new Set<string>();
    for (const r of [...fuzzyRows, ...semanticRows]) { pairIds.add(r.aId); pairIds.add(r.bId); }
    const pairItems = pairIds.size > 0 ? await prisma.questionBankItem.findMany({
      where: { id: { in: [...pairIds] } },
      select: { id: true, text: true, categoryId: true, status: true },
    }) : [];
    const pairItemById = new Map(pairItems.map(i => [i.id, i]));

    function toDupItem(item: { id: string; text: string; categoryId: string; status: string }): DupItem {
      return { id: item.id, text: item.text, categoryPath: categoryPathFor(item.categoryId, allCats), status: item.status };
    }

    const groups = [
      ...[...exactByHash.values()].map(items => ({
        tier: "exact" as const, similarity: 1, items: items.map(toDupItem),
      })),
      ...fuzzyRows.flatMap(r => {
        const a = pairItemById.get(r.aId), b = pairItemById.get(r.bId);
        return a && b ? [{ tier: "fuzzy" as const, similarity: r.sim, items: [toDupItem(a), toDupItem(b)] }] : [];
      }),
      ...semanticRows.flatMap(r => {
        const a = pairItemById.get(r.aId), b = pairItemById.get(r.bId);
        return a && b ? [{ tier: "semantic" as const, similarity: r.sim, items: [toDupItem(a), toDupItem(b)] }] : [];
      }),
    ];

    return NextResponse.json({ groups });
  } catch (e) {
    console.error("[GET /api/question-categories/[id]/duplicates]", id, e);
    return NextResponse.json({ error: "Quét trùng lặp thất bại" }, { status: 500 });
  }
}
