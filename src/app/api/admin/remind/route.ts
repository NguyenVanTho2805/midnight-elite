import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendReminderEmail } from "@/lib/email";
import { limitOrBlock } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_STUDENTS);
  if (isNextResponse(auth)) return auth;

  const blocked = limitOrBlock(`admin:${auth.userId}`, "remind", 30, 60_000); // 30 lần/phút
  if (blocked) return blocked;

  const { userId, message } = await req.json();

  if (!userId || !message?.trim()) {
    return NextResponse.json({ error: "Thiếu userId hoặc nội dung" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { name: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });

  try {
    await sendReminderEmail(user.email, user.name, message.trim());
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/admin/remind]", e);
    return NextResponse.json({ error: "Lỗi gửi email" }, { status: 500 });
  }
}
