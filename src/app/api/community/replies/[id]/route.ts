import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  const reply = await prisma.threadReply.findUnique({ where: { id }, select: { authorId: true } });
  if (!reply) return NextResponse.json({ error: "Không tìm thấy trả lời" }, { status: 404 });

  const isAdmin = auth.role === "admin";
  const isOwner = reply.authorId === auth.userId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Không có quyền xoá trả lời này" }, { status: 403 });
  }

  await prisma.threadReply.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
