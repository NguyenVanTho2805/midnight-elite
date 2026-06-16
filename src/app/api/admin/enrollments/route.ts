import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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
