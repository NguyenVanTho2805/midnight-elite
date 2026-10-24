// TT-203 + TK-167 — lựa chọn giao diện theo TÀI KHOẢN (không theo máy).
//
// GET  → { preferences } đã chuẩn hoá (khoá lạ/giá trị hỏng bị bỏ khi đọc)
// PUT  → body là bản vá { modules?, theme?, mode?, rail?, reminders?, connections? }; mỗi khoá thay giá trị cũ,
//        `null` đưa khoá về mặc định. Khoá lạ/sai kiểu → 400, không ghi dở.
// Đọc-sửa-ghi một cột JSON nên khoá theo người dùng: hai tab đổi chủ đề và module cùng
// lúc không được ghi đè lên nhau.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { applyPreferencesPatch, prefsLockKey, readPreferences, type UserPreferences } from "@/lib/userPreferences";
import type { Prisma } from "@/generated/prisma/client";

export async function GET() {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const u = await prisma.user.findUnique({ where: { id: auth.userId }, select: { preferences: true } });
  return NextResponse.json({ preferences: readPreferences(u?.preferences) });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  let patch: unknown;
  try { patch = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }

  const result = await prisma.$transaction(async (tx): Promise<{ value: UserPreferences } | { error: string } | null> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefsLockKey(auth.userId)}))`;
    const u = await tx.user.findUnique({ where: { id: auth.userId }, select: { preferences: true } });
    if (!u) return null;
    const merged = applyPreferencesPatch(readPreferences(u.preferences), patch);
    if (!merged.ok) return { error: merged.error };
    await tx.user.update({ where: { id: auth.userId }, data: { preferences: merged.value as Prisma.InputJsonValue } });
    return { value: merged.value };
  });

  if (!result) return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ preferences: result.value });
}
