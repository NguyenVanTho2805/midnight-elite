import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { NO_STORE, requirePushTutor } from "@/lib/pushAuth";
import { MAX_PUSH_DEVICES, parseSubscription, pushConfig } from "@/lib/pushRules";

// ĐX-02 — đăng ký / gỡ MỘT thiết bị nhận thông báo đẩy (chỉ gia sư).
//   POST   { subscription: PushSubscription.toJSON(), userAgent? } → đăng ký (gọi lại với cùng thiết bị thì cập nhật, không nhân đôi).
//   DELETE { id } hoặc { endpoint }                                → gỡ thiết bị CỦA CHÍNH MÌNH (idempotent; của người khác thì coi như không có).
// Chỉ nhận khi hệ thống được phép gửi (PUSH_ENABLED, khoá VAPID, không phải bản xem trước): thiết bị đăng ký ở nơi không gửi được là đăng ký vô ích.

export async function POST(req: NextRequest) {
  const auth = await requirePushTutor();
  if (isNextResponse(auth)) return auth;
  const cfg = pushConfig(process.env);
  if (!cfg.enabled) return NextResponse.json({ error: "Thông báo đẩy chưa được bật trên hệ thống này", reason: cfg.reason }, { status: 409 });
  const body = await req.json().catch(() => null);
  const sub = parseSubscription(body);
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: 400 });
  const v = sub.value;

  // Mỗi tin đẩy đi tới MỌI thiết bị đang bật, nên giới hạn số thiết bị (đăng ký lại đúng thiết bị cũ thì không tính thêm).
  const others = await prisma.pushSubscription.count({ where: { userId: auth.userId, revokedAt: null, NOT: { endpoint: v.endpoint } } });
  if (others >= MAX_PUSH_DEVICES) return NextResponse.json({ error: `Tối đa ${MAX_PUSH_DEVICES} thiết bị. Hãy gỡ bớt thiết bị không dùng rồi thử lại.` }, { status: 409 });

  const now = new Date();
  // `endpoint` là duy nhất: một thiết bị đổi sang tài khoản gia sư khác thì dòng chuyển sang người mới (thiết bị không thuộc hai tài khoản cùng lúc).
  const row = await prisma.pushSubscription.upsert({
    where: { endpoint: v.endpoint },
    create: { userId: auth.userId, endpoint: v.endpoint, p256dh: v.p256dh, auth: v.auth, userAgent: v.userAgent, createdAt: now, lastSeenAt: now },
    update: { userId: auth.userId, p256dh: v.p256dh, auth: v.auth, userAgent: v.userAgent, lastSeenAt: now, revokedAt: null },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: row.id }, { status: 201, headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePushTutor();
  if (isNextResponse(auth)) return auth;
  const body = await req.json().catch(() => null) as { id?: unknown; endpoint?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : null, endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!id && !endpoint) return NextResponse.json({ error: "Cần id hoặc endpoint của thiết bị" }, { status: 400 });
  const r = await prisma.pushSubscription.deleteMany({ where: { userId: auth.userId, ...(id ? { id } : { endpoint: endpoint! }) } });
  return NextResponse.json({ ok: true, removed: r.count }, { headers: NO_STORE });
}
