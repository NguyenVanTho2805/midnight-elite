// KiN Pro F6 — PATCH /api/admin/ho-tro/[id] { action: "reply", reply } | { action: "close" }. Chỉ MANAGE_TUTORS. Trả lời hiện cho gia sư ở trang Liên hệ hỗ trợ.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { parseReplyInput } from "@/lib/supportDesk";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_TUTORS);
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  let body: unknown = null;
  try { body = await req.json(); } catch { /* báo lỗi bên dưới */ }
  const p = parseReplyInput(body);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const row = await prisma.supportRequest.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!row) return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404 });
  const now = new Date();
  if (p.action === "reply") {
    if (row.status === "closed") return NextResponse.json({ error: "Yêu cầu đã đóng" }, { status: 409 });
    await prisma.supportRequest.update({ where: { id }, data: { reply: p.reply, repliedBy: auth.userId, repliedAt: now, status: "answered" } });
  } else {
    await prisma.supportRequest.update({ where: { id }, data: { status: "closed", closedAt: now } });
  }
  return NextResponse.json({ ok: true });
}
