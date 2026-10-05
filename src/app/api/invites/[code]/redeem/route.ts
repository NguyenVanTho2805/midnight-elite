// BE-067 (1.4.6) — POST /api/invites/[code]/redeem.
//
// Học viên nhập mã mời để vào lớp. Yêu cầu đăng nhập (không public như backlog
// gợi ý — public dễ bị dùng để dò mã bằng brute force 31^8). Luồng:
//   1. Tìm invite theo code (`findUnique` — code có @unique).
//   2. Kiểm hợp lệ: !revoked, chưa hết hạn, còn lượt.
//   3. Trong $transaction + pg_advisory_xact_lock theo invite.id:
//      a. updateMany tăng `usedCount` NẾU còn lượt (atomic — 2 học viên bấm
//         cùng giây cuối không vượt maxUses).
//      b. Kiểm Course.classStatus, Course.capacity (dưới active count).
//      c. Enrollment.upsert — status qua `deriveStatusForNewEnrollment`.
//   4. logAction "class_invite.redeem" + "enrollment.create".
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { invites, checkInviteValidity } from "@/lib/classInvite";
import { deriveStatusForNewEnrollment, ENROLLMENT_STATUS } from "@/lib/enrollment";
import { logAction } from "@/lib/auditLog";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (session.role !== "student") {
    return NextResponse.json({ error: "Chỉ học viên mới redeem mã mời" }, { status: 403 });
  }

  const { code } = await params;
  if (typeof code !== "string" || code.length < 4 || code.length > 20) {
    return NextResponse.json({ error: "Mã mời không hợp lệ" }, { status: 400 });
  }

  const inv = await invites().findUnique({ where: { code } });
  const pre = checkInviteValidity(inv);
  if (!pre.ok) return NextResponse.json({ error: pre.error }, { status: pre.status });

  // Đã đăng ký rồi — không cần redeem nữa, trả 200 idempotent để UI hiển thị
  // "bạn đã trong lớp" chứ không ra 409 lạc đề.
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId: inv!.courseId } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyEnrolled: true, courseId: inv!.courseId });
  }

  const course = await prisma.course.findUnique({
    where:  { id: inv!.courseId },
    select: { id: true, name: true, classStatus: true, capacity: true },
  });
  if (!course) return NextResponse.json({ error: "Lớp không còn tồn tại" }, { status: 404 });
  if (course.classStatus !== "open") {
    return NextResponse.json({ error: "Lớp đang đóng, không nhận học viên mới" }, { status: 409 });
  }

  const status = await deriveStatusForNewEnrollment(session.userId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Khoá theo invite.id — 2 học viên redeem cùng mã xếp hàng.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`class_invite:${inv!.id}`}))`;

      // Capacity check đọc trong transaction để không race với redeem khác.
      if (course.capacity !== null) {
        const activeCount = await tx.enrollment.count({
          where: { courseId: course.id, status: ENROLLMENT_STATUS.ACTIVE },
        });
        if (activeCount >= course.capacity) {
          throw Object.assign(new Error("CAPACITY_FULL"), { status: 409, body: "Lớp đã đầy" });
        }
      }

      // Atomic increment: KHÔNG tăng nếu đã đạt maxUses — tránh race ở giây cuối.
      const txInvites = invites(tx as unknown as typeof prisma);
      const bumped = await txInvites.updateMany({
        where: inv!.maxUses === null
          ? { id: inv!.id, revoked: false }
          : { id: inv!.id, revoked: false, usedCount: { lt: inv!.maxUses } as unknown as number },
        data: { usedCount: { increment: 1 } },
      });
      if (bumped.count === 0) {
        throw Object.assign(new Error("INVITE_UNAVAILABLE"), { status: 409, body: "Mã mời đã hết lượt sử dụng" });
      }

      const enr = await tx.enrollment.create({
        data: { userId: session.userId, courseId: course.id, status },
      });
      return enr;
    });

    await logAction(session.userId, "class_invite.redeem", "ClassInvite", inv!.id, {
      courseId: course.id, code, enrollmentId: result.id,
    });
    await logAction(session.userId, "enrollment.create", "Enrollment", result.id, {
      courseId: course.id, status, source: "class_invite", inviteId: inv!.id,
    });

    return NextResponse.json({ ok: true, enrollmentId: result.id, courseId: course.id, status });
  } catch (e: unknown) {
    const err = e as { status?: number; body?: string; message?: string };
    if (err.status && err.body) return NextResponse.json({ error: err.body }, { status: err.status });
    console.error("[POST /api/invites/[code]/redeem]", e);
    return NextResponse.json({ error: "Redeem mã mời thất bại" }, { status: 500 });
  }
}
