import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logAction } from "@/lib/auditLog";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";

// GET /api/parent-consents/[token] — public, dùng cho trang xác nhận mở từ
// email (phụ huynh có thể chưa đăng nhập trên thiết bị đó). Chỉ trả thông
// tin tối thiểu cần hiển thị, không lộ dữ liệu khác của học viên.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const consent = await prisma.parentConsent.findUnique({
    where:   { token },
    include: {
      parentLink: { include: { student: { select: { name: true } } } },
      enrollment: { include: { course: { select: { name: true } } } },
    },
  });
  if (!consent) return NextResponse.json({ error: "Link không hợp lệ" }, { status: 404 });

  const expired = consent.status === "pending" && consent.expiresAt < new Date();
  if (expired) {
    // updateMany có điều kiện status="pending" là atomic — chỉ request nào
    // thực sự chuyển được trạng thái (count > 0) mới ghi log, tránh 2 request
    // cùng lúc (GET trùng GET, hoặc GET đua với POST) ghi trùng audit log.
    const result = await prisma.parentConsent.updateMany({
      where: { token, status: "pending", expiresAt: { lt: new Date() } },
      data:  { status: "expired" },
    });
    if (result.count > 0) {
      await logAction(null, "parent_consent.expired", "ParentConsent", consent.id, { enrollmentId: consent.enrollmentId });
    }
  }

  return NextResponse.json({
    status:      expired ? "expired" : consent.status,
    studentName: consent.parentLink.student.name,
    courseName:  consent.enrollment?.course.name ?? null,
    expiresAt:   consent.expiresAt,
  });
}

// POST /api/parent-consents/[token] — public, phụ huynh bấm đồng ý/từ chối
// từ email. Body: { decision: "approved" | "rejected" }
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const ip = getClientIp(req);
  const blocked = limitOrBlock(ip, "parent-consent-respond", 10, 60_000);
  if (blocked) return blocked;

  const { token } = await params;
  const { decision } = await req.json();
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision không hợp lệ" }, { status: 400 });
  }

  const consent = await prisma.parentConsent.findUnique({
    where:   { token },
    include: {
      parentLink: { include: { student: { select: { name: true } } } },
      enrollment: { include: { course: { select: { name: true, ownerId: true } } } },
    },
  });
  if (!consent) return NextResponse.json({ error: "Link không hợp lệ" }, { status: 404 });

  const now = new Date();
  if (consent.status === "pending" && consent.expiresAt < now) {
    const expireResult = await prisma.parentConsent.updateMany({
      where: { token, status: "pending", expiresAt: { lt: now } },
      data:  { status: "expired" },
    });
    if (expireResult.count > 0) {
      await logAction(null, "parent_consent.expired", "ParentConsent", consent.id, { enrollmentId: consent.enrollmentId });
    }
    return NextResponse.json({ error: "Link đã hết hạn, vui lòng yêu cầu gửi lại" }, { status: 410 });
  }

  // updateMany với điều kiện status="pending" là bước ghi atomic thật sự —
  // count === 0 nghĩa là request khác đã xử lý (approve/reject/expire) trước,
  // tránh 2 request cùng lúc đều pass qua và ghi trùng notify + audit log.
  const result = await prisma.parentConsent.updateMany({
    where: { token, status: "pending", expiresAt: { gte: now } },
    data:  { status: decision, respondedAt: now },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Yêu cầu này đã được xử lý hoặc đã hết hạn, không thể xử lý lại" }, { status: 409 });
  }
  await logAction(consent.parentLink.parentId, `parent_consent.${decision}`, "ParentConsent", consent.id, {
    enrollmentId: consent.enrollmentId, studentId: consent.parentLink.studentId, ip: getClientIp(req),
  });

  const studentName = consent.parentLink.student.name;
  const courseName  = consent.enrollment?.course.name ?? "";
  const approved    = decision === "approved";

  await notify(consent.parentLink.studentId, {
    type:    "parent_consent_responded",
    title:   approved ? "Phụ huynh đã đồng ý" : "Phụ huynh đã từ chối",
    message: approved
      ? `Phụ huynh đã đồng ý cho bạn tham gia lớp "${courseName}".`
      : `Phụ huynh đã từ chối yêu cầu tham gia lớp "${courseName}".`,
    link: `/student/hoc-tap`,
  });

  const ownerId = consent.enrollment?.course.ownerId;
  if (ownerId) {
    await notify(ownerId, {
      type:    "parent_consent_responded",
      title:   "Cập nhật xác nhận phụ huynh",
      message: `Phụ huynh của ${studentName} đã ${approved ? "đồng ý" : "từ chối"} cho tham gia lớp "${courseName}".`,
      link:    `/admin/hoc-sinh`,
    });
  }

  return NextResponse.json({ status: decision });
}
