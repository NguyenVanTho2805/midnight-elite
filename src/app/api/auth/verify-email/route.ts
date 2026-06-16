import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Thiếu token" }, { status: 400 });

  const record = await prisma.verifyToken.findUnique({
    where:   { token },
    include: { user: true },
  });

  if (!record)                          return NextResponse.json({ error: "Token không hợp lệ" }, { status: 400 });
  if (record.expiresAt < new Date())    return NextResponse.json({ error: "Token đã hết hạn" },   { status: 400 });
  if (record.user.emailVerified)        return NextResponse.json({ already: true });

  // Xác thực email
  await prisma.user.update({
    where: { id: record.userId },
    data:  { emailVerified: true },
  });

  // Xóa token đã dùng
  await prisma.verifyToken.delete({ where: { token } });

  // Tạo session luôn (đăng nhập tự động)
  await createSession({
    userId: record.userId,
    role:   record.user.role as "student" | "admin",
    ...(record.user.adminRole
      ? { adminRole: record.user.adminRole as "admin_super" | "admin_content" }
      : {}),
  });

  return NextResponse.json({ success: true, name: record.user.name });
}
