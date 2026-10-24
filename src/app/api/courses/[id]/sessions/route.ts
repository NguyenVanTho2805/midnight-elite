// LI-11 / LI-16 / LI-17 — thêm nhanh một buổi ngoài lịch tuần: buổi lẻ, dạy bù, phát sinh. Hiện trên Lịch.
//   POST { dateKey, startTime, endTime, kind: "extra"|"makeup"|"adhoc", mode?, location?, joinUrl?, force? }
//   Có xung đột lịch (LI-10) mà chưa force → 409 { needsConfirm, conflicts } (không ghi gì).
// Mở rộng AttendanceSession bằng cột nullable (KE-HOACH mục 6.2 hướng b). Mỗi lớp mỗi ngày một bản ghi buổi (ràng buộc sẵn có
// @@unique([courseId, date])): ngày đã có bản ghi (đã điểm danh/ghi chép) thì báo rõ, KHÔNG ghi đè.
// Không đụng điểm danh hay tiền: thêm buổi không tạo học phí; học phí kiểu mới chỉ sinh khi chốt buổi (Đã dạy xong).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { conflictText, parseExtraSession } from "@/lib/sessionBook";
import { authorizeCourse, conflictsForSlot, dayDate } from "@/lib/sessionBookServer";
import { logAction } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorizeCourse(id);
  if ("res" in r) return r.res;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const p = parseExtraSession(body, new Date());
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const v = p.value;

  if (body?.force !== true && r.course.ownerId) {
    const conflicts = await conflictsForSlot(r.course.ownerId, { courseId: id, dateKey: v.dateKey, startTime: v.startTime, endTime: v.endTime });
    if (conflicts.length) {
      return NextResponse.json({
        error: "Buổi này trùng lịch. Kiểm tra lại hoặc chọn vẫn thêm.", needsConfirm: true,
        conflicts: conflicts.map(c => ({ kind: c.kind, text: conflictText(c), courseName: c.other.courseName, sharedStudents: c.sharedStudents })),
      }, { status: 409 });
    }
  }
  try {
    const s = await prisma.attendanceSession.create({
      data: { courseId: id, date: dayDate(v.dateKey), createdBy: r.auth.userId, kind: v.kind, startTime: v.startTime, endTime: v.endTime, mode: v.mode, location: v.location, joinUrl: v.joinUrl },
      select: { id: true },
    });
    await logAction(r.auth.userId, "attendance_session.create_extra", "AttendanceSession", s.id, { courseId: id, kind: v.kind });
    return NextResponse.json({ id: s.id, dateKey: v.dateKey }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Ngày này lớp đã có bản ghi buổi (đã điểm danh hoặc ghi chép). Mở buổi đó để sửa, hoặc chọn ngày khác." }, { status: 409 });
    }
    console.error("[POST /api/courses/[id]/sessions]", id, e);
    return NextResponse.json({ error: "Không thêm được buổi" }, { status: 500 });
  }
}
