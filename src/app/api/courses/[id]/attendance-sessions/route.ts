// AS-191 — gia sư tạo & liệt kê buổi điểm danh của 1 lớp.
//
// GET /api/courses/[id]/attendance-sessions — danh sách buổi (có đếm sĩ số).
// POST /api/courses/[id]/attendance-sessions — tạo buổi mới cho 1 ngày.
//
// Chủ lớp + admin_super/admin_content; đồng giảng (TUT-dong-giang) theo courseAccess.ts.
// Học viên của lớp không cần endpoint này — xem điểm danh của chính mình
// ở `/api/users/me/attendance` (sẽ làm sau khi UI phụ huynh/học viên dùng).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess, checkMarkSession, createdByFor, taughtByFor, isHelperRole, roleForbidden } from "@/lib/courseAccessServer";
import { canDo } from "@/lib/courseAccess";
import { normalizeAttendanceDate } from "@/lib/attendance";
import { logAction } from "@/lib/auditLog";

type AttendanceDelegate = {
  create(args: { data: Record<string, unknown>; include?: unknown }): Promise<{ id: string; courseId: string; date: Date; note: string | null; createdBy: string; createdAt: Date }>;
  findMany(args: unknown): Promise<unknown[]>;
};
function sessions(client: typeof prisma = prisma): AttendanceDelegate {
  return (client as unknown as { attendanceSession: AttendanceDelegate }).attendanceSession;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TUT-dong-giang: chủ / quản trị / đồng giảng (dạy buổi của MÌNH, taughtBy = me, createdBy = chủ lớp) / bộ môn (chỉ buổi được giao qua khung lịch).
  const acc = await requireCourseAccess(id, "course.view");
  if (!acc.ok) return acc.res;
  const auth = acc.session;

  let body: { date?: unknown; note?: unknown } = {};
  try { body = await req.json(); } catch { /* không bắt buộc */ }

  if (typeof body.date !== "string") {
    return NextResponse.json({ error: "Thiếu ngày buổi học" }, { status: 400 });
  }
  const date = normalizeAttendanceDate(body.date);
  if (!date) return NextResponse.json({ error: "Ngày không hợp lệ" }, { status: 400 });

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  // Đồng giảng tạo buổi phải có quyền session.add.own trong ma trận (đồng bộ ma trận ⇒ đổi ma trận là đổi cả route).
  if (acc.role === "co_teacher" && !canDo(acc.role, "session.add.own")) return roleForbidden();
  if (acc.role === "subject_teacher") {
    // bộ môn không tự lập buổi (session.add.own ✘): chỉ khi khung lịch của ngày đó đã giao cho mình
    const denied = await checkMarkSession(acc, null, date);
    if (denied) return denied;
  }
  const taughtBy = taughtByFor(acc);

  try {
    const session = await sessions().create({
      data: { courseId: id, date, note: note || null, createdBy: createdByFor(acc), ...(taughtBy ? { taughtBy } : {}) },
    });
    await logAction(auth.userId, "attendance_session.create", "AttendanceSession", session.id, {
      courseId: id, date: date.toISOString(),
    });
    return NextResponse.json(session, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Buổi điểm danh cho ngày này đã tồn tại" }, { status: 409 });
    }
    console.error("[POST /api/courses/[id]/attendance-sessions]", e);
    return NextResponse.json({ error: "Tạo buổi thất bại" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acc = await requireCourseAccess(id, "course.view");
  if (!acc.ok) return acc.res;

  // Đồng giảng / bộ môn chỉ thấy buổi mình dạy + buổi chưa gán người dạy (mục 3.1-A).
  const mine = isHelperRole(acc.role) ? { OR: [{ taughtBy: acc.session.userId }, { taughtBy: null }] } : {};
  const list = await sessions().findMany({
    where:   { courseId: id, ...mine },
    orderBy: { date: "desc" },
    include: { _count: { select: { records: true } } },
    take:    100,
  });
  return NextResponse.json({ items: list });
}
