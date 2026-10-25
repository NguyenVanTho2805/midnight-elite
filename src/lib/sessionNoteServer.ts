// BU-07 — nhận xét riêng từng em trong buổi (AttendanceRecord.note), hiện cho phụ huynh khi gia sư tick "cho phụ huynh xem".
// KHÔNG thu dữ liệu mới: note đã có sẵn từ trước, chỉ thêm cờ chia sẻ (AttendanceRecord.parentVisible, mặc định tắt).
//
// Ai thấy: gia sư chủ lớp (qua API điểm danh) và phụ huynh của ĐÚNG em đó qua link Sổ của con (token). Học sinh KHÔNG có đường đọc ở đây.
// Quyền theo hồ sơ: nếu gia sư đã lập hồ sơ riêng cho em (StudentProfile) thì chỉ hiện khi đồng ý phạm vi "basic" CÒN hiệu lực lúc đọc;
// thu hồi đồng ý → ẩn ngay. Em chưa có hồ sơ riêng: nhận xét vẫn chỉ hiện khi gia sư chủ động tick cho đúng em đó.
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";
import { consentOf, consentRowsOf, accountFacts } from "@/lib/studentProfileServer";

/** Với mỗi em: gia sư này có được chia sẻ nhận xét cho phụ huynh không (đồng ý "basic" còn hiệu lực nếu có hồ sơ riêng). */
export async function noteShareAllowed(tutorId: string, userIds: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (!userIds.length) return out;
  const profiles = await prisma.studentProfile.findMany({ where: { tutorId, userId: { in: userIds } }, select: { id: true, userId: true, ageGroup: true, birthDate: true } });
  const rows = await consentRowsOf(profiles.map(p => p.id));
  const acct = await accountFacts(userIds);
  const now = new Date();
  for (const p of profiles) out.set(p.userId as string, consentOf(p, rows.get(p.id) ?? [], now, acct.get(p.userId as string)).state.ok.basic);
  for (const u of userIds) if (!out.has(u)) out.set(u, true);
  return out;
}

export interface PartyNote { dateKey: string; courseName: string; note: string }

/** Nhận xét gia sư đã chọn cho phụ huynh của ĐÚNG một em. Chỉ buổi đã tới ngày (giờ VN), mới nhất trước. */
export async function loadPartyNotes(studentId: string, limit = 12, now: Date = new Date()): Promise<PartyNote[]> {
  const raw = await prisma.attendanceRecord.findMany({
    where: { userId: studentId, parentVisible: true, note: { not: null }, session: { date: { lte: new Date(`${vnDateKeyOf(now)}T00:00:00Z`) } } },
    orderBy: { session: { date: "desc" } }, take: limit * 3,
    select: { note: true, session: { select: { date: true, course: { select: { name: true, ownerId: true } } } } },
  });
  if (!raw.length) return [];
  const okBy = new Map<string, boolean>();
  for (const t of new Set(raw.map(r => r.session.course.ownerId ?? ""))) {
    okBy.set(t, t ? (await noteShareAllowed(t, [studentId])).get(studentId) === true : false);
  }
  return raw.filter(r => okBy.get(r.session.course.ownerId ?? "") && r.note && r.note.trim()).slice(0, limit)
    .map(r => ({ dateKey: r.session.date.toISOString().slice(0, 10), courseName: r.session.course.name, note: r.note as string }));
}
