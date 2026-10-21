// ĐX-02 — gửi thông báo đẩy thật tới thiết bị của gia sư. Quy tắc (loại nào, lúc nào, chữ gì) ở src/lib/pushRules.ts — file đó THUẦN và có test.
// File này chỉ làm phần có I/O: đọc công tắc + thiết bị trong DB, gọi dịch vụ đẩy qua `web-push`, đánh dấu thiết bị đã chết (404/410).
// Không bao giờ ném lỗi ra cho người gọi: thông báo đẩy là phụ trợ (như notify()), không được làm hỏng việc chính.
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { readPreferences } from "@/lib/userPreferences";
import {
  PUSH_DEFS, PUSH_TEST_TEXT, decidePush, isPushType, pushConfig, pushPayload, resolvePushTypes, serializePayload,
  type PushConfig, type PushSkip,
} from "@/lib/pushRules";

export interface PushTarget { endpoint: string; keys: { p256dh: string; auth: string } }
export interface PushSendOptions { TTL: number; urgency: "very-low" | "low" | "normal" | "high"; timeout: number }
/** Hàm gửi một tin tới một thiết bị. Ném lỗi có `statusCode` khi dịch vụ đẩy từ chối. Thay được trong test (xem `setPushSender`). */
export type PushSender = (target: PushTarget, payload: string, opts: PushSendOptions, cfg: PushConfig) => Promise<void>;

/** Tối đa bao lâu chờ một dịch vụ đẩy trả lời; thiết bị chậm không được giữ lâu các việc khác. */
export const PUSH_TIMEOUT_MS = 5000;

const realSender: PushSender = async (target, payload, opts, cfg) => {
  await webpush.sendNotification(target, payload, {
    TTL: opts.TTL, urgency: opts.urgency, timeout: opts.timeout,
    vapidDetails: { subject: cfg.subject!, publicKey: cfg.publicKey!, privateKey: cfg.privateKey! },
  });
};
let sender: PushSender = realSender;
/** CHỈ DÙNG TRONG TEST: thay bộ gửi bằng bộ giả (truyền null để trả về bộ thật). */
export function setPushSender(s: PushSender | null): void { sender = s ?? realSender; }

export interface PushOutcome {
  /** Lý do không gửi (null = đã thử gửi). "disabled" = chưa bật ở môi trường này; "no-devices" = chưa có thiết bị nào. */
  skipped: PushSkip | "disabled" | "no-devices" | null;
  sent: number;
  failed: number;
  /** Số thiết bị bị đánh dấu đã chết (dịch vụ đẩy trả 404 / 410). */
  revoked: number;
}
const none = (skipped: PushOutcome["skipped"]): PushOutcome => ({ skipped, sent: 0, failed: 0, revoked: 0 });
const statusOf = (e: unknown): number | null => { const s = (e as { statusCode?: unknown } | null)?.statusCode; return typeof s === "number" ? s : null; };

async function deliver(
  cfg: PushConfig, subs: { id: string; endpoint: string; p256dh: string; auth: string }[], payload: string, opts: Omit<PushSendOptions, "timeout">,
): Promise<PushOutcome> {
  const results = await Promise.allSettled(subs.map(s => sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { ...opts, timeout: PUSH_TIMEOUT_MS }, cfg)));
  const ok: string[] = [], dead: string[] = [];
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") { ok.push(subs[i].id); return; }
    const code = statusOf(r.reason);
    if (code === 404 || code === 410) dead.push(subs[i].id); else { failed++; console.error("[push] gửi không được:", code ?? (r.reason as Error)?.message); }
  });
  try {
    const now = new Date();
    if (dead.length) await prisma.pushSubscription.updateMany({ where: { id: { in: dead } }, data: { revokedAt: now } });
    if (ok.length) await prisma.pushSubscription.updateMany({ where: { id: { in: ok } }, data: { lastSeenAt: now } });
  } catch (e) { console.error("[push] không cập nhật được thiết bị:", e); }
  return { skipped: null, sent: ok.length, failed, revoked: dead.length };
}

/**
 * Đẩy tin loại `type` tới mọi thiết bị đang bật của `userId`, nếu: loại đó nằm trong danh sách cho phép, hệ thống được phép gửi
 * (PUSH_ENABLED, khoá VAPID, không phải bản xem trước), gia sư chưa tắt loại đó, và (trừ báo nghỉ sát giờ) không đang giờ yên lặng.
 */
export async function pushToUser(userId: string, type: string, o: { leadMinutes?: number; now?: Date; env?: Record<string, string | undefined> } = {}): Promise<PushOutcome> {
  try {
    if (!isPushType(type)) return none("type-not-allowed");
    const cfg = pushConfig(o.env ?? process.env);
    if (!cfg.enabled) return none("disabled");
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const types = resolvePushTypes(readPreferences(u?.preferences).push?.types);
    const d = decidePush({ type, types, now: o.now ?? new Date(), leadMinutes: o.leadMinutes });
    if (!d.send) return none(d.reason);
    const subs = await prisma.pushSubscription.findMany({ where: { userId, revokedAt: null }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
    if (!subs.length) return none("no-devices");
    // Báo nghỉ sát giờ cần thấy ngay (còn dưới 2 giờ tới giờ học) nên xin dịch vụ đẩy chuyển gấp; hai loại còn lại là tin thường.
    return await deliver(cfg, subs, serializePayload(pushPayload(type)), { TTL: PUSH_DEFS[type].ttl, urgency: type === "absence_late" ? "high" : "normal" });
  } catch (e) {
    console.error("[push] pushToUser:", e);
    return { skipped: null, sent: 0, failed: 1, revoked: 0 };
  }
}

/** Tin thử từ nút "Gửi thử" ở Cài đặt: gửi tới mọi thiết bị của chính gia sư, không xét công tắc loại tin hay giờ yên lặng (người bấm đang chờ xem). */
export async function sendTestPush(userId: string, o: { env?: Record<string, string | undefined> } = {}): Promise<PushOutcome> {
  try {
    const cfg = pushConfig(o.env ?? process.env);
    if (!cfg.enabled) return none("disabled");
    const subs = await prisma.pushSubscription.findMany({ where: { userId, revokedAt: null }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
    if (!subs.length) return none("no-devices");
    return await deliver(cfg, subs, JSON.stringify(PUSH_TEST_TEXT), { TTL: 300, urgency: "normal" });
  } catch (e) {
    console.error("[push] sendTestPush:", e);
    return { skipped: null, sent: 0, failed: 1, revoked: 0 };
  }
}
