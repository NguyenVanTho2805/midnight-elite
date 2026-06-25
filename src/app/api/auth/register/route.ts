import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";
import { grantSignupBonus } from "@/lib/wallet";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const blocked = limitOrBlock(ip, "register", 5, 60_000); // 5 lần/phút
  if (blocked) return blocked;

  try {
    const { name, email, password, phone, parentPhone, school, city } = await req.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Mật khẩu cần ít nhất 8 ký tự" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "Email này đã được đăng ký" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name:          name.trim(),
        email:         email.trim().toLowerCase(),
        password:      hashed,
        phone:         phone?.trim() || null,
        parentPhone:   parentPhone?.trim() || null,
        school:        school?.trim() || null,
        city:          city?.trim() || null,
        role:          "student",
        emailVerified: false,
      },
    });

    await grantSignupBonus(user.id);

    // Tạo verification token (24 giờ)
    const token = randomBytes(32).toString("hex");
    await prisma.verifyToken.create({
      data: {
        token,
        userId:    user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Gửi email xác thực
    let emailSent = true;
    try {
      await sendVerificationEmail(user.email, user.name, token);
    } catch (emailErr) {
      emailSent = false;
      console.error("[email] Không gửi được mail xác thực:", (emailErr as Error).message);
    }

    return NextResponse.json({
      id:    user.id,
      name:  user.name,
      email: user.email,
      emailVerified: false,
      emailSent,
    });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
