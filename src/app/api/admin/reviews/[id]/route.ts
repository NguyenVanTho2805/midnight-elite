import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// Kiểm tra quyền + quyền sở hữu khoá học của đánh giá `id`. Trả NextResponse
// (401/403/404) nếu bị chặn, null nếu được phép. requirePermission chạy trước
// để người chưa đăng nhập không dò được id nào tồn tại (404 vs 401).
async function guardReview(id: string): Promise<NextResponse | null> {
  const guard = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(guard)) return guard;

  const review = await prisma.courseReview.findUnique({
    where: { id },
    select: { course: { select: { ownerId: true } } },
  });
  if (!review) return NextResponse.json({ error: "Không tìm thấy đánh giá" }, { status: 404 });
  if (!ownsResource(guard, review.course.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await guardReview(id);
  if (denied) return denied;

  const { status } = await req.json();
  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
  }
  const review = await prisma.courseReview.update({ where: { id }, data: { status } });
  return NextResponse.json({ review });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await guardReview(id);
  if (denied) return denied;

  await prisma.courseReview.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
