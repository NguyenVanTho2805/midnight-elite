import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS, checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  const reply = await prisma.threadReply.findUnique({ where: { id }, select: { authorId: true } });
  if (!reply) return NextResponse.json({ error: "Không tìm thấy trả lời" }, { status: 404 });

  const canModerate = auth.role === "admin" && checkPermission(auth.adminRole, PERMISSIONS.MANAGE_COMMUNITY);
  const isOwner = reply.authorId === auth.userId;
  if (!canModerate && !isOwner) {
    return NextResponse.json({ error: "Không có quyền xoá trả lời này" }, { status: 403 });
  }

  await prisma.threadReply.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
