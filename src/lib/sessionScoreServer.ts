// BU-11 phía máy chủ: điểm từng buổi. Quy tắc đồng ý dùng chung với hồ sơ học sinh (phạm vi "scores" của hồ sơ riêng gia sư ↔ em).
// Gia sư của lớp = Course.ownerId. Không có hồ sơ riêng, hoặc thiếu đồng ý, hoặc đã thu hồi ⇒ KHÔNG ghi và KHÔNG hiện.
import { prisma } from "@/lib/prisma";
import { consentOf, consentRowsOf, accountFacts } from "@/lib/studentProfileServer";

export type ScoreBlock = "no_profile" | "no_consent";
/** Với mỗi em: được ghi điểm không, và nếu không thì vì sao. Khoá theo (gia sư, em). */
export async function scoreConsentFor(tutorId: string, userIds: string[]): Promise<Map<string, { ok: boolean; reason: ScoreBlock | null; profileId: string | null }>> {
  const out = new Map<string, { ok: boolean; reason: ScoreBlock | null; profileId: string | null }>();
  if (!userIds.length) return out;
  const profiles = await prisma.studentProfile.findMany({ where: { tutorId, userId: { in: userIds } }, select: { id: true, userId: true, ageGroup: true, birthDate: true } });
  const rows = await consentRowsOf(profiles.map(p => p.id));
  const acct = await accountFacts(userIds);
  const now = new Date();
  for (const p of profiles) {
    const { state } = consentOf(p, rows.get(p.id) ?? [], now, acct.get(p.userId as string));
    out.set(p.userId as string, state.ok.scores ? { ok: true, reason: null, profileId: p.id } : { ok: false, reason: "no_consent", profileId: p.id });
  }
  for (const u of userIds) if (!out.has(u)) out.set(u, { ok: false, reason: "no_profile", profileId: null });
  return out;
}

export interface PartyScore { dateKey: string; courseName: string; score: number | null; homeworkPct: number | null }

/** Điểm các buổi gần đây của ĐÚNG một em, cho phụ huynh xem qua link Sổ của con. Chỉ những dòng mà đồng ý "scores" còn hiệu lực lúc đọc. */
export async function loadPartyScores(studentId: string, limit = 12): Promise<PartyScore[]> {
  const raw = await prisma.sessionStudentScore.findMany({
    where: { userId: studentId }, orderBy: { session: { date: "desc" } }, take: limit * 3,
    select: { tutorId: true, score: true, homeworkPct: true, session: { select: { date: true, course: { select: { name: true } } } } },
  });
  if (!raw.length) return [];
  const okBy = new Map<string, boolean>();
  for (const t of new Set(raw.map(r => r.tutorId))) okBy.set(t, (await scoreConsentFor(t, [studentId])).get(studentId)?.ok === true);
  return raw.filter(r => okBy.get(r.tutorId)).slice(0, limit)
    .map(r => ({ dateKey: r.session.date.toISOString().slice(0, 10), courseName: r.session.course.name, score: r.score, homeworkPct: r.homeworkPct }));
}
