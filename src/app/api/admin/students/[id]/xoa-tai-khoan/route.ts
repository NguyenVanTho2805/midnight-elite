// ADM-xoa-tk — POST /api/admin/students/[id]/xoa-tai-khoan: xoá (ẩn danh hoá) tài khoản học sinh. Chỉ admin_super (DELETE_ACCOUNTS).
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";
import { isAnonEmail, countBlockers, pickBlocker, anonymizeUser } from "@/lib/accountDelete";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.DELETE_ACCOUNTS);
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, email: true } });
    if (!user) return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
    if (user.role !== "student") return NextResponse.json({ error: "Chỉ xóa được tài khoản học sinh ở đây", code: "not_student" }, { status: 403 });
    if (isAnonEmail(user.email)) return NextResponse.json({ ok: true, alreadyDeleted: true });

    const counts = await countBlockers(id, "student");
    const blocker = pickBlocker(counts);
    if (blocker) return NextResponse.json({ error: blocker.error, code: blocker.code, ...(blocker.extra ?? {}) }, { status: blocker.status });

    const did = await anonymizeUser(id, "student");
    if (!did) return NextResponse.json({ ok: true, alreadyDeleted: true });
    if ("blocker" in did) return NextResponse.json({ error: did.blocker.error, code: did.blocker.code, ...(did.blocker.extra ?? {}) }, { status: did.blocker.status });
    // Metadata chỉ có số đếm — không tên, email, SĐT.
    await logAction(auth.userId, "account.delete", "User", id, { kind: "student", walletBalance: counts.walletBalance, approvedTopups: counts.approvedTopups, openInvoices: counts.openInvoices });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/admin/students/:id/xoa-tai-khoan]", e);
    return NextResponse.json({ error: "Lỗi xóa tài khoản" }, { status: 500 });
  }
}
