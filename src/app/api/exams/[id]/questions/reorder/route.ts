import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// PUT /api/exams/[id]/questions/reorder — admin: cập nhật order hàng loạt
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (!ownsResource(auth, exam.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
    }

    const { order } = await req.json() as { order?: { id: string; order: number }[] };
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: "Thiếu danh sách thứ tự" }, { status: 400 });
    }

    await prisma.$transaction(
      order.map(({ id, order: pos }) =>
        prisma.examQuestion.update({
          where: { id, examId },
          data: { order: pos },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[PUT /api/exams/[id]/questions/reorder]", e);
    return NextResponse.json({ error: "Sắp xếp lại thất bại" }, { status: 400 });
  }
}
