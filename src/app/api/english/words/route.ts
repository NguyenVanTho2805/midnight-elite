// GET   /api/english/words?status=learning|known&q=  — sổ từ của tôi (tối đa 200 dòng)
// POST  /api/english/words  — { word, context?, contextVi?, textId?, status? ("learning" mặc định | "known") } → thêm từ bắt được khi đọc/nghe, mở thẻ ôn
// PATCH /api/english/words  — { wordId, status: "known" | "learning" | "ignored" }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad, addUserWord, enrichMissing, ensureWordCard, logStudy } from "@/lib/english/server";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const status = req.nextUrl.searchParams.get("status");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const rows = await prisma.engUserWord.findMany({
    where: { userId: s.userId, ...(status && ["known", "learning", "ignored"].includes(status) ? { status } : {}), ...(q ? { word: { lemma: { startsWith: q } } } : {}) },
    orderBy: { updatedAt: "desc" }, take: 200,
    select: { wordId: true, status: true, source: true, context: true, contextVi: true, updatedAt: true, word: { select: { lemma: true, list: true, meaningVi: true, pos: true } } },
  });
  const counts = await prisma.engUserWord.groupBy({ by: ["status"], where: { userId: s.userId }, _count: { _all: true } });
  return NextResponse.json({ items: rows, counts: Object.fromEntries(counts.map(c => [c.status, c._count._all])) });
}

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const b = await req.json().catch(() => null) as { word?: string; context?: string; contextVi?: string; textId?: string; status?: string } | null;
  if (!b?.word) return bad("Thiếu từ");
  const status = b.status === "known" ? "known" : "learning";
  if (b.textId) {
    const t = await prisma.engText.findFirst({ where: { id: b.textId, OR: [{ ownerId: null }, { ownerId: s.userId }] }, select: { id: true } });
    if (!t) return bad("Không tìm thấy bài", 404);
  }
  try {
    const w = await addUserWord(s.userId, b.word, { source: "reader", status, context: b.context?.slice(0, 600) ?? null, contextVi: b.contextVi?.slice(0, 200) ?? null, textId: b.textId ?? null });
    if (status === "learning") await enrichMissing([w.id]);
    await logStudy(s.userId, "doc", { items: 1 });
    const word = await prisma.engWord.findUnique({ where: { id: w.id }, select: { id: true, lemma: true, meaningVi: true, pos: true } });
    return NextResponse.json({ ok: true, word });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Không thêm được từ");
  }
}

export async function PATCH(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const b = await req.json().catch(() => null) as { wordId?: string; status?: string } | null;
  if (!b?.wordId || !["known", "learning", "ignored"].includes(b.status ?? "")) return bad("Dữ liệu không hợp lệ");
  const uw = await prisma.engUserWord.findUnique({ where: { userId_wordId: { userId: s.userId, wordId: b.wordId } } });
  if (!uw) return bad("Từ này không có trong sổ của bạn", 404);
  await prisma.engUserWord.update({ where: { id: uw.id }, data: { status: b.status } });
  // "Đã biết"/"Bỏ qua" → tạm ngưng thẻ; "Học lại" → bật lại thẻ (tạo mới nếu chưa có)
  if (b.status === "learning") {
    await prisma.engCard.updateMany({ where: { userId: s.userId, wordId: b.wordId }, data: { suspended: false } });
    await ensureWordCard(s.userId, b.wordId, "recognize");
  } else {
    await prisma.engCard.updateMany({ where: { userId: s.userId, wordId: b.wordId }, data: { suspended: true } });
  }
  return NextResponse.json({ ok: true });
}
