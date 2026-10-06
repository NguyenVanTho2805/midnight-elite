// AS-191 — gia sư tạo & liệt kê buổi điểm danh của 1 lớp.
//
// GET /api/courses/[id]/attendance-sessions — danh sách buổi (có đếm sĩ số).
// POST /api/courses/[id]/attendance-sessions — tạo buổi mới cho 1 ngày.
//
// Chỉ gia sư sở hữu lớp (ownsResource) + admin_super/admin_content.
// Học viên của lớp không cần endpoint này — xem điểm danh của chính mình
// ở `/api/users/me/attendance` (sẽ làm sau khi UI phụ huynh/học viên dùng).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { normalizeAttendanceDate } from "@/lib/attendance";
import { logAction } from "@/lib/auditLog";

type AttendanceDelegate = {
  create(args: { data: Record<string, unknown>; include?: unknown }): Promise<{ id: string; courseId: string; date: Date; note: string | null; createdBy: string; createdAt: Date }>;
  findMany(args: unknown): Promise<unknown[]>;
};
function sessions(client: typeof prisma = prisma): AttendanceDelegate {
  return (client as unknown as { attendanceSession: AttendanceDelegate }).attendanceSession;
}

async function authorize(id: string) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return { res: auth as NextResponse };
  const course = await prisma.course.findUnique({ where: { id }, select: { ownerId: true } });
  if (!course) return { res: NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 }) };
  if (!ownsResource(auth, course.ownerId)) {
    return { res: NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 }) };
  }
  return { auth };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;
  const auth = r.auth!;

  let body: { date?: unknown; note?: unknown } = {};
  try { body = await req.json(); } catch { /* không bắt buộc */ }

  if (typeof body.date !== "string") {
    return NextResponse.json({ error: "Thiếu ngày buổi học" }, { status: 400 });
  }
  const date = normalizeAttendanceDate(body.date);
  if (!date) return NextResponse.json({ error: "Ngày không hợp lệ" }, { status: 400 });

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  try {
    const session = await sessions().create({
      data: { courseId: id, date, note: note || null, createdBy: auth.userId },
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
  const r = await authorize(id);
  if (r.res) return r.res;

  const list = await sessions().findMany({
    where:   { courseId: id },
    orderBy: { date: "desc" },
    include: { _count: { select: { records: true } } },
    take:    100,
  });
  return NextResponse.json({ items: list });
}
