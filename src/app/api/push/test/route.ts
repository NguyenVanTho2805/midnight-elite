import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { logAction } from "@/lib/auditLog";
import { NO_STORE, requirePushTutor } from "@/lib/pushAuth";
import { pushConfig } from "@/lib/pushRules";
import { sendTestPush } from "@/lib/pushServer";

// ĐX-02 — nút "Gửi thử": gửi một tin thử tới mọi thiết bị của CHÍNH gia sư. Tối đa 1 lần mỗi 30 giây (ghi nhật ký "push.test") để nút không thành máy phát tin.
const TEST_COOLDOWN_MS = 30_000;

export async function POST() {
  const auth = await requirePushTutor();
  if (isNextResponse(auth)) return auth;
  const cfg = pushConfig(process.env);
  if (!cfg.enabled) return NextResponse.json({ error: "Thông báo đẩy chưa được bật trên hệ thống này", reason: cfg.reason }, { status: 409 });
  // Chưa có thiết bị thì báo ngay, KHÔNG tính vào giới hạn 30 giây (chưa gửi gì).
  const devices = await prisma.pushSubscription.count({ where: { userId: auth.userId, revokedAt: null } });
  if (devices === 0) return NextResponse.json({ error: "Chưa có thiết bị nào bật thông báo đẩy" }, { status: 409 });
  const recent = await prisma.auditLog.count({ where: { actorId: auth.userId, action: "push.test", createdAt: { gt: new Date(Date.now() - TEST_COOLDOWN_MS) } } });
  if (recent > 0) return NextResponse.json({ error: "Vừa gửi thử xong, đợi vài chục giây rồi bấm lại" }, { status: 429 });
  await logAction(auth.userId, "push.test", "User", auth.userId);
  const r = await sendTestPush(auth.userId);
  if (r.skipped) return NextResponse.json({ error: r.skipped === "no-devices" ? "Chưa có thiết bị nào bật thông báo đẩy" : "Thông báo đẩy chưa được bật trên hệ thống này" }, { status: 409 });
  return NextResponse.json({ ok: true, sent: r.sent, failed: r.failed, revoked: r.revoked }, { headers: NO_STORE });
}
