// BE-067 (1.4.6) — POST /api/invites/<code>/redeem.
// Thư mục tên [id] (không phải [code]) vì Next.js không cho hai segment động
// khác tên cùng cấp: /api/invites/[id] (thu hồi, BE-066) dùng chung cấp này.
// Giá trị trong URL ở route này là MÃ MỜI (code), không phải id.
//
// Học viên nhập mã mời để vào lớp. Yêu cầu đăng nhập (không public như backlog
// gợi ý — public dễ bị dùng để dò mã bằng brute force 31^8). Luồng:
//   0. Kiểm NGƯỜI trước khi kiểm MÃ (TUT-002): session.role phải là student, rồi đọc
//      User (tutorAppliedAt/tutorVerified/tutorRejectedAt) → `canSelfEnroll`. Người
//      đang chờ duyệt gia sư → 403 { code: "TUTOR_PENDING" }; approved nhưng role
//      còn student (lệch dữ liệu) → 403 không code. Chặn TRƯỚC mọi truy vấn invite /
//      transaction nên usedCount, Enrollment, auditLog đều không bị chạm.
//   1. Tìm invite theo code (`findUnique` — code có @unique).
//   2. Kiểm hợp lệ: !revoked, chưa hết hạn, còn lượt.
//   3. BU-01: `redeemOutcome` (src/lib/joinRequest.ts) quyết định: mã cá nhân của người khác → 403 (không đụng usedCount);
//      lớp "approve" → tạo yêu cầu chờ duyệt (submitJoinRequestTx, KHÔNG có Enrollment); còn lại → vào lớp ngay.
//   4. Vào lớp đi qua `enrollInTx` (src/lib/enrollServer.ts) — đường duy nhất tạo Enrollment — rồi `updateMany` tăng
//      `usedCount` nguyên tử trong cùng giao dịch (2 học viên bấm cùng giây cuối không vượt maxUses).
//   5. logAction "class_invite.redeem" + "enrollment.create" (sau commit).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { invites, checkInviteValidity } from "@/lib/classInvite";
import { logAction } from "@/lib/auditLog";
import { canSelfEnroll, ENROLL_NOT_STUDENT_MESSAGE, ENROLL_TUTOR_PENDING_MESSAGE } from "@/lib/enrollEligibility";
import { isApplicant } from "@/lib/tutorGate";
import { loadTutorStatus } from "@/lib/tutorGateServer";
import { effectivePolicy, redeemOutcome } from "@/lib/joinRequest";
import { enrollInTx, logEnrollment, submitJoinRequestTx, notifyTutorNewJoinRequest } from "@/lib/enrollServer";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (session.role !== "student") {
    return NextResponse.json({ error: ENROLL_NOT_STUDENT_MESSAGE }, { status: 403 });
  }

  // TUT-002: token phiên không có tutorAppliedAt → đọc DB một lần, TRƯỚC khi đụng mã mời.
  const me = await prisma.user.findUnique({
    where:  { id: session.userId },
    select: { role: true, tutorAppliedAt: true, tutorVerified: true, tutorRejectedAt: true },
  });
  if (!me) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const eligible = canSelfEnroll(me);
  if (!eligible.ok) {
    if (eligible.reason === "tutor_pending") {
      return NextResponse.json({ error: ENROLL_TUTOR_PENDING_MESSAGE, code: "TUTOR_PENDING" }, { status: 403 });
    }
    return NextResponse.json({ error: ENROLL_NOT_STUDENT_MESSAGE }, { status: 403 });
  }
  // Người nộp đơn gia sư vẫn là role student nhưng chưa phải học viên của lớp nào qua đường này.
  if (isApplicant(await loadTutorStatus(session))) {
    return NextResponse.json({ error: "Tài khoản gia sư chờ duyệt chưa vào lớp bằng cách này" }, { status: 403 });
  }

  const { id: code } = await params;
  if (typeof code !== "string" || code.length < 4 || code.length > 20) {
    return NextResponse.json({ error: "Mã mời không hợp lệ" }, { status: 400 });
  }

  const inv = await invites().findUnique({ where: { code } });
  // Đã có yêu cầu pending bằng chính mã này (bấm lại / F5): trả lại idempotent, không đòi mã còn lượt (mã cá nhân maxUses 1 đã dùng).
  if (inv && (!inv.boundUserId || inv.boundUserId === session.userId)) {
    // Đã là thành viên: trả idempotent dù mã đã hết lượt (mã cá nhân maxUses 1). Mã gắn người khác không vào nhánh này (đi tiếp tới 403).
    const enrolledAlready = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId: inv.courseId } }, select: { id: true } });
    if (enrolledAlready) return NextResponse.json({ ok: true, alreadyEnrolled: true, courseId: inv.courseId });
    const mine = await prisma.classJoinRequest.findUnique({ where: { userId_courseId: { userId: session.userId, courseId: inv.courseId } }, select: { id: true, status: true, inviteId: true } });
    if (mine && mine.status === "pending" && mine.inviteId === inv.id && !inv.revoked) {
      return NextResponse.json({ ok: true, pending: true, requestId: mine.id, courseId: inv.courseId });
    }
  }
  const pre = checkInviteValidity(inv);
  if (!pre.ok) return NextResponse.json({ error: pre.error }, { status: pre.status });

  const course = await prisma.course.findUnique({
    where:  { id: inv!.courseId },
    select: { id: true, name: true, classStatus: true, capacity: true, ownerId: true, joinPolicy: true },
  });
  if (!course) return NextResponse.json({ error: "Lớp không còn tồn tại" }, { status: 404 });

  // Mã cá nhân của người khác: từ chối TRƯỚC mọi thứ khác (không lộ lớp, không tăng lượt, không tạo yêu cầu).
  const outcome = redeemOutcome({ policy: effectivePolicy(course.joinPolicy), invite: { kind: inv!.kind ?? null, boundUserId: inv!.boundUserId ?? null }, userId: session.userId });
  if (outcome.action === "deny") return NextResponse.json({ error: outcome.error }, { status: outcome.status });

  // Đã đăng ký rồi — không cần redeem nữa, trả 200 idempotent để UI hiển thị
  // "bạn đã trong lớp" chứ không ra 409 lạc đề.
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId: inv!.courseId } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyEnrolled: true, courseId: inv!.courseId });
  }

  if (course.classStatus !== "open") {
    return NextResponse.json({ error: "Lớp đang đóng, không nhận học viên mới" }, { status: 409 });
  }

  try {
    if (outcome.action === "request") {
      const r = await prisma.$transaction((tx) => submitJoinRequestTx(tx, { userId: session.userId, courseId: course.id, invite: { id: inv!.id, maxUses: inv!.maxUses } }));
      if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
      if (r.created) {
        await logAction(session.userId, "class_join_request.create", "ClassJoinRequest", r.requestId, { courseId: course.id, inviteId: inv!.id });
        await notifyTutorNewJoinRequest(course);
      }
      return NextResponse.json({ ok: true, pending: true, requestId: r.requestId, courseId: course.id });
    }

    const result = await prisma.$transaction(async (tx) => {
      const enr = await enrollInTx(tx, { userId: session.userId, course, source: "class_invite", inviteId: inv!.id });
      if (!enr.ok) throw Object.assign(new Error(enr.code), { status: enr.status, body: enr.error, code: enr.code });
      if (!enr.created) return enr;
      // Em đang có yêu cầu pending của lớp này mà lại vào được ngay bằng mã khác ⇒ chuyển yêu cầu thành approved trong CÙNG giao dịch
      // (không để hàng chờ của gia sư còn một dòng ma). Mã của yêu cầu đã giữ một lượt: nếu chính là mã này thì không tính lượt hai lần.
      const pendingReq = await tx.classJoinRequest.findUnique({ where: { userId_courseId: { userId: session.userId, courseId: course.id } }, select: { id: true, status: true, inviteId: true } });
      if (pendingReq?.status === "pending") {
        await tx.classJoinRequest.update({ where: { id: pendingReq.id }, data: { status: "approved", decidedAt: new Date(), note: null } });
        if (pendingReq.inviteId === inv!.id) return enr;
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
      return enr;
    });

    await logAction(session.userId, "class_invite.redeem", "ClassInvite", inv!.id, {
      courseId: course.id, code, enrollmentId: result.enrollmentId,
    });
    await logEnrollment(session.userId, result, { courseId: course.id, source: "class_invite", inviteId: inv!.id });

    return NextResponse.json({ ok: true, enrollmentId: result.enrollmentId, courseId: course.id, status: result.status });
  } catch (e: unknown) {
    const err = e as { status?: number; body?: string; message?: string; code?: string };
    if (err.status && err.body) return NextResponse.json(err.code === "CLASS_NOT_ACCEPTING" ? { error: err.body, code: err.code } : { error: err.body }, { status: err.status });
    console.error("[POST /api/invites/<code>/redeem]", e);
    return NextResponse.json({ error: "Redeem mã mời thất bại" }, { status: 500 });
  }
}
