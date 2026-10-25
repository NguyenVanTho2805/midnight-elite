// Chính học sinh tự đồng ý (hoặc thu hồi) để gia sư ghi thông tin lớp học của em (User.selfConsentAt, D04).
// Đồng ý kép từ 7 tuổi: phần của em nằm ở đây, phần của phụ huynh do gia sư xác nhận trong hồ sơ. Từ 16 tuổi em tự đồng ý một mình.
// CHƯA có ý kiến luật sư. Em thu hồi → mọi hồ sơ gia sư đang giữ về em coi như thiếu đồng ý của em (bị che) cho tới khi em đồng ý lại.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { logAction } from "@/lib/auditLog";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const u = await prisma.user.findUnique({ where: { id: auth.userId }, select: { selfConsentAt: true } });
  return NextResponse.json({ selfConsentAt: u?.selfConsentAt?.toISOString() ?? null }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const b = await req.json().catch(() => null) as { agree?: unknown } | null;
  if (b?.agree !== true) return NextResponse.json({ error: "Hãy tích ô đồng ý" }, { status: 400 });
  const now = new Date();
  await prisma.user.update({ where: { id: auth.userId }, data: { selfConsentAt: now } });
  await logAction(auth.userId, "self_consent.grant", "User", auth.userId, {});
  return NextResponse.json({ selfConsentAt: now.toISOString() }, { headers: NO_STORE });
}

export async function DELETE() {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  await prisma.user.update({ where: { id: auth.userId }, data: { selfConsentAt: null } });
  await logAction(auth.userId, "self_consent.revoke", "User", auth.userId, {});
  return NextResponse.json({ selfConsentAt: null }, { headers: NO_STORE });
}
