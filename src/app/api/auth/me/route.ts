import { NextResponse } from "next/server";
import { getSession, renewSessionIfDue } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json(null);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, adminRole: true, phone: true, parentPhone: true, parentName: true, school: true, highSchool: true, city: true, studentId: true, facebookUrl: true, zaloPhone: true, emailVerified: true, banned: true, phoneVerifiedAt: true },
  });
  if (!user) return NextResponse.json(null);

  // Phiên 30 ngày của gia sư/học sinh gia hạn mỗi lần dùng (tối đa 1 lần/24 giờ). Tài khoản bị khoá không được gia hạn.
  if (!user.banned) await renewSessionIfDue(session);

  const { banned: _banned, phoneVerifiedAt, ...publicUser } = user;
  void _banned;
  return NextResponse.json({ ...publicUser, phoneVerified: phoneVerifiedAt !== null });
}
