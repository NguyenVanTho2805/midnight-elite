import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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
    const updated = await prisma.user.update({
      where: { id },
      data: {
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

// DELETE /api/admin/students/[id] — xóa tài khoản học sinh
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
    }
    return NextResponse.json({ error: "Lỗi xóa học sinh" }, { status: 500 });
  }
}
