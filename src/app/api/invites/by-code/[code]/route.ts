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
import { tuitionPreview } from "@/lib/invitePreview";
import { taughtSessionWhere } from "@/lib/taughtSessions";
import { effectivePolicy, isFreeClass, redeemOutcome } from "@/lib/joinRequest";
import { loadFeeRateCourseIds } from "@/lib/enrollServer";

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
      classStatus: true, capacity: true, joinPolicy: true, price: true, tag: true,
      owner: { select: { id: true, name: true } },
    },
  });
  if (!course) return NextResponse.json({ status: "invalid", error: "Lớp không còn tồn tại" });

  // BU-01: mã cá nhân của người khác — chỉ báo "gắn với tài khoản khác", KHÔNG trả tên lớp / gia sư / lịch.
  const policy = effectivePolicy(course.joinPolicy);
  const outcome = redeemOutcome({ policy, invite: { kind: inv!.kind ?? null, boundUserId: inv!.boundUserId ?? null }, userId: session.userId });
  if (outcome.action === "deny") return NextResponse.json({ status: "invalid", reason: outcome.status, error: outcome.error });

  // Kiểm đã enroll chưa — UI dựa vào để đổi CTA.
  const existing = await prisma.enrollment.findUnique({
    where:  { userId_courseId: { userId: session.userId, courseId: course.id } },
    select: { id: true, status: true },
  });

  // Xem trước cho học sinh (Figma 32:54): lịch học, số buổi đã học, học phí theo bậc thang SAU KHI vào lớp này.
  // Chỉ đọc. Học phí chỉ có khi lớp có gia sư phụ trách (học phí tính theo gia sư); lớp của trung tâm thì để null.
  const [slots, taught, otherSubjects, override, myRequest, rated] = await Promise.all([
    prisma.classSchedule.findMany({ where: { courseId: course.id, active: true }, select: { dayOfWeek: true, startTime: true, endTime: true } }),
    // ĐX-00: "đã học" = buổi đã diễn ra (ngày ≤ hôm nay giờ VN, có ít nhất 1 em có mặt/muộn), không đếm phiên rỗng.
    prisma.attendanceSession.count({ where: { courseId: course.id, ...taughtSessionWhere() } }),
    course.owner
      ? prisma.enrollment.count({ where: { userId: session.userId, status: "active", courseId: { not: course.id }, course: { ownerId: course.owner.id } } })
      : Promise.resolve(0),
    prisma.tuitionOverride.findUnique({ where: { userId: session.userId }, select: { pricePerSession: true } }),
    prisma.classJoinRequest.findUnique({
      where: { userId_courseId: { userId: session.userId, courseId: course.id } },
      select: { id: true, status: true, note: true, createdAt: true, decidedAt: true },
    }),
    loadFeeRateCourseIds([course.id]),
  ]);
  const isFree = isFreeClass({ price: course.price, tag: course.tag, hasFeeRate: rated.has(course.id) });

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
      isFree,
    },
    joinPolicy:      policy,
    boundToMe:       inv!.kind === "personal" && inv!.boundUserId === session.userId,
    pendingRequest:  myRequest?.status === "pending" ? { id: myRequest.id, createdAt: myRequest.createdAt } : null,
    rejection:       myRequest?.status === "rejected" ? { note: myRequest.note, decidedAt: myRequest.decidedAt } : null,
    alreadyEnrolled: !!existing && existing.status === "active",
    schedule:        slots,
    taught,
    tuition:         course.owner && !isFree ? tuitionPreview(otherSubjects, override?.pricePerSession ?? null) : null,
  });
}
