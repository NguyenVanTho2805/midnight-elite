// AS-191 — xem/sửa 1 buổi điểm danh.
//
// GET  — trả session + danh sách học viên đang active (từ Enrollment) kèm
//        record (nếu có). Học viên chưa có record → status = null (chưa
//        điểm danh, không tính vào chuyên cần — GD-06).
// PUT  — gia sư set hàng loạt records trong 1 call. Body:
//        { records: [{ userId, status, note? }, ...] }
//        Dùng upsert cho mỗi record trong 1 transaction.
// DELETE — xoá buổi + mọi record (dùng khi gia sư nhập nhầm ngày).
//
// TT-202 buổi bù: mỗi record có thể kèm `makeupCreditId` — "dùng buổi bù cho buổi này". Buổi bù phải
// của đúng học sinh + đúng lớp, còn hạn, chưa dùng, và học sinh phải có mặt (present/late). Buổi
// được điểm danh bằng buổi bù không phải đóng thêm (tiền học phí vẫn do gia sư lập ở trang Học
// phí; KiN chỉ ghi nhận buổi bù đã dùng để hai bên cùng thấy). Đổi record sang vắng/có phép, hoặc
// xoá buổi, thì buổi bù được trả lại.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { isAttendanceStatus } from "@/lib/attendance";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { logAction } from "@/lib/auditLog";
import { removeUninvoicedChargesForSession, syncSessionCharges } from "@/lib/feeChargeServer";
import { noteShareAllowed } from "@/lib/sessionNoteServer";

type SessionRow = { id: string; courseId: string; date: Date; note: string | null; createdBy: string; createdAt: Date };
type SessionDelegate = {
  findUnique(args: unknown): Promise<SessionRow | null>;
  delete(args: unknown): Promise<unknown>;
};
type RecordDelegate = {
  findMany(args: unknown): Promise<{ userId: string; status: string; note: string | null; zaloOpenedAt: Date | null; parentVisible: boolean }[]>;
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
      include: { user: { select: { id: true, name: true, studentId: true, avatarBase64: true, parentName: true, parentPhone: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    asRecords().findMany({ where: { sessionId: id } }),
  ]);
  const course = await prisma.course.findUnique({ where: { id: session.courseId }, select: { name: true, zaloGroupUrl: true } });
  const byUserId = new Map(records.map(r => [r.userId, r]));
  // Buổi bù: loại còn dùng được (để chọn) và loại đã dùng cho CHÍNH buổi này (để hiện đang chọn).
  const now = new Date();
  const credits = await prisma.makeupCredit.findMany({
    where: {
      courseId: session.courseId,
      studentId: { in: enrollments.map(e => e.user.id) },
      OR: [{ status: "active", expiresAt: { gt: now } }, { usedSessionId: id }],
    },
    select: { id: true, studentId: true, status: true, expiresAt: true, usedSessionId: true },
    orderBy: { expiresAt: "asc" }, // dùng cái sắp hết hạn trước
  });
  const creditsOf = new Map<string, typeof credits>();
  for (const c of credits) { const l = creditsOf.get(c.studentId) ?? []; l.push(c); creditsOf.set(c.studentId, l); }
  const roster = enrollments.map(e => ({
    makeupAvailable: (creditsOf.get(e.user.id) ?? []).filter(c => c.status === "active").map(c => ({ id: c.id, expiresAt: c.expiresAt })),
    makeupUsedId:    (creditsOf.get(e.user.id) ?? []).find(c => c.usedSessionId === id)?.id ?? null,
    userId:    e.user.id,
    name:      e.user.name,
    studentId: e.user.studentId,
    avatar:    e.user.avatarBase64,
    status:    byUserId.get(e.user.id)?.status ?? null, // null = chưa điểm danh
    note:      byUserId.get(e.user.id)?.note ?? null,
    // BU-07: gia sư đã tick cho phụ huynh của đúng em này xem nhận xét.
    parentVisible: byUserId.get(e.user.id)?.parentVisible ?? false,
    // TT-199: để gia sư nhắn phụ huynh qua Zalo ngay từ màn điểm danh.
    parentName:   e.user.parentName,
    parentPhone:  e.user.parentPhone,
    zaloOpenedAt: byUserId.get(e.user.id)?.zaloOpenedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ session, roster, course: { name: course?.name ?? "", zaloGroupUrl: course?.zaloGroupUrl ?? null } });
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

  const items: { userId: string; status: string; note: string | null; makeupCreditId: string | null; parentVisible?: boolean }[] = [];
  for (const row of body.records) {
    if (!row || typeof row !== "object") continue;
    const r2 = row as Record<string, unknown>;
    if (typeof r2.userId !== "string" || !r2.userId) continue;
    if (!isAttendanceStatus(r2.status)) {
      return NextResponse.json({ error: `Status không hợp lệ cho userId ${r2.userId}` }, { status: 400 });
    }
    const note = typeof r2.note === "string" ? r2.note.trim().slice(0, 500) : null;
    const mk = typeof r2.makeupCreditId === "string" && r2.makeupCreditId ? r2.makeupCreditId : null;
    if (mk && r2.status !== "present" && r2.status !== "late") {
      return NextResponse.json({ error: "Chỉ dùng buổi bù cho học viên có mặt hoặc đi muộn" }, { status: 400 });
    }
    if (r2.parentVisible !== undefined && typeof r2.parentVisible !== "boolean") return NextResponse.json({ error: "parentVisible phải là true hoặc false" }, { status: 400 });
    items.push({ userId: r2.userId, status: r2.status, note: note || null, makeupCreditId: mk, ...(r2.parentVisible !== undefined ? { parentVisible: r2.parentVisible } : {}) });
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

  // BU-07: chia sẻ nhận xét cho phụ huynh chỉ khi hồ sơ của em (nếu có) còn đồng ý phạm vi cơ bản; thiếu thì từ chối cả lô, không lưu dở.
  const sharing = items.filter(i => i.parentVisible === true).map(i => i.userId);
  if (sharing.length) {
    const owner = (await prisma.course.findUnique({ where: { id: session.courseId }, select: { ownerId: true } }))?.ownerId;
    const allowed = owner ? await noteShareAllowed(owner, sharing) : new Map<string, boolean>();
    const blocked = sharing.filter(u => allowed.get(u) !== true);
    if (blocked.length) return NextResponse.json({ error: "Có em chưa có đồng ý (hoặc đã thu hồi) nên chưa chia sẻ nhận xét cho phụ huynh được. Mở hồ sơ của em để xác nhận đồng ý trước.", needsConsent: true, blocked }, { status: 422 });
  }

  // Upsert trong 1 transaction — không có xung đột race vì key unique
  // (sessionId, userId). 2 gia sư đồng thời set record cùng 1 em thì
  // người sau đè được, có updatedBy để biết ai làm cuối.
  const now = new Date();
  // Trạng thái đổi → xoá mốc "đã mở Zalo" (tin trước nói về trạng thái cũ).
  const prevStatus = new Map((await asRecords().findMany({ where: { sessionId: id, userId: { in: items.map(i => i.userId) } } })).map(r => [r.userId, r.status]));
  class MakeupError extends Error {}
  try {
    await prisma.$transaction(async (tx) => {
      const txRecords = asRecords(tx);
      for (const i of items) {
        const changed = prevStatus.has(i.userId) && prevStatus.get(i.userId) !== i.status;
        await txRecords.upsert({
          where:  { sessionId_userId: { sessionId: id, userId: i.userId } },
          create: { sessionId: id, userId: i.userId, status: i.status, note: i.note, updatedBy: auth.userId, ...(i.parentVisible !== undefined ? { parentVisible: i.parentVisible } : {}) },
          update: { status: i.status, note: i.note, updatedBy: auth.userId, ...(changed ? { zaloOpenedAt: null } : {}), ...(i.parentVisible !== undefined ? { parentVisible: i.parentVisible } : {}) },
        });
        if (i.makeupCreditId) {
          // Điều kiện nằm trong WHERE của updateMany nên hai gia sư/hai lần bấm cùng lúc không dùng chung 1 buổi bù.
          const used = await tx.makeupCredit.updateMany({
            where: {
              id: i.makeupCreditId, studentId: i.userId, courseId: session.courseId, expiresAt: { gt: now },
              OR: [{ status: "active" }, { usedSessionId: id }], // đang rảnh, hoặc đã gắn đúng buổi này (lưu lại lần nữa)
            },
            data: { status: "used", usedAt: now, usedSessionId: id },
          });
          // Ném lỗi để cả transaction (kể cả các record đã upsert ở trên) được hoàn tác — không lưu dở.
          if (used.count !== 1) throw new MakeupError("Buổi bù không dùng được (đã dùng, đã hết hạn, hoặc không thuộc học viên này)");
        } else if (i.status !== "present" && i.status !== "late") {
          // Không còn có mặt → trả lại buổi bù đã gắn cho buổi này (nếu có).
          await tx.makeupCredit.updateMany({
            where: { studentId: i.userId, usedSessionId: id },
            data: { status: "active", usedAt: null, usedSessionId: null },
          });
        }
      }
      // HP-14: lớp tạo sau theo buổi/giờ → sinh/sửa dòng học phí của buổi này TRONG CÙNG transaction (điểm danh và phí không lệch nhau).
      // Lớp cách cũ (mặc định): trả sớm, không ghi gì.
      await syncSessionCharges(tx, {
        sessionId: id, courseId: session.courseId, sessionDate: session.date, by: auth.userId,
        items: items.map(i => ({ userId: i.userId, status: i.status, makeupUsed: !!i.makeupCreditId })),
      });
    });
  } catch (e) {
    if (e instanceof MakeupError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

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

  // Xoá buổi thì trả lại các buổi bù đã gắn vào buổi này.
  await prisma.makeupCredit.updateMany({ where: { usedSessionId: id }, data: { status: "active", usedAt: null, usedSessionId: null } });
  await removeUninvoicedChargesForSession(prisma, id); // HP-14: dòng phí CHƯA vào phiếu của buổi này bỏ theo; dòng đã vào phiếu giữ nguyên
  await asSessions().delete({ where: { id } });
  await logAction(auth.userId, "attendance_session.delete", "AttendanceSession", id, {
    courseId: session.courseId, date: session.date.toISOString(),
  });
  return NextResponse.json({ ok: true });
}
