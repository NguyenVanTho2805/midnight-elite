// POST /api/english/books/[id]/pages — { pages: [{ pageNo, text }] } (tối đa 40 trang/lần). Gửi lại trang đã có thì bỏ qua (không nhân đôi).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad } from "@/lib/english/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const book = await prisma.engBook.findFirst({ where: { id, ownerId: s.userId }, select: { id: true, pageCount: true, status: true } });
  if (!book) return bad("Không tìm thấy sách", 404);
  if (book.status !== "pages") return bad("Sách đã nạp xong trang");
  const b = await req.json().catch(() => null) as { pages?: { pageNo?: number; text?: string }[] } | null;
  if (!b || !Array.isArray(b.pages) || b.pages.length === 0 || b.pages.length > 40) return bad("Gửi 1–40 trang mỗi lần");
  const rows = [];
  for (const p of b.pages) {
    const pageNo = Math.round(Number(p.pageNo));
    if (!(pageNo >= 1 && pageNo <= book.pageCount)) return bad(`Số trang ${p.pageNo} không hợp lệ`);
    rows.push({ bookId: id, pageNo, text: String(p.text ?? "").slice(0, 20000) });
  }
  await prisma.engBookPage.createMany({ data: rows, skipDuplicates: true });
  const uploaded = await prisma.engBookPage.count({ where: { bookId: id } });
  return NextResponse.json({ ok: true, uploaded, pageCount: book.pageCount });
}
