// ĐX-03 (NC1-040) — GET /api/courses/[id]/attendance-export?month=YYYY-MM&format=json|csv|xlsx
//
// Bảng điểm danh THÁNG của một lớp (học sinh × ngày có buổi). `json` cho trang in (…/diem-danh/in), `csv` và `xlsx` để tải về.
// Chỉ gia sư chủ lớp và quản trị (cùng luật với api/courses/[id]/attendance-sessions). Tên học sinh là dữ liệu cá nhân nên
// không bao giờ cache. `month` thiếu → tháng hiện tại (giờ VN); có nhưng sai định dạng → 400.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { toCsv } from "@/lib/revenue";
import { attendanceXlsx } from "@/lib/attendanceXlsx";
import {
  buildAttendanceGrid, exportFileName, gridToMatrix, monthRangeUtc, parseExportMonth,
  type GridRecord, type GridStudent,
} from "@/lib/attendanceExport";

const NO_STORE = { "Cache-Control": "no-store" };
const FORMATS = ["json", "csv", "xlsx"] as const;
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  const course = await prisma.course.findUnique({ where: { id }, select: { name: true, ownerId: true } });
  if (!course) return fail(404, "Không tìm thấy lớp");
  if (!ownsResource(auth, course.ownerId)) return fail(403, "Bạn không có quyền với lớp này");

  const sp = req.nextUrl.searchParams;
  const month = parseExportMonth(sp.get("month"));
  if (!month.ok) return fail(400, "month phải có dạng YYYY-MM");
  const format = sp.get("format") ?? "json";
  if (!(FORMATS as readonly string[]).includes(format)) return fail(400, "format phải là json, csv hoặc xlsx");

  const { start, endExclusive } = monthRangeUtc(month.month);
  const sessions = await prisma.attendanceSession.findMany({
    where: { courseId: id, date: { gte: start, lt: endExclusive } },
    orderBy: { date: "asc" },
    select: { id: true, date: true },
  });
  const [enrollments, records] = await Promise.all([
    prisma.enrollment.findMany({ where: { courseId: id }, select: { userId: true, status: true, createdAt: true, user: { select: { name: true } } } }),
    sessions.length === 0
      ? Promise.resolve([] as GridRecord[])
      : prisma.attendanceRecord.findMany({ where: { sessionId: { in: sessions.map(s => s.id) } }, select: { sessionId: true, userId: true, status: true } }),
  ]);

  const students: GridStudent[] = enrollments.map(e => ({ id: e.userId, name: e.user.name, enrolledAt: e.createdAt, active: e.status === ENROLLMENT_STATUS.ACTIVE }));
  // Em có bản ghi trong tháng nhưng không còn dòng ghi danh nào (đã bị gỡ khỏi lớp): vẫn phải có mặt trong bảng.
  const known = new Set(students.map(s => s.id));
  const orphanIds = [...new Set(records.map(r => r.userId))].filter(u => !known.has(u));
  if (orphanIds.length > 0) {
    const users = await prisma.user.findMany({ where: { id: { in: orphanIds } }, select: { id: true, name: true } });
    for (const u of users) students.push({ id: u.id, name: u.name, enrolledAt: new Date(0), active: false });
  }

  const grid = buildAttendanceGrid({
    courseName: course.name, month: month.month, students, records,
    // `date` lưu 00:00 UTC của ngày VN (normalizeAttendanceDate) nên phần ngày của ISO chính là ngày buổi học.
    sessions: sessions.map(s => ({ id: s.id, dateKey: s.date.toISOString().slice(0, 10) })),
  });

  if (format === "json") return NextResponse.json(grid, { headers: NO_STORE });

  if (format === "csv") {
    return new NextResponse(toCsv(gridToMatrix(grid)), {
      headers: {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(course.name, month.month, "csv")}"`,
      },
    });
  }

  const bytes = await attendanceXlsx(grid);
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFileName(course.name, month.month, "xlsx")}"`,
    },
  });
}
