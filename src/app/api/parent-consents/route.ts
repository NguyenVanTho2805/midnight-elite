import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { checkPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendParentConsentEmail } from "@/lib/email";
import { PARENT_CONSENT_CONTENT_VERSION, PARENT_CONSENT_EXPIRY_MS } from "@/lib/parentConsent";

// POST /api/parent-consents — tạo (hoặc gửi lại) yêu cầu xác nhận phụ huynh
// cho 1 enrollment cụ thể. Body: { enrollmentId, parentLinkId? } hoặc
// { userId, courseId, parentLinkId? } (tiện cho UI admin/hoc-sinh đã có sẵn
// userId + courseId, không cần tra enrollmentId trước).
//
// Được phép gọi bởi: admin có MANAGE_STUDENTS, HOẶC chính phụ huynh có
// ParentLink đã "verified" với học viên của enrollment đó.
export async function POST(req: Request) {
  const session = await requireSession();
  if (isNextResponse(session)) return session;

  const { enrollmentId, userId, courseId, parentLinkId } = await req.json();
  if (!enrollmentId && !(userId && courseId)) {
    return NextResponse.json({ error: "Thiếu enrollmentId, hoặc userId + courseId" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where:   enrollmentId ? { id: enrollmentId } : { userId_courseId: { userId, courseId } },
    include: {
      user:   { select: { id: true, name: true } },
      course: { select: { id: true, name: true, ownerId: true } },
    },
  });
  if (!enrollment) return NextResponse.json({ error: "Không tìm thấy enrollment" }, { status: 404 });

  const isAdmin = session.role === "admin" && checkPermission(session.adminRole, PERMISSIONS.MANAGE_STUDENTS);

  // Chọn ParentLink đã verified để gửi yêu cầu tới
  const parentLink = parentLinkId
    ? await prisma.parentLink.findUnique({ where: { id: parentLinkId } })
    : await prisma.parentLink.findFirst({
        where: {
          studentId: enrollment.userId,
          status:    "verified",
          ...(isAdmin ? {} : { parentId: session.userId }),
        },
      });

  if (!parentLink || parentLink.studentId !== enrollment.userId || parentLink.status !== "verified") {
    return NextResponse.json(
      { error: "Học viên chưa có liên kết phụ huynh đã xác minh (verified) để gửi yêu cầu" },
      { status: 400 },
    );
  }
  if (!isAdmin && parentLink.parentId !== session.userId) {
    return NextResponse.json({ error: "Bạn không có quyền gửi yêu cầu cho liên kết này" }, { status: 403 });
  }

  const parent = await prisma.user.findUnique({
    where:  { id: parentLink.parentId },
    select: { id: true, name: true, email: true },
  });
  if (!parent) return NextResponse.json({ error: "Không tìm thấy tài khoản phụ huynh" }, { status: 404 });

  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + PARENT_CONSENT_EXPIRY_MS);

  const existing = await prisma.parentConsent.findUnique({ where: { enrollmentId: enrollment.id } });
  if (existing?.status === "approved") {
    return NextResponse.json({ error: "Enrollment này đã được phụ huynh đồng ý trước đó" }, { status: 409 });
  }
  if (existing?.status === "pending" && existing.expiresAt > new Date()) {
    return NextResponse.json({ error: "Đã có yêu cầu đang chờ phụ huynh xác nhận, chưa hết hạn" }, { status: 409 });
  }

  // Không có yêu cầu nào, hoặc yêu cầu cũ đã rejected/expired → tạo mới (hoặc
  // reset lại token trên đúng dòng cũ vì enrollmentId là unique 1-1).
  const consent = existing
    ? await prisma.parentConsent.update({
        where: { enrollmentId: enrollment.id },
        data:  {
          parentLinkId:   parentLink.id,
          token,
          status:         "pending",
          contentVersion: PARENT_CONSENT_CONTENT_VERSION,
          expiresAt,
          respondedAt:    null,
        },
      })
    : await prisma.parentConsent.create({
        data: {
          parentLinkId: parentLink.id,
          enrollmentId: enrollment.id,
          token,
          contentVersion: PARENT_CONSENT_CONTENT_VERSION,
          expiresAt,
        },
      });

  try {
    await sendParentConsentEmail(parent.email, parent.name, enrollment.user.name, enrollment.course.name, token);
  } catch (e) {
    console.error("[parent-consents] sendParentConsentEmail failed:", e);
  }

  await notify(parent.id, {
    type:    "parent_consent_requested",
    title:   "Yêu cầu xác nhận cho con bạn",
    message: `${enrollment.user.name} đang đăng ký lớp "${enrollment.course.name}", cần bạn xác nhận.`,
    link:    `/xac-nhan-phu-huynh?token=${token}`,
  });

  return NextResponse.json({ id: consent.id, status: consent.status, expiresAt: consent.expiresAt });
}
