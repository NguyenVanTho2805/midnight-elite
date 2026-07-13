import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES       = ["admin", "student"] as const;
const ALLOWED_ADMIN_ROLES = ["admin_super", "admin_content", "teacher"] as const;

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_ADMINS);
  if (isNextResponse(auth)) return auth;

  const { id }              = await params;
  const { role, adminRole } = await req.json();

  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Role không hợp lệ" }, { status: 400 });
  }
  if (role === "admin" && adminRole && !ALLOWED_ADMIN_ROLES.includes(adminRole)) {
    return NextResponse.json({ error: "AdminRole không hợp lệ" }, { status: 400 });
  }
  if (id === auth.userId) {
    return NextResponse.json({ error: "Không thể thay đổi quyền của chính mình" }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { adminRole: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
    }

    // Không cho phép thao tác nếu đây là super admin duy nhất
    const willLoseSuper =
      target.adminRole === "admin_super" &&
      !(role === "admin" && adminRole === "admin_super");

    if (willLoseSuper) {
      const superCount = await prisma.user.count({ where: { adminRole: "admin_super" } });
      if (superCount <= 1) {
        return NextResponse.json(
          { error: "Không thể thao tác — đây là Super Admin duy nhất của hệ thống" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        role,
        adminRole: role === "admin" ? (adminRole ?? "admin_content") : null,
      },
      select: { id: true, role: true, adminRole: true },
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
    }
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
