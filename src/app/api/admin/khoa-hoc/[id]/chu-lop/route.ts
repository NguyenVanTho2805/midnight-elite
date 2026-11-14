// DG-GIAO-LOP (14/11/2026) — quản trị trung tâm giao lớp cho gia sư khác làm CHỦ LỚP (chủ chốt: "thành chủ lớp", không phải đồng giảng).
//   GET  → { owner: {id,name} | null, tutors: [{id,name}] }   (danh sách gia sư giao được, cho ô chọn ở trang lớp quản trị)
//   POST { tutorId } (JSON, như mọi API của khu quản trị) → { ok, ownerId } | lỗi
// Quyền: MANAGE_COURSES và KHÔNG phải vai "teacher" (gia sư cũng có MANAGE_COURSES nhưng không được tự giao lớp) ⇒ chỉ admin_super / admin_content.
// Thứ tự: 401 chưa đăng nhập → 403 không phải quản trị trung tâm → 404 lớp → 400 tutorId / không phải gia sư hợp lệ / đã là chủ → 409 còn tiền chưa xử lý.
// TIỀN: chỉ đếm (src/lib/courseOwnerAssign.ts), không chuyển / sửa phiếu, khoản phí. Nhật ký: chỉ mã (không tên, không email). Thông báo: không số tiền.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/auditLog";
import { notify } from "@/lib/notify";
import { classBase } from "@/lib/tutorClassRoutes";
import { ASSIGNABLE_TUTOR_WHERE, assignCourseOwner } from "@/lib/courseOwnerAssign";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" } as const;
const NOT_CENTER = "Chỉ quản trị trung tâm mới giao lớp được";
const TUTOR_LIMIT = 500;

async function centerAdmin() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;
  if (auth.adminRole !== "admin_super" && auth.adminRole !== "admin_content") return NextResponse.json({ error: NOT_CENTER }, { status: 403, headers: NO_STORE });
  return auth;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await centerAdmin();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id }, select: { ownerId: true, owner: { select: { id: true, name: true } } } });
  if (!course) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404, headers: NO_STORE });
  const tutors = await prisma.user.findMany({ where: ASSIGNABLE_TUTOR_WHERE, select: { id: true, name: true }, orderBy: { name: "asc" }, take: TUTOR_LIMIT });
  return NextResponse.json({ owner: course.owner ? { id: course.owner.id, name: course.owner.name } : null, tutors, truncated: tutors.length >= TUTOR_LIMIT }, { headers: NO_STORE });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await centerAdmin();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { tutorId?: unknown } | null;
  const tutorId = typeof body?.tutorId === "string" ? body.tutorId.trim() : "";
  if (!tutorId || tutorId.length > 64) {
    const exists = await prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ error: "Hãy chọn gia sư nhận lớp", code: "no_tutor" }, { status: 400, headers: NO_STORE });
  }
  const r = await assignCourseOwner(id, tutorId);
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code, ...(r.count !== undefined ? { count: r.count } : {}) }, { status: r.status, headers: NO_STORE });

  await logAction(auth.userId, "course.owner_assign", "Course", id, { fromOwnerId: r.fromOwnerId, toOwnerId: tutorId, removedCoTeacher: r.removedCoTeacher });
  const c = await prisma.course.findUnique({ where: { id }, select: { name: true } });
  await notify(tutorId, {
    type: "course_owner_assigned",
    title: "Bạn được giao lớp mới",
    message: `Bạn được giao lớp "${c?.name ?? id}". Lớp đã có trong Lớp của tôi.`,
    link: classBase(id),
  });
  return NextResponse.json({ ok: true, ownerId: tutorId, removedCoTeacher: r.removedCoTeacher }, { headers: NO_STORE });
}
