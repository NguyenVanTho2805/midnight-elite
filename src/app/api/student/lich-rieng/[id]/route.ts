// Sửa / xoá MỘT việc riêng (NC2-043). Mọi truy vấn có điều kiện userId = chủ phiên: việc của người khác (hoặc không có) đều trả 404, không lộ là có tồn tại.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { limitOrBlock } from "@/lib/rate-limit";
import { vnDateKeyOf } from "@/lib/classSessions";
import { cleanPersonalEvent } from "@/lib/personalEvents";

const select = { id: true, title: true, dateKey: true, startTime: true, endTime: true, note: true } as const;
const NOT_FOUND = () => NextResponse.json({ error: "Không tìm thấy việc riêng này." }, { status: 404 });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isNextResponse(session)) return session;
  const blocked = limitOrBlock(session.userId, "personal-event-write", 60, 60 * 60_000);
  if (blocked) return blocked;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const c = cleanPersonalEvent(body, vnDateKeyOf(new Date()));
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
  const r = await prisma.studentPersonalEvent.updateMany({ where: { id, userId: session.userId }, data: c.value });
  if (r.count === 0) return NOT_FOUND();
  const row = await prisma.studentPersonalEvent.findFirst({ where: { id, userId: session.userId }, select });
  return row ? NextResponse.json({ event: row }) : NOT_FOUND();
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isNextResponse(session)) return session;
  const { id } = await params;
  const r = await prisma.studentPersonalEvent.deleteMany({ where: { id, userId: session.userId } });
  return r.count === 0 ? NOT_FOUND() : NextResponse.json({ ok: true });
}
