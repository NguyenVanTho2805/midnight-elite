import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";
import { grantSignupBonus } from "@/lib/wallet";
import { parseTutorProfileInput } from "@/lib/tutorProfile";

// POST /api/auth/register-tutor — đăng ký tài khoản kèm đơn làm gia sư
// (BE-050). Cùng luồng với /api/auth/register (rate limit, hash, email xác
// thực, xu khởi đầu), thêm bio + subjects.
//
// Khác với mô tả gốc BE-050 ("set role admin, adminRole teacher ngay"):
// tài khoản giữ role "student" + tutorAppliedAt cho tới khi admin duyệt
// (BE-052). Lý do: ~15 route coi role "admin" là toàn quyền xem nội dung
// mọi khoá học, nên cấp role admin trước khi duyệt = ai đăng ký cũng xem
// được hết. Duyệt xong mới chuyển sang role "admin" + adminRole "teacher".
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const blocked = limitOrBlock(ip, "register", 5, 60_000);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const { name, email, password, phone, city } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Mật khẩu cần ít nhất 8 ký tự" }, { status: 400 });
    }
    const profile = parseTutorProfileInput({ bio: body.bio, subjects: body.subjects ?? [] });
    if (profile.error) return NextResponse.json({ error: profile.error }, { status: 400 });
    if (!profile.subjects?.length) {
      return NextResponse.json({ error: "Chọn ít nhất 1 môn dạy" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      if (existing.banned) {
        return NextResponse.json({ error: "Email này đã bị khóa và không thể đăng ký lại." }, { status: 403 });
      }
      return NextResponse.json({ error: "Email này đã được đăng ký" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name:           name.trim(),
        email:          normalizedEmail,
        password:       hashed,
        phone:          phone?.trim() || null,
        city:           city?.trim() || null,
        role:           "student",
        emailVerified:  false,
        bio:            profile.bio ?? null,
        subjects:       profile.subjects,
        tutorAppliedAt: new Date(),
      },
    });

    await grantSignupBonus(user.id);

    const token = randomBytes(32).toString("hex");
    await prisma.verifyToken.create({
      data: { token, userId: user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });

    let emailSent = true;
    try {
      await sendVerificationEmail(user.email, user.name, token);
    } catch (emailErr) {
      emailSent = false;
      console.error("[email] Không gửi được mail xác thực:", (emailErr as Error).message);
    }

    return NextResponse.json({
      id:                user.id,
      name:              user.name,
      email:             user.email,
      emailVerified:     false,
      emailSent,
      tutorApplication:  "pending",
    }, { status: 201 });
  } catch (e) {
    console.error("[register-tutor]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
