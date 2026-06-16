import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const blocked = limitOrBlock(ip, "forgot-password", 3, 300_000); // 3 lần/5 phút
  if (blocked) return blocked;

  try {
    const { email } = await req.json();
    if (!email?.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập email" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Luôn trả về success để tránh email enumeration attack
    if (!user) return NextResponse.json({ success: true });

    // Xóa token cũ, tạo mới (1 giờ)
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId:    user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await sendPasswordResetEmail(user.email, user.name, token);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[forgot-password]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
