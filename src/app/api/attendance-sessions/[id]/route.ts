// AS-191 — xem/sửa 1 buổi điểm danh.
//
// GET  — trả session + danh sách học viên đang active (từ Enrollment) kèm
//        record (nếu có). Học viên chưa có record → status = null (chưa
//        điểm danh, không tính vào chuyên cần — GD-06).
// PUT  — gia sư set hàng loạt records trong 1 call. Body:
//        { records: [{ userId, status, note? }, ...] }
//        Dùng upsert cho mỗi record trong 1 transaction.
// DELETE — xoá buổi + mọi record (dùng khi gia sư nhập nhầm ngày).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { isAttendanceStatus } from "@/lib/attendance";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { logAction } from "@/lib/auditLog";

type SessionRow = { id: string; courseId: string; date: Date; note: string | null; createdBy: string; createdAt: Date };
type SessionDelegate = {
  findUnique(args: unknown): Promise<SessionRow | null>;
  delete(args: unknown): Promise<unknown>;
};
type RecordDelegate = {
  findMany(args: unknown): Promise<{ userId: string; status: string; note: string | null }[]>;
  upsert(args: unknown): Promise<unknown>;
};

const asSessions = () =>
  (prisma as unknown as { attendanceSession: SessionDelegate }).attendanceSession;
const asRecords = (client: unknown = prisma) =>
  (client as { attendanceRecord: RecordDelegate }).attendanceRecord;

async function authorizeSession(id: string) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return { res: auth as NextResponse };
  const session = await asSessions().findUnique({ where: { id } });
  if (!session) return { res: NextResponse.json({ error: "Không tìm thấy buổi" }, { status: 404 }) };
  const course = await prisma.course.findUnique({ where: { id: session.courseId }, select: { ownerId: true } });
  if (!course) return { res: NextResponse.json({ error: "Lớp không còn tồn tại" }, { status: 404 }) };
  if (!ownsResource(auth, course.ownerId)) {
    return { res: NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 }) };
  }
  return { auth, session };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorizeSession(id);
  if (r.res) return r.res;
  const session = r.session!;

  // Danh sách học viên active của lớp + record (nếu có). "pending_consent"
  // không hiện vì chưa học — nếu gia sư ghi được là ngụ ý em đó đi học.
  const [enrollments, records] = await Promise.all([
    prisma.enrollment.findMany({
      where:   { courseId: session.courseId, status: ENROLLMENT_STATUS.ACTIVE },
      include: { user: { select: { id: true, name: true, studentId: true, avatarBase64: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    asRecords().findMany({ where: { sessionId: id } }),
  ]);
  const byUserId = new Map(records.map(r => [r.userId, r]));
  const roster = enrollments.map(e => ({
    userId:    e.user.id,
    name:      e.user.name,
    studentId: e.user.studentId,
    avatar:    e.user.avatarBase64,
    status:    byUserId.get(e.user.id)?.status ?? null, // null = chưa điểm danh
    note:      byUserId.get(e.user.id)?.note ?? null,
  }));

  return NextResponse.json({ session, roster });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorizeSession(id);
  if (r.res) return r.res;
  const auth = r.auth!;
  const session = r.session!;

  let body: { records?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }
  if (!Array.isArray(body.records)) {
    return NextResponse.json({ error: "Thiếu danh sách records" }, { status: 400 });
  }
  if (body.records.length > 500) {
    return NextResponse.json({ error: "Mỗi lần tối đa 500 records" }, { status: 400 });
  }

  const items: { userId: string; status: string; note: string | null }[] = [];
  for (const row of body.records) {
    if (!row || typeof row !== "object") continue;
    const r2 = row as Record<string, unknown>;
    if (typeof r2.userId !== "string" || !r2.userId) continue;
    if (!isAttendanceStatus(r2.status)) {
      return NextResponse.json({ error: `Status không hợp lệ cho userId ${r2.userId}` }, { status: 400 });
    }
    const note = typeof r2.note === "string" ? r2.note.trim().slice(0, 500) : null;
    items.push({ userId: r2.userId, status: r2.status, note: note || null });
  }

  // Kiểm mọi userId có trong Enrollment active của lớp — chống gia sư gửi
  // userId không thuộc lớp (xì-nít thao tác, hoặc em đã rời lớp).
  const enrollments = await prisma.enrollment.findMany({
    where:  { courseId: session.courseId, status: ENROLLMENT_STATUS.ACTIVE, userId: { in: items.map(i => i.userId) } },
    select: { userId: true },
  });
  const validUserIds = new Set(enrollments.map(e => e.userId));
  const invalid = items.filter(i => !validUserIds.has(i.userId));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Có userId không thuộc lớp này: ${invalid.map(i => i.userId).slice(0, 3).join(", ")}` },
      { status: 400 },
    );
  }

  // Upsert trong 1 transaction — không có xung đột race vì key unique
  // (sessionId, userId). 2 gia sư đồng thời set record cùng 1 em thì
  // người sau đè được, có updatedBy để biết ai làm cuối.
  await prisma.$transaction(async (tx) => {
    const txRecords = asRecords(tx);
    for (const i of items) {
      await txRecords.upsert({
        where:  { sessionId_userId: { sessionId: id, userId: i.userId } },
        create: { sessionId: id, userId: i.userId, status: i.status, note: i.note, updatedBy: auth.userId },
        update: { status: i.status, note: i.note, updatedBy: auth.userId },
      });
    }
  });

  await logAction(auth.userId, "attendance_session.update", "AttendanceSession", id, {
    courseId: session.courseId, count: items.length,
  });

  return NextResponse.json({ ok: true, count: items.length });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorizeSession(id);
  if (r.res) return r.res;
  const auth = r.auth!;
  const session = r.session!;

  await asSessions().delete({ where: { id } });
  await logAction(auth.userId, "attendance_session.delete", "AttendanceSession", id, {
    courseId: session.courseId, date: session.date.toISOString(),
  });
  return NextResponse.json({ ok: true });
}
