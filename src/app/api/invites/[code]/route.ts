// FE-125 helper — GET /api/invites/[code]
//
// Trả preview thông tin lớp từ 1 code mã mời. Dùng cho UI validate real-time
// trước khi học viên bấm "Tham gia" (POST redeem). Không chạm Enrollment,
// không tăng usedCount — chỉ đọc.
//
// Scope: chỉ user đã đăng nhập (chống dò brute force 31^8 code — cùng lý do
// POST redeem đã bắt).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { invites, checkInviteValidity } from "@/lib/classInvite";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { code } = await params;
  if (typeof code !== "string" || code.length < 4 || code.length > 20) {
    return NextResponse.json({ status: "invalid", error: "Mã mời không hợp lệ" }, { status: 400 });
  }

  const inv = await invites().findUnique({ where: { code } });
  const v = checkInviteValidity(inv);
  if (!v.ok) {
    // Vẫn 200 để UI có thể hiển thị thông báo cụ thể mà không phải catch
    // từng status code riêng.
    return NextResponse.json({ status: "invalid", reason: v.status, error: v.error });
  }

  const course = await prisma.course.findUnique({
    where:  { id: inv!.courseId },
    select: {
      id: true, name: true, shortTitle: true, category: true,
      classStatus: true, capacity: true,
      owner: { select: { id: true, name: true } },
    },
  });
  if (!course) return NextResponse.json({ status: "invalid", error: "Lớp không còn tồn tại" });

  // Kiểm đã enroll chưa — UI dựa vào để đổi CTA.
  const existing = await prisma.enrollment.findUnique({
    where:  { userId_courseId: { userId: session.userId, courseId: course.id } },
    select: { id: true, status: true },
  });

  return NextResponse.json({
    status:          "ok",
    code:            inv!.code,
    maxUses:         inv!.maxUses,
    usedCount:       inv!.usedCount,
    expiresAt:       inv!.expiresAt,
    course: {
      id:          course.id,
      name:        course.name,
      shortTitle:  course.shortTitle,
      category:    course.category,
      classStatus: course.classStatus,
      capacity:    course.capacity,
      owner:       course.owner,
    },
    alreadyEnrolled: !!existing && existing.status === "active",
  });
}
