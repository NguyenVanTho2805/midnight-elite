import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Mật khẩu cần ít nhất 8 ký tự" }, { status: 400 });
    }

    const record = await prisma.passwordResetToken.findUnique({
      where:   { token },
      include: { user: true },
    });

    if (!record) {
      return NextResponse.json({ error: "Link không hợp lệ hoặc đã được sử dụng" }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Link đã hết hạn — vui lòng yêu cầu lại" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Đổi mật khẩu và xoá token trong cùng 1 transaction — tránh token bị dùng lại nếu crash giữa chừng
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
      prisma.passwordResetToken.delete({ where: { token } }),
    ]);

    // Tự động đăng nhập sau khi đổi mật khẩu
    await createSession({
      userId: record.userId,
      role:   record.user.role as "student" | "admin",
      ...(record.user.adminRole
        ? { adminRole: record.user.adminRole as "admin_super" | "admin_content" }
        : {}),
    });

    return NextResponse.json({ success: true, role: record.user.role });
  } catch (e) {
    console.error("[reset-password]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
