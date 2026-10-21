import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { NO_STORE, requirePushTutor } from "@/lib/pushAuth";
import {
  MAX_PUSH_DEVICES, deviceLabel, endpointFingerprint, isFingerprint, parsePushTypesPatch, pushConfig, resolvePushTypes,
} from "@/lib/pushRules";
import { prefsLockKey, readPreferences } from "@/lib/userPreferences";
import type { Prisma } from "@/generated/prisma/client";

// ĐX-02 — trang Cài đặt → "Thông báo đẩy" (gia sư).
//   GET /api/push/settings[?e=<SHA-256 của endpoint máy này>] → hệ thống có được gửi không, khoá công khai VAPID, công tắc từng loại, thiết bị đã bật.
//   PUT /api/push/settings { absence_late?, bank_tx_pending?, invoice_paid? } → đổi công tắc (đúng-sai; tên lạ → 400, không ghi dở).
// Máy này được nhận ra bằng dấu vân tay `e` (không đưa endpoint lên URL). Không trả endpoint hay khoá của bất kỳ thiết bị nào.

export async function GET(req: NextRequest) {
  const auth = await requirePushTutor();
  if (isNextResponse(auth)) return auth;
  const e = req.nextUrl.searchParams.get("e");
  const [u, subs] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.userId }, select: { preferences: true } }),
    prisma.pushSubscription.findMany({
      where: { userId: auth.userId, revokedAt: null }, orderBy: { createdAt: "asc" },
      select: { id: true, endpoint: true, userAgent: true, createdAt: true, lastSeenAt: true },
    }),
  ]);
  const cfg = pushConfig(process.env);
  const devices = await Promise.all(subs.map(async s => ({
    id: s.id, label: deviceLabel(s.userAgent), createdAt: s.createdAt, lastSeenAt: s.lastSeenAt,
    mine: isFingerprint(e) && (await endpointFingerprint(s.endpoint)) === e,
  })));
  return NextResponse.json({
    enabled: cfg.enabled, reason: cfg.reason, publicKey: cfg.publicKey,
    types: resolvePushTypes(readPreferences(u?.preferences).push?.types),
    devices, maxDevices: MAX_PUSH_DEVICES,
  }, { headers: NO_STORE });
}

export async function PUT(req: NextRequest) {
  const auth = await requirePushTutor();
  if (isNextResponse(auth)) return auth;
  const body = await req.json().catch(() => null);
  const patch = parsePushTypesPatch(body);
  if (!patch.ok) return NextResponse.json({ error: patch.error }, { status: 400 });
  // Đọc-sửa-ghi MỘT cột JSON: dùng chung khoá giao dịch với API giao diện / hồ sơ gia sư để các lần lưu đồng thời không ghi đè nhau.
  const types = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefsLockKey(auth.userId)}))`;
    const cur = await tx.user.findUnique({ where: { id: auth.userId }, select: { preferences: true } });
    const prefs = readPreferences(cur?.preferences);
    prefs.push = { types: { ...(prefs.push?.types ?? {}), ...patch.value } };
    await tx.user.update({ where: { id: auth.userId }, data: { preferences: prefs as Prisma.InputJsonValue } });
    return resolvePushTypes(prefs.push.types);
  });
  return NextResponse.json({ types }, { headers: NO_STORE });
}
