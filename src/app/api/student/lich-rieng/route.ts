// Lịch RIÊNG của học sinh (NC2-043). GET ?from=&to= (YYYY-MM-DD, tối đa 62 ngày) · POST tạo mới.
// Chỉ chủ tài khoản: mọi truy vấn lọc theo session.userId; không có đường nào đọc việc riêng của người khác. Kiểm hợp lệ ở src/lib/personalEvents.ts.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { limitOrBlock } from "@/lib/rate-limit";
import { vnDateKeyOf } from "@/lib/classSessions";
import { cleanPersonalEvent, cleanPersonalRange, PERSONAL_MAX_PER_USER, type PersonalEventDTO } from "@/lib/personalEvents";

const select = { id: true, title: true, dateKey: true, startTime: true, endTime: true, note: true } as const;
const dto = (r: PersonalEventDTO): PersonalEventDTO => ({ id: r.id, title: r.title, dateKey: r.dateKey, startTime: r.startTime, endTime: r.endTime, note: r.note });

export async function GET(req: Request) {
  const session = await requireSession();
  if (isNextResponse(session)) return session;
  const q = new URL(req.url).searchParams;
  const range = cleanPersonalRange(q.get("from"), q.get("to"));
  if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });
  const rows = await prisma.studentPersonalEvent.findMany({
    where: { userId: session.userId, dateKey: { gte: range.from, lte: range.to } },
    select,
    orderBy: [{ dateKey: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });
  return NextResponse.json({ events: rows.map(dto) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (isNextResponse(session)) return session;
  const blocked = limitOrBlock(session.userId, "personal-event-write", 60, 60 * 60_000);
  if (blocked) return blocked;
  const body = await req.json().catch(() => null);
  const c = cleanPersonalEvent(body, vnDateKeyOf(new Date()));
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
  const have = await prisma.studentPersonalEvent.count({ where: { userId: session.userId } });
  if (have >= PERSONAL_MAX_PER_USER) return NextResponse.json({ error: `Đã đủ ${PERSONAL_MAX_PER_USER} việc riêng. Hãy xoá bớt việc cũ rồi thêm.` }, { status: 409 });
  const row = await prisma.studentPersonalEvent.create({ data: { userId: session.userId, ...c.value }, select });
  return NextResponse.json({ event: dto(row) }, { status: 201 });
}
