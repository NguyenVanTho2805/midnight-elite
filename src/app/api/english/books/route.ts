// GET  /api/english/books — sách của tôi + tiến độ.
// POST /api/english/books — { title, kind, fileName, pageCount } → tạo sách rỗng; chữ từng trang gửi sau qua /pages.
// File PDF KHÔNG rời máy người học: trình duyệt tự trích chữ (pdf.js) rồi gửi chữ lên. Sách có bản quyền nên chỉ chủ sở hữu thấy.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad } from "@/lib/english/server";

export async function GET() {
  const s = await requireUser();
  if (isResp(s)) return s;
  const books = await prisma.engBook.findMany({
    where: { ownerId: s.userId }, orderBy: { createdAt: "desc" },
    select: { id: true, title: true, kind: true, fileName: true, pageCount: true, status: true, statusNote: true, unitsTotal: true, unitsDone: true, createdAt: true },
  });
  const progress = await prisma.engUnitProgress.findMany({
    where: { userId: s.userId, unit: { bookId: { in: books.map(b => b.id) } } },
    select: { status: true, unit: { select: { bookId: true } } },
  });
  return NextResponse.json({
    items: books.map(b => ({
      ...b,
      studied: progress.filter(p => p.unit.bookId === b.id).length,
      mastered: progress.filter(p => p.unit.bookId === b.id && p.status === "done").length,
    })),
  });
}

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const b = await req.json().catch(() => null) as { title?: string; kind?: string; fileName?: string; pageCount?: number } | null;
  const title = (b?.title ?? "").trim().slice(0, 160);
  const kind = ["grammar", "skills", "other"].includes(b?.kind ?? "") ? b!.kind! : "other";
  const pageCount = Math.round(Number(b?.pageCount));
  if (!title) return bad("Đặt tên cho sách");
  if (!(pageCount > 0 && pageCount <= 800)) return bad("Sách phải có từ 1 đến 800 trang");
  const count = await prisma.engBook.count({ where: { ownerId: s.userId } });
  if (count >= 20) return bad("Tối đa 20 sách mỗi tài khoản — xoá bớt sách cũ trước.");
  const book = await prisma.engBook.create({ data: { ownerId: s.userId, title, kind, fileName: (b?.fileName ?? "").slice(0, 200), pageCount } });
  return NextResponse.json({ id: book.id });
}
