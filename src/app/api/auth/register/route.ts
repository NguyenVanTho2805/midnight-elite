import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";
import { signupBonusOps } from "@/lib/wallet";

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
      if (existing.banned) {
        return NextResponse.json({ error: "Email này đã bị khóa và không thể đăng ký lại." }, { status: 403 });
      }
      return NextResponse.json({ error: "Email này đã được đăng ký" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Tài khoản + ví + xu khởi đầu + link xác thực trong MỘT giao dịch: lỗi ở bước nào thì không còn gì lại. Trước đây User được tạo xong rồi mới tới các bước sau,
    // lỗi giữa chừng để lại tài khoản không ví / không link và chặn đăng ký lại ("Email này đã được đăng ký") dù người dùng thấy "Lỗi server".
    const token = randomBytes(32).toString("hex"); // verification token (24 giờ)
    const user = await prisma.$transaction(async tx => {
      const u = await tx.user.create({
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
      for (const op of signupBonusOps(tx, u.id)) await op;
      await tx.verifyToken.create({
        data: {
          token,
          userId:    u.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return u;
    }, { timeout: 15_000, maxWait: 10_000 });

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
    // Hai yêu cầu cùng email chạy song song: cả hai qua bước kiểm tra, một bên thua ở khoá duy nhất → báo đúng như lần kiểm tra ở trên, không phải "Lỗi server".
    if ((e as { code?: string })?.code === "P2002") return NextResponse.json({ error: "Email này đã được đăng ký" }, { status: 409 });
    console.error("[register]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
