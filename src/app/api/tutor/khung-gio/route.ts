// TUT-lich-keo-tha — khung giờ HẰNG TUẦN của các lớp của gia sư, để lưới kéo-thả vẽ "bóng" lớp khác và tính trùng giờ.
// GET ?courseId=<id> (tuỳ chọn, chỉ 1 lớp) &includeInactive=1 (kèm khung đã tắt).
// Chỉ trả giờ + tên lớp + hình thức/địa chỉ/ghi chú của khung: KHÔNG joinUrl, KHÔNG học sinh (ghost chỉ cần giờ và tên lớp).
// Quyền như các route lớp chị em: gia sư đã duyệt thấy lớp của mình; quản trị trung tâm thấy mọi lớp (ownsResource); học sinh / gia sư chờ duyệt 403; khách 401.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource, ownerScopeWhere } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { isClassColorKey } from "@/lib/classColor";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  const sp = new URL(req.url).searchParams;
  const courseId = sp.get("courseId");
  const includeInactive = sp.get("includeInactive") === "1";

  try {
    if (courseId !== null) {
      const c = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
      if (!c) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404, headers: NO_STORE });
      if (!ownsResource(auth, c.ownerId)) return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403, headers: NO_STORE });
    }
    const courses = await prisma.course.findMany({
      where: { ...ownerScopeWhere(auth), ...(courseId !== null ? { id: courseId } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, calendarColor: true,
        classSchedules: {
          where: includeInactive ? {} : { active: true },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          select: { id: true, dayOfWeek: true, startTime: true, endTime: true, note: true, mode: true, location: true, active: true },
        },
        _count: { select: { classSchedules: { where: { active: true } } } },
      },
    });
    const rules = courses.flatMap(c => c.classSchedules.map(s => ({
      id: s.id, courseId: c.id, courseName: c.name, color: isClassColorKey(c.calendarColor) ? c.calendarColor : null,
      dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, note: s.note, mode: s.mode, location: s.location, active: s.active,
    })));
    return NextResponse.json({
      rules,
      courses: courses.map(c => ({ id: c.id, name: c.name, scheduleCount: c._count.classSchedules })),
    }, { headers: NO_STORE });
  } catch (e) {
    console.error("[GET /api/tutor/khung-gio]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500, headers: NO_STORE });
  }
}
