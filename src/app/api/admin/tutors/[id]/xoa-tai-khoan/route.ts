// ADM-xoa-tk — POST /api/admin/tutors/[id]/xoa-tai-khoan: xoá (ẩn danh hoá) tài khoản gia sư (role admin + adminRole teacher). Chỉ admin_super.
// Không xoá chính mình, không xoá admin_content / admin_super.
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";
import { isAnonEmail, NOT_ANONYMIZED, countBlockers, pickBlocker, anonymizeUser } from "@/lib/accountDelete";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.DELETE_ACCOUNTS);
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, adminRole: true, email: true } });
    if (!user) return NextResponse.json({ error: "Không tìm thấy gia sư" }, { status: 404 });
    if (id === auth.userId) return NextResponse.json({ error: "Không thể tự xóa tài khoản của chính mình", code: "self" }, { status: 400 });
    if (user.role === "admin" && user.adminRole === "admin_super") {
      const supers = await prisma.user.count({ where: { role: "admin", adminRole: "admin_super", ...NOT_ANONYMIZED } });
      if (supers <= 1) return NextResponse.json({ error: "Đây là quản trị viên cấp cao cuối cùng, không thể xóa", code: "last_super" }, { status: 409 });
    }
    if (user.role !== "admin" || user.adminRole !== "teacher") {
      return NextResponse.json({ error: "Chỉ xóa được tài khoản gia sư ở đây", code: "not_tutor" }, { status: 403 });
    }
    if (isAnonEmail(user.email)) return NextResponse.json({ ok: true, alreadyDeleted: true });

    const counts = await countBlockers(id, "tutor");
    const blocker = pickBlocker(counts);
    if (blocker) return NextResponse.json({ error: blocker.error, code: blocker.code, ...(blocker.extra ?? {}) }, { status: blocker.status });

    const did = await anonymizeUser(id, "tutor");
    if (!did) return NextResponse.json({ ok: true, alreadyDeleted: true });
    if ("blocker" in did) return NextResponse.json({ error: did.blocker.error, code: did.blocker.code, ...(did.blocker.extra ?? {}) }, { status: did.blocker.status });
    await logAction(auth.userId, "account.delete", "User", id, { kind: "tutor", walletBalance: counts.walletBalance, approvedTopups: counts.approvedTopups, openInvoices: counts.openInvoices });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/admin/tutors/:id/xoa-tai-khoan]", e);
    return NextResponse.json({ error: "Lỗi xóa tài khoản" }, { status: 500 });
  }
}
