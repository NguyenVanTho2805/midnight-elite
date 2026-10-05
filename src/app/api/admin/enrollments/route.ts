import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendEnrollmentEmail } from "@/lib/email";
import { deriveStatusForNewEnrollment } from "@/lib/enrollment";

// POST — kích hoạt khoá học cho học sinh
export async function POST(req: Request) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  const { userId, courseId } = await req.json();
  if (typeof userId !== "string" || typeof courseId !== "string" || !userId || !courseId) {
    return NextResponse.json({ error: "Thiếu userId hoặc courseId" }, { status: 400 });
  }
  const [user, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }),
  ]);
  if (!user)   return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  if (!course) return NextResponse.json({ error: "Không tìm thấy khoá học" }, { status: 404 });

  // Status cho enrollment MỚI đi qua helper chung (BE-046). D04 chốt không có
  // ngưỡng tuổi nên hiện luôn "active"; enrollment đã có giữ nguyên status.
  const status = await deriveStatusForNewEnrollment(userId);
  const enrollment = await prisma.enrollment.upsert({
    where:  { userId_courseId: { userId, courseId } },
    create: { userId, courseId, status },
    update: {},
    include: {
      user:   { select: { name: true, email: true, studentId: true } },
      course: { select: { name: true, instructor: true, openDate: true, zaloGroupLink: true } },
    },
  });

  await notify(userId, {
    type:    "enrollment",
    title:   "Khóa học đã được kích hoạt",
    message: `Bạn đã được kích hoạt khóa học "${enrollment.course.name}"`,
    link:    `/student/hoc-tap?course=${courseId}`,
  });

  try {
    await sendEnrollmentEmail(
      enrollment.user.email,
      enrollment.user.name,
      enrollment.user.studentId,
      enrollment.course.name,
      courseId,
      enrollment.course.instructor,
      enrollment.course.openDate,
      enrollment.course.zaloGroupLink,
    );
  } catch (e) {
    console.error("[enrollments] sendEnrollmentEmail failed:", e);
  }

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
