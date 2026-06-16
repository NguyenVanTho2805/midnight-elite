import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const blocked = limitOrBlock(`${getClientIp(req)}:${session.userId}`, "change-password", 5, 300_000); // 5 lần/5 phút
  if (blocked) return blocked;

  const { oldPassword, newPassword } = await req.json();

  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Mật khẩu mới cần ít nhất 8 ký tự" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });

  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
  }

  if (oldPassword === newPassword) {
    return NextResponse.json({ error: "Mật khẩu mới không được trùng mật khẩu cũ" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.userId },
    data:  { password: hashed },
  });

  return NextResponse.json({ success: true });
}
