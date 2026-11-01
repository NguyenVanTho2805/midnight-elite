import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/auditLog";

// Kiểm tra quyền + quyền sở hữu khoá học của đánh giá `id`. Trả NextResponse
// (401/403/404) nếu bị chặn, null nếu được phép. requirePermission chạy trước
// để người chưa đăng nhập không dò được id nào tồn tại (404 vs 401).
async function guardReview(id: string): Promise<{ denied: NextResponse } | { actorId: string; courseId: string }> {
  const guard = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(guard)) return { denied: guard };

  const review = await prisma.courseReview.findUnique({
    where: { id },
    select: { courseId: true, course: { select: { ownerId: true } } },
  });
  if (!review) return { denied: NextResponse.json({ error: "Không tìm thấy đánh giá" }, { status: 404 }) };
  if (!ownsResource(guard, review.course.ownerId)) {
    return { denied: NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 }) };
  }
  return { actorId: guard.userId, courseId: review.courseId };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guardReview(id);
  if ("denied" in g) return g.denied;

  const { status } = await req.json();
  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
  }
  const review = await prisma.courseReview.update({ where: { id }, data: { status } });
  // BU-08: nhật ký duyệt / từ chối đánh giá (ai, việc gì, đối tượng). metadata chỉ có id lớp, không tên, không nhận xét.
  await logAction(g.actorId, status === "approved" ? "review.approve" : "review.reject", "CourseReview", id, { courseId: g.courseId });
  return NextResponse.json({ review });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guardReview(id);
  if ("denied" in g) return g.denied;

  await prisma.courseReview.delete({ where: { id } });
  await logAction(g.actorId, "review.delete", "CourseReview", id, { courseId: g.courseId });
  return NextResponse.json({ ok: true });
}
