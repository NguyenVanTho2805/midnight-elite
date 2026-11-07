// ADM-001 — POST /api/admin/students/[id]/restore: khôi phục học sinh đã ẩn (đối xứng với DELETE ../route.ts).
// Đặt deletedAt = null và banned = false vô điều kiện (quản trị khoá lại tay nếu em vốn bị khoá trước đó — màn ghi rõ ở toast).
// Chỉ có POST; GET/DELETE trả 405 mặc định của Next.
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";
import { isAnonEmail } from "@/lib/accountDelete";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, deletedAt: true, email: true } });
    if (!user) return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
    if (user.role !== "student") {
      return NextResponse.json({ error: "Chỉ khôi phục được tài khoản học sinh", code: "not_student" }, { status: 403 });
    }
    // Đã ẩn danh (xoá vĩnh viễn) → không khôi phục được.
    if (isAnonEmail(user.email)) return NextResponse.json({ error: "Tài khoản đã xóa vĩnh viễn, không khôi phục được", code: "account_deleted" }, { status: 409 });
    // Đang hiện rồi → không đổi gì, không ghi nhật ký.
    if (!user.deletedAt) return NextResponse.json({ ok: true, alreadyVisible: true });

    await prisma.user.update({ where: { id }, data: { deletedAt: null, banned: false } });
    await logAction(auth.userId, "student.restore", "User", id, {});
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
    }
    console.error("[POST /api/admin/students/:id/restore]", e);
    return NextResponse.json({ error: "Lỗi khôi phục học sinh" }, { status: 500 });
  }
}
