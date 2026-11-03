import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { staleVerification } from "@/lib/phone";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { logAction } from "@/lib/auditLog";

// PUT /api/admin/students/[id] — cập nhật thông tin học sinh
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const { name, phone, school } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Họ tên không được để trống" }, { status: 400 });
  }

  try {
    // Quản trị sửa số của học sinh: số đã xác minh (đăng nhập SMS) hết hiệu lực nếu số đổi.
    const cur = await prisma.user.findUnique({ where: { id }, select: { phoneE164: true, role: true, deletedAt: true } });
    if (cur && cur.role !== "student") {
      return NextResponse.json({ error: "Chỉ sửa được tài khoản học sinh ở đây", code: "not_student" }, { status: 403 });
    }
    if (cur?.deletedAt) {
      return NextResponse.json({ error: "Học sinh đang ẩn — khôi phục trước khi sửa", code: "hidden" }, { status: 409 });
    }
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(staleVerification(cur?.phoneE164, phone) ? { phoneE164: null, phoneVerifiedAt: null } : {}),
        name:   name.trim(),
        phone:  phone?.trim()  || null,
        school: school?.trim() || null,
      },
      select: { id: true, name: true, phone: true, school: true },
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
    }
    return NextResponse.json({ error: "Lỗi cập nhật" }, { status: 500 });
  }
}

// PATCH /api/admin/students/[id] — toggle ban học sinh
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { banned: true, deletedAt: true } });
    if (!user) return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
    // ADM-001 (4.6): không cho "Gỡ ban" vô tình mở đăng nhập cho tài khoản đã ẩn.
    if (user.deletedAt) {
      return NextResponse.json({ error: "Học sinh đã ẩn. Khôi phục trước khi khoá/mở khoá.", code: "hidden" }, { status: 409 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { banned: !user.banned },
      select: { id: true, banned: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Lỗi cập nhật" }, { status: 500 });
  }
}

// DELETE /api/admin/students/[id] — ẨN học sinh (ADM-001, thay cho xoá cứng).
// Trước đây `prisma.user.delete` kéo theo cascade ghi danh, điểm danh, ví, bài làm… — mất bằng chứng học phí/điểm danh nếu có tranh chấp.
// Nay: đặt `deletedAt = now` + `banned = true` (mượn cờ khoá để chặn đăng nhập mà không sửa tệp chung loginSession/sessionVerify);
// mọi bản ghi con GIỮ NGUYÊN. Khôi phục qua POST ./restore. Thứ tự kiểm, dừng ở lỗi đầu tiên (đặc tả mục 4.4).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, adminRole: true, banned: true, deletedAt: true } });
    if (!user) return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
    // Quản trị / gia sư có role "admin" → không ẩn qua đường này. Người đang nộp đơn gia sư vẫn role "student" nên vẫn ẩn được.
    if (user.role !== "student") {
      return NextResponse.json({ error: "Chỉ ẩn được tài khoản học sinh", code: "not_student" }, { status: 403 });
    }
    // Đã ẩn rồi → trả trạng thái hiện có, KHÔNG ghi nhật ký lần hai (mẫu profile_lock.remove).
    if (user.deletedAt) return NextResponse.json({ ok: true, alreadyHidden: true, deletedAt: user.deletedAt });

    // "Đang học" = Enrollment.status === "active" (isEnrollmentActive). pending_consent / suspended không chặn.
    const [activeCount, totalCount] = await Promise.all([
      prisma.enrollment.count({ where: { userId: id, status: ENROLLMENT_STATUS.ACTIVE } }),
      prisma.enrollment.count({ where: { userId: id } }),
    ]);
    if (activeCount > 0) {
      return NextResponse.json(
        { error: `Học sinh còn ${activeCount} lớp đang học. Thu hồi lớp trước khi ẩn.`, code: "active_enrollments", activeCount },
        { status: 409 },
      );
    }

    const now = new Date();
    await prisma.user.update({ where: { id }, data: { deletedAt: now, banned: true } });
    // Nhật ký SAU khi ghi DB thành công; metadata chỉ có số đếm / cờ — không tên, không email, không SĐT (adminOps.ts dòng 4-5).
    await logAction(auth.userId, "student.hide", "User", id, { activeEnrollments: 0, otherEnrollments: totalCount - activeCount, wasBanned: user.banned });
    return NextResponse.json({ ok: true, deletedAt: now });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
    }
    console.error("[DELETE /api/admin/students/:id]", e);
    return NextResponse.json({ error: "Lỗi ẩn học sinh" }, { status: 500 });
  }
}
