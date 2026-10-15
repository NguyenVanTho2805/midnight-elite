import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { staleVerification } from "@/lib/phone";

const PROFILE_SELECT = {
  id: true, name: true, email: true, phone: true, parentPhone: true,
  parentName: true, school: true, highSchool: true, city: true,
  studentId: true, facebookUrl: true, zaloPhone: true,
  role: true, adminRole: true, emailVerified: true, createdAt: true, phoneVerifiedAt: true,
} as const;

// Không trả mốc thô; chỉ cho biết số đã xác minh để đăng nhập bằng SMS hay chưa.
const publicProfile = <T extends { phoneVerifiedAt: Date | null }>({ phoneVerifiedAt, ...rest }: T) => ({ ...rest, phoneVerified: phoneVerifiedAt !== null });

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.userId },
    select: PROFILE_SELECT,
  });

  return user
    ? NextResponse.json(publicProfile(user))
    : NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { name, phone, parentPhone, parentName, school, highSchool, city, facebookUrl, zaloPhone } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Tên không được để trống" }, { status: 400 });
  }

  // Đổi ô `phone` sang số khác thì số đã xác minh (đăng nhập SMS) hết hiệu lực — phải nhận mã ở số mới.
  const cur = await prisma.user.findUnique({ where: { id: session.userId }, select: { phoneE164: true } });
  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: {
      ...(staleVerification(cur?.phoneE164, phone) ? { phoneE164: null, phoneVerifiedAt: null } : {}),
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

  return NextResponse.json(publicProfile(updated));
}
