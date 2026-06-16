import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const PROFILE_SELECT = {
  id: true, name: true, email: true, phone: true, parentPhone: true,
  parentName: true, school: true, highSchool: true, city: true,
  studentId: true, facebookUrl: true, zaloPhone: true,
  role: true, adminRole: true, emailVerified: true, createdAt: true,
} as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.userId },
    select: PROFILE_SELECT,
  });

  return user
    ? NextResponse.json(user)
    : NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { name, phone, parentPhone, parentName, school, highSchool, city, facebookUrl, zaloPhone } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Tên không được để trống" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: {
      name:        name.trim(),
      phone:       phone?.trim()       || null,
      parentPhone: parentPhone?.trim() || null,
      parentName:  parentName?.trim()  || null,
      school:      school?.trim()      || null,
      highSchool:  highSchool?.trim()  || null,
      city:        city?.trim()        || null,
      facebookUrl: facebookUrl?.trim() || null,
      zaloPhone:   zaloPhone?.trim()   || null,
    },
    select: PROFILE_SELECT,
  });

  return NextResponse.json(updated);
}
