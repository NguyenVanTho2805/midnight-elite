import { NextRequest, NextResponse } from "next/server";
import { requireSession, requirePermission, isNextResponse } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { PERMISSIONS, checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { loadThreadDetail, notFoundThread, NO_STORE } from "@/lib/communityServer";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  const { id } = await params;
  // Bài xoá / chờ duyệt / bị từ chối / lớp mà người gọi không phải thành viên → cùng một 404 (không lộ sự tồn tại).
  const detail = await loadThreadDetail(session, id);
  if (!detail) return notFoundThread();
  return NextResponse.json(detail, { headers: NO_STORE });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COMMUNITY);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const { isPinned } = await req.json();

  try {
    const updated = await prisma.thread.update({
      where:  { id },
      data:   { isPinned: Boolean(isPinned) },
      select: { id: true, isPinned: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Không tìm thấy thread" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  const thread = await prisma.thread.findUnique({ where: { id }, select: { authorId: true, deletedAt: true } });
  if (!thread || thread.deletedAt) return NextResponse.json({ error: "Không tìm thấy thread" }, { status: 404 });

  const canModerate = auth.role === "admin" && checkPermission(auth.adminRole, PERMISSIONS.MANAGE_COMMUNITY);
  const isOwner = thread.authorId === auth.userId;
  if (!canModerate && !isOwner) {
    return NextResponse.json({ error: "Không có quyền xoá bài này" }, { status: 403 });
  }

  // Soft-delete — giữ lại bằng chứng để tra cứu khi có tranh chấp, thay vì xoá cứng
  await prisma.thread.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
