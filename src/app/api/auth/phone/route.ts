// DELETE (đã đăng nhập) → gỡ số đã xác minh: từ đó số này không đăng nhập được bằng SMS nữa. Ô `phone` tự khai giữ nguyên.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  await prisma.user.update({ where: { id: session.userId }, data: { phoneE164: null, phoneVerifiedAt: null } });
  return NextResponse.json({ ok: true });
}
