import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// POST — kích hoạt khoá học cho học sinh
export async function POST(req: Request) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  const { userId, courseId } = await req.json();
  if (!userId || !courseId) {
    return NextResponse.json({ error: "Thiếu userId hoặc courseId" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.upsert({
    where:  { userId_courseId: { userId, courseId } },
    create: { userId, courseId },
    update: {},
    include: { course: { select: { name: true } } },
  });

  await notify(userId, {
    type:    "enrollment",
    title:   "Khóa học đã được kích hoạt",
    message: `Bạn đã được kích hoạt khóa học "${enrollment.course.name}"`,
    link:    `/student/hoc-tap?course=${courseId}`,
  });

  return NextResponse.json(enrollment);
}

// DELETE — thu hồi khoá học
export async function DELETE(req: Request) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  const { userId, courseId } = await req.json();
  if (!userId || !courseId) {
    return NextResponse.json({ error: "Thiếu userId hoặc courseId" }, { status: 400 });
  }

  await prisma.enrollment.deleteMany({ where: { userId, courseId } });
  return NextResponse.json({ success: true });
}
