import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const ip = getClientIp(req);
  const blocked = limitOrBlock(`${ip}:${session.userId}`, "resend-verification", 3, 300_000); // 3 lần/5 phút
  if (blocked) return blocked;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ error: "Email đã được xác thực" }, { status: 400 });

  // Xóa token cũ, tạo token mới
  await prisma.verifyToken.deleteMany({ where: { userId: user.id } });
  const token = randomBytes(32).toString("hex");
  await prisma.verifyToken.create({
    data: {
      token,
      userId:    user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendVerificationEmail(user.email, user.name, token);

  return NextResponse.json({ success: true });
}
