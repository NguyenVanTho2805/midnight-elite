import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// PUT /api/class-schedules/[id] — sửa 1 khung giờ học cố định.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    const existing = await prisma.classSchedule.findUnique({
      where: { id },
      select: { startTime: true, endTime: true, course: { select: { ownerId: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy khung giờ học" }, { status: 404 });
    if (!ownsResource(auth, existing.course.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
    }

    const body = await req.json();
    const { dayOfWeek, startTime, endTime, note, active } = body as {
      dayOfWeek?: number; startTime?: string; endTime?: string; note?: string | null; active?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (typeof dayOfWeek === "number") {
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        return NextResponse.json({ error: "Thứ trong tuần không hợp lệ" }, { status: 400 });
      }
      data.dayOfWeek = dayOfWeek;
    }
    if (startTime !== undefined) data.startTime = startTime.trim();
    if (endTime !== undefined) data.endTime = endTime.trim();
    // So sánh với giá trị HIỆU LỰC sau khi cập nhật (field không đổi thì lấy
    // giá trị cũ) — chỉ so 2 field trong body chưa đủ, vì sửa 1 mình
    // startTime/endTime riêng lẻ vẫn có thể tạo khoảng giờ ngược nếu không đối
    // chiếu với giá trị đang lưu của field còn lại.
    const nextStart = (data.startTime as string | undefined) ?? existing.startTime;
    const nextEnd = (data.endTime as string | undefined) ?? existing.endTime;
    if (nextEnd <= nextStart) {
      return NextResponse.json({ error: "Giờ kết thúc phải sau giờ bắt đầu" }, { status: 400 });
    }
    if (note !== undefined) data.note = note?.trim() || null;
    if (typeof active === "boolean") data.active = active;

    const schedule = await prisma.classSchedule.update({ where: { id }, data });
    return NextResponse.json(schedule);
  } catch (e) {
    console.error("[PUT /api/class-schedules/[id]]", id, e);
    return NextResponse.json({ error: "Cập nhật khung giờ học thất bại" }, { status: 400 });
  }
}

// DELETE /api/class-schedules/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    const existing = await prisma.classSchedule.findUnique({
      where: { id },
      select: { course: { select: { ownerId: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy khung giờ học" }, { status: 404 });
    if (!ownsResource(auth, existing.course.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
    }

    await prisma.classSchedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/class-schedules/[id]]", id, e);
    return NextResponse.json({ error: "Xoá khung giờ học thất bại" }, { status: 400 });
  }
}
