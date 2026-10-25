// BU-11 — điểm 0-10 và % hoàn thành BTVN của từng em trong một buổi.
//   GET: danh sách em đang học lớp (active) kèm điểm đã ghi + em nào được ghi (có đồng ý phạm vi "scores") hay chưa và vì sao.
//   PUT: { scores: [{ userId, score|null, homeworkPct|null }] } — em thiếu đồng ý bị từ chối (422), không ghi dở.
// Chỉ gia sư chủ lớp (+ quản trị theo ownsResource). Học sinh KHÔNG có đường nào đọc điểm này. Nhật ký không ghi tên hay điểm.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { logAction } from "@/lib/auditLog";
import { parseScoreRows } from "@/lib/sessionScore";
import { scoreConsentFor } from "@/lib/sessionScoreServer";

const NO_STORE = { "Cache-Control": "no-store" };

async function authorize(id: string) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return { res: auth as NextResponse };
  const session = await prisma.attendanceSession.findUnique({ where: { id }, select: { id: true, courseId: true } });
  if (!session) return { res: NextResponse.json({ error: "Không tìm thấy buổi" }, { status: 404 }) };
  const course = await prisma.course.findUnique({ where: { id: session.courseId }, select: { ownerId: true } });
  if (!course) return { res: NextResponse.json({ error: "Lớp không còn tồn tại" }, { status: 404 }) };
  if (!ownsResource(auth, course.ownerId)) return { res: NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 }) };
  return { auth, session, ownerId: course.ownerId };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;
  const enrolls = await prisma.enrollment.findMany({
    where: { courseId: r.session!.courseId, status: ENROLLMENT_STATUS.ACTIVE }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } },
  });
  const ids = enrolls.map(e => e.user.id);
  const consent = r.ownerId ? await scoreConsentFor(r.ownerId, ids) : new Map();
  const rows = await prisma.sessionStudentScore.findMany({ where: { sessionId: id, userId: { in: ids } }, select: { userId: true, score: true, homeworkPct: true } });
  const by = new Map(rows.map(x => [x.userId, x]));
  return NextResponse.json({
    roster: enrolls.map(e => {
      const c = consent.get(e.user.id) ?? { ok: false, reason: "no_profile", profileId: null };
      const row = c.ok ? by.get(e.user.id) : undefined; // thiếu đồng ý thì không hiện điểm cũ
      return { userId: e.user.id, name: e.user.name, canRecord: c.ok, reason: c.reason, profileId: c.profileId, score: row?.score ?? null, homeworkPct: row?.homeworkPct ?? null };
    }),
  }, { headers: NO_STORE });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;
  const auth = r.auth!, session = r.session!;
  const body = await req.json().catch(() => null) as { scores?: unknown } | null;
  const parsed = parseScoreRows(body?.scores);
  if (parsed.errors.length) return NextResponse.json({ error: parsed.errors[0] }, { status: 400 });
  if (!parsed.rows.length) return NextResponse.json({ error: "Chưa có điểm nào để lưu" }, { status: 400 });
  if (!r.ownerId) return NextResponse.json({ error: "Lớp chưa có gia sư chủ nên chưa ghi điểm được" }, { status: 409 });

  const enrolls = await prisma.enrollment.findMany({
    where: { courseId: session.courseId, status: ENROLLMENT_STATUS.ACTIVE, userId: { in: parsed.rows.map(x => x.userId) } }, select: { userId: true },
  });
  const inClass = new Set(enrolls.map(e => e.userId));
  if (parsed.rows.some(x => !inClass.has(x.userId))) return NextResponse.json({ error: "Có em không học lớp này" }, { status: 400 });

  const consent = await scoreConsentFor(r.ownerId, parsed.rows.map(x => x.userId));
  const blocked = parsed.rows.filter(x => !consent.get(x.userId)?.ok).map(x => x.userId);
  if (blocked.length) {
    return NextResponse.json({ error: "Có em chưa có đồng ý ghi điểm. Mở hồ sơ của em để xác nhận đồng ý trước.", needsConsent: true, blocked }, { status: 422 });
  }

  await prisma.$transaction(async tx => {
    for (const x of parsed.rows) {
      if (x.score === null && x.homeworkPct === null) { await tx.sessionStudentScore.deleteMany({ where: { sessionId: id, userId: x.userId } }); continue; }
      await tx.sessionStudentScore.upsert({
        where: { sessionId_userId: { sessionId: id, userId: x.userId } },
        create: { sessionId: id, userId: x.userId, tutorId: r.ownerId!, score: x.score, homeworkPct: x.homeworkPct },
        update: { score: x.score, homeworkPct: x.homeworkPct, tutorId: r.ownerId! },
      });
    }
  });
  await logAction(auth.userId, "session_score.update", "AttendanceSession", id, { count: parsed.rows.length });
  return NextResponse.json({ ok: true, count: parsed.rows.length }, { headers: NO_STORE });
}
