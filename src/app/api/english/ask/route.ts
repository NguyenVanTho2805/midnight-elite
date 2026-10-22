// POST /api/english/ask — { question, bookId?, unitId? } → trả lời CHỈ từ sách của tôi, kèm trích dẫn unit/trang.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad } from "@/lib/english/server";
import { searchChunks } from "@/lib/english/rag";
import { answerFromBook } from "@/lib/english/ai";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const b = await req.json().catch(() => null) as { question?: string; bookId?: string; unitId?: string } | null;
  const question = (b?.question ?? "").trim();
  if (question.length < 3 || question.length > 500) return bad("Câu hỏi từ 3 đến 500 ký tự");
  if (b?.bookId && !(await prisma.engBook.findFirst({ where: { id: b.bookId, ownerId: s.userId }, select: { id: true } }))) return bad("Không tìm thấy sách", 404);
  if (!(await prisma.engChunk.count({ where: { ownerId: s.userId } }))) return bad("Bạn chưa có sách nào để hỏi. Thêm sách ở mục Lớp học trước.", 409);
  if (!rateLimit(`eng-ask:${s.userId}`, 30, 30 * 60_000)) return bad("Hỏi hơi nhanh, nghỉ một chút rồi hỏi tiếp nhé.", 429);

  const found = await searchChunks(s.userId, question, { bookId: b?.bookId, unitId: b?.unitId, k: 6 });
  const numbered = found.map((c, i) => ({ n: i + 1, label: `${c.bookTitle}${c.unitLabel ? ` — ${c.unitLabel}` : ""}, trang ${c.pageNo}`, text: c.text }));
  try {
    const r = await answerFromBook(question, numbered);
    return NextResponse.json({
      found: r.found && r.cites.length > 0,
      answer: r.found ? r.answerVi : "Sách của bạn không có đoạn nào trả lời rõ câu này. Thử hỏi cụ thể hơn (vd tên thì, tên cấu trúc), hoặc hỏi trong một sách khác.",
      citations: r.cites.map(n => { const c = found[n - 1]; return { n, bookId: c.bookId, unitId: c.unitId, bookTitle: c.bookTitle, unitLabel: c.unitLabel, pageNo: c.pageNo, excerpt: c.text.slice(0, 220) }; }),
    });
  } catch (e) {
    console.error("[english.ask]", e);
    return bad("AI đang bận, thử lại sau.", 502);
  }
}
