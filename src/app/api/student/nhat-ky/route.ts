// SCL5 (D15, ghép từ phương án B): "Nhật ký đêm học" — 14 buổi gần nhất CHÍNH em đã được điểm danh, ở các lớp em đang học. Chỉ trạng thái + ngày + tên lớp:
// không ghi chú của gia sư, không ai khác. Không có bản ghi nào ⇒ items rỗng ⇒ màn Hôm nay ẩn khối (không bịa chuỗi).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireStudentRole } from "@/lib/studentOnly";
import { nhatKyStatus } from "@/lib/studentClassPage";

export async function GET() {
  const s = await requireStudentRole();
  if (isNextResponse(s)) return s;
  try {
    const rows = await prisma.attendanceRecord.findMany({
      where: { userId: s.userId, session: { course: { enrollments: { some: { userId: s.userId, status: "active" } } } } },
      orderBy: [{ session: { date: "desc" } }, { id: "asc" }],
      take: 14,
      select: { status: true, session: { select: { date: true, course: { select: { name: true } } } } },
    });
    const items = rows.flatMap(r => { const st = nhatKyStatus(r.status); return st ? [{ dateKey: r.session.date.toISOString().slice(0, 10), courseName: r.session.course.name, status: st }] : []; }).reverse();
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[GET /api/student/nhat-ky]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
