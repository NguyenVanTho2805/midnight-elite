// Bước chung sau khi đã xác thực xong một người (mật khẩu hoặc mã 6 số): kiểm tài khoản bị khoá, tạo phiên, trả thông tin người dùng.
import { NextResponse } from "next/server";
import { createSession, type SessionPayload } from "@/lib/session";

export interface SignInUser {
  id: string;
  name: string;
  email: string;
  role: string;
  adminRole: string | null;
  phone: string | null;
  school: string | null;
  emailVerified: boolean;
  banned: boolean;
}

export async function signInResponse(user: SignInUser): Promise<NextResponse> {
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
}
