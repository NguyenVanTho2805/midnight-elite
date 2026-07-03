import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, type SessionPayload } from "@/lib/session";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const blocked = limitOrBlock(ip, "login", 10, 60_000); // 10 lần/phút
  if (blocked) return blocked;

  try {
    const { email, password } = await req.json();

    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Vui lòng nhập email và mật khẩu" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      return NextResponse.json({ error: "Email hoặc mật khẩu không đúng" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Email hoặc mật khẩu không đúng" }, { status: 401 });
    }

    if (user.banned) {
      return NextResponse.json({ error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin để được hỗ trợ." }, { status: 403 });
    }

    const payload: SessionPayload = {
      userId: user.id,
      role:   user.role as "student" | "admin",
    };
    if (user.adminRole) payload.adminRole = user.adminRole as SessionPayload["adminRole"];

    await createSession(payload);

    return NextResponse.json({
      id:            user.id,
      name:          user.name,
      email:         user.email,
      role:          user.role,
      adminRole:     user.adminRole,
      phone:         user.phone,
      school:        user.school,
      emailVerified: user.emailVerified,
    });
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
