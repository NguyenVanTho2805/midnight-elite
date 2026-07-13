import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/exams/[id]/guest-access — admin: danh sách guest đã được duyệt phí
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  if (!ownsResource(auth, exam.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
  }

  const grants = await prisma.examGuestAccess.findMany({
    where: { examId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { grantedAt: "desc" },
  });
  return NextResponse.json(grants);
}

// POST /api/exams/[id]/guest-access — admin: duyệt phí thủ công cho 1 guest
// (tái dùng quy trình sales hiện có — không có cổng thanh toán tự động)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  if (!ownsResource(auth, exam.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
  }

  try {
    const { email } = await req.json() as { email?: string };
    if (!email?.trim()) {
      return NextResponse.json({ error: "Thiếu email học viên/guest" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (!targetUser) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản với email này" }, { status: 404 });
    }

    const grant = await prisma.examGuestAccess.upsert({
      where: { userId_examId: { userId: targetUser.id, examId } },
      create: { userId: targetUser.id, examId, grantedBy: auth.userId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(grant, { status: 201 });
  } catch (e) {
    console.error("[POST /api/exams/[id]/guest-access]", e);
    return NextResponse.json({ error: "Duyệt phí thất bại" }, { status: 400 });
  }
}
