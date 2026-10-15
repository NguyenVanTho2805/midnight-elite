// "Hỏi sách": đánh chỉ mục đoạn sách bằng embedding (pgvector) và tìm đoạn gần nhất. Chỉ trong sách của CHÍNH người hỏi.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { embed } from "./ai";

/** Ghi embedding cho các đoạn chưa có (theo lô 50). Trả số đoạn đã xử lý. Lỗi AI → dừng, lần sau làm tiếp. */
export async function embedPendingChunks(bookId: string, limit = 200): Promise<number> {
  let rows: { id: string; text: string }[];
  try {
    rows = await prisma.$queryRaw<{ id: string; text: string }[]>(Prisma.sql`
      SELECT "id", "text" FROM "eng_chunks" WHERE "bookId" = ${bookId} AND "embedding" IS NULL LIMIT ${limit}`);
  } catch (e) { console.error("[english.embedPendingChunks]", e); return 0; }
  let done = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    let vecs: (number[] | null)[];
    try { vecs = await embed(batch.map(r => r.text)); } catch (e) { console.error("[english.embed]", e); break; }
    for (let k = 0; k < batch.length; k++) {
      const v = vecs[k];
      if (!v) continue;
      await prisma.$executeRaw(Prisma.sql`UPDATE "eng_chunks" SET "embedding" = ${`[${v.join(",")}]`}::vector WHERE "id" = ${batch[k].id}`);
      done++;
    }
  }
  return done;
}

export interface FoundChunk { id: string; bookId: string; unitId: string | null; pageNo: number; text: string; bookTitle: string; unitLabel: string | null }

export async function searchChunks(ownerId: string, question: string, opts: { bookId?: string; unitId?: string; k?: number } = {}): Promise<FoundChunk[]> {
  const k = opts.k ?? 6;
  const bookFilter = opts.bookId ? Prisma.sql`AND c."bookId" = ${opts.bookId}` : Prisma.empty;
  let ids: string[] = [];
  try {
    const [v] = await embed([question]);
    if (v) {
      const lit = `[${v.join(",")}]`;
      // Ưu tiên unit đang học: cộng điểm nhỏ cho đoạn cùng unit.
      const boost = opts.unitId ? Prisma.sql`+ CASE WHEN c."unitId" = ${opts.unitId} THEN 0.05 ELSE 0 END` : Prisma.empty;
      const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT c."id" FROM "eng_chunks" c
        WHERE c."ownerId" = ${ownerId} AND c."embedding" IS NOT NULL ${bookFilter}
        ORDER BY (1 - (c."embedding" <=> ${lit}::vector)) ${boost} DESC
        LIMIT ${k}`);
      ids = rows.map(r => r.id);
    }
  } catch (e) {
    console.error("[english.searchChunks] vector search lỗi, dùng tìm theo từ khoá", e);
  }
  if (!ids.length) {
    // Dự phòng: tìm theo từ khoá (khi chưa có embedding hoặc DB không có pgvector).
    const terms = (question.toLowerCase().match(/[a-z]{3,}/g) ?? []).slice(0, 6);
    if (!terms.length) return [];
    const rows = await prisma.engChunk.findMany({
      where: { ownerId, ...(opts.bookId ? { bookId: opts.bookId } : {}), OR: terms.map(t => ({ text: { contains: t, mode: "insensitive" as const } })) },
      select: { id: true, text: true }, take: 60,
    });
    ids = rows
      .map(r => ({ id: r.id, s: terms.reduce((n, t) => n + (r.text.toLowerCase().split(t).length - 1), 0) }))
      .sort((a, b) => b.s - a.s).slice(0, k).map(r => r.id);
  }
  if (!ids.length) return [];
  const chunks = await prisma.engChunk.findMany({
    where: { id: { in: ids }, ownerId },
    select: { id: true, bookId: true, unitId: true, pageNo: true, text: true, book: { select: { title: true } }, unit: { select: { unitNo: true, title: true } } },
  });
  const byId = new Map(chunks.map(c => [c.id, c]));
  return ids.map(id => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c).map(c => ({
    id: c.id, bookId: c.bookId, unitId: c.unitId, pageNo: c.pageNo, text: c.text, bookTitle: c.book.title,
    unitLabel: c.unit ? (c.unit.unitNo ? `Unit ${c.unit.unitNo}: ${c.unit.title}` : c.unit.title) : null,
  }));
}
