import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/courses/[id]/class-schedules — danh sách khung giờ học cố định
// hàng tuần của 1 khoá (dùng cho tab "Lịch học" trong trang sửa khoá học).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  const { id: courseId } = await params;

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
    if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
    if (!ownsResource(auth, course.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
    }

    const schedules = await prisma.classSchedule.findMany({
      where: { courseId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(schedules);
  } catch (e) {
    console.error("[GET /api/courses/[id]/class-schedules]", courseId, e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

// POST /api/courses/[id]/class-schedules — thêm 1 khung giờ học cố định mới.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  const { id: courseId } = await params;

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
    if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
    if (!ownsResource(auth, course.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
    }

    const body = await req.json();
    const { dayOfWeek, startTime, endTime, note } = body as {
      dayOfWeek?: number; startTime?: string; endTime?: string; note?: string;
    };
    if (
      typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6 ||
      !startTime?.trim() || !endTime?.trim()
    ) {
      return NextResponse.json({ error: "Thiếu thứ trong tuần hoặc giờ bắt đầu/kết thúc" }, { status: 400 });
    }
    if (endTime.trim() <= startTime.trim()) {
      return NextResponse.json({ error: "Giờ kết thúc phải sau giờ bắt đầu" }, { status: 400 });
    }

    const schedule = await prisma.classSchedule.create({
      data: {
        courseId, dayOfWeek,
        startTime: startTime.trim(), endTime: endTime.trim(),
        note: note?.trim() || null,
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (e) {
    console.error("[POST /api/courses/[id]/class-schedules]", courseId, e);
    return NextResponse.json({ error: "Thêm khung giờ học thất bại" }, { status: 400 });
  }
}
