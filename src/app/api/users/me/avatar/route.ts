import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.userId },
    select: { avatarBase64: true },
  });

  return NextResponse.json({ avatarBase64: user?.avatarBase64 ?? null });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { avatarBase64 } = await req.json();

  if (!avatarBase64) {
    return NextResponse.json({ error: "Thiếu dữ liệu ảnh" }, { status: 400 });
  }

  // ~120KB base64 limit (≈90KB binary)
  if (avatarBase64.length > 160_000) {
    return NextResponse.json({ error: "Ảnh quá lớn, tối đa 120KB" }, { status: 413 });
  }

  if (!avatarBase64.startsWith("data:image/")) {
    return NextResponse.json({ error: "Định dạng ảnh không hợp lệ" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data:  { avatarBase64 },
  });

  return NextResponse.json({ ok: true });
}
