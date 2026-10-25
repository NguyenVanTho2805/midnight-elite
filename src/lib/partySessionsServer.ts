// BC-02 phía máy chủ: các buổi gần nhất của ĐÚNG một em ở các lớp em đang học (active). Khoá theo studentId của liên kết đã xác nhận, không nhận id từ client.
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";
import { PARTY_SESSIONS_LIMIT, partySessionRows, type PartySessionRow } from "@/lib/partySessions";

export async function loadPartySessions(studentId: string, courseIds: readonly string[], now: Date = new Date(), limit = PARTY_SESSIONS_LIMIT): Promise<PartySessionRow[]> {
  if (!courseIds.length) return [];
  const todayKey = vnDateKeyOf(now);
  const recs = await prisma.attendanceRecord.findMany({
    where: { userId: studentId, session: { courseId: { in: [...courseIds] }, date: { lte: new Date(`${todayKey}T00:00:00Z`) } } },
    select: { status: true, session: { select: { date: true, course: { select: { name: true } } } } },
    orderBy: { session: { date: "desc" } }, take: limit * 3,
  });
  return partySessionRows(recs.map(r => ({ dateKey: r.session.date.toISOString().slice(0, 10), courseName: r.session.course.name, status: r.status })), todayKey, limit);
}
