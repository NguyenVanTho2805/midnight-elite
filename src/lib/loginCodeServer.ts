// TK-170 — phần có cơ sở dữ liệu + gửi thư/SMS của đăng nhập bằng mã 6 số. Quy tắc thuần nằm ở src/lib/loginCode.ts.
//
// Lõi (requestCode / verifyCode) khoá theo `key`, dùng chung cho ba việc:
//   - email           : key = email                        → gửi thư
//   - số điện thoại   : key = "tel:+84901234567"           → gửi SMS (chỉ số ĐÃ XÁC MINH của một tài khoản)
//   - xác minh số     : key = "claim:<userId>:+84901234567" → gửi SMS cho người đang đăng nhập muốn gắn số
//
// KHÔNG ĐỂ LỘ email / số nào có tài khoản: với khoá không có tài khoản, mọi bước (gửi, chờ 60 giây, đếm lần sai, khoá 15 phút)
// được mô phỏng y hệt bằng bộ nhớ ("ghost") và KHÔNG gửi gì (cũng nghĩa là không ai bắt được hệ thống gửi SMS tốn tiền tới số lạ).
// Người ngoài chỉ thấy cùng một dạng phản hồi.
import { prisma } from "@/lib/prisma";
import { sendLoginCodeEmail } from "@/lib/email";
import { SMS_SEND_FAILED, loginCodeSmsText, sendSms } from "@/lib/sms";
import { phoneClaimKey, phoneLoginKey } from "@/lib/phone";
import {
  CODE_TTL_MS, LOCK_MS, MAX_ATTEMPTS, RESEND_MS,
  attemptsLeft, classifyBlocked, expiryFor, generateCode, hashCode, hashesEqual, lockUntilFor, planRequest,
  type CodeState,
} from "@/lib/loginCode";

/** Lỗi riêng để route trả 502 (không gửi được thư) thay vì 500. */
export const MAIL_SEND_FAILED = "MAIL_SEND_FAILED";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET chưa được cấu hình");
  return s;
}

// Trạng thái giả cho email không có tài khoản. Có trần kích thước để không bị làm đầy bộ nhớ.
const ghost = new Map<string, CodeState>();
const GHOST_MAX = 5000;
function ghostSet(email: string, s: CodeState, now: Date) {
  if (ghost.size >= GHOST_MAX) {
    for (const [k, v] of ghost) if (v.expiresAt < now && (!v.lockedUntil || v.lockedUntil < now)) ghost.delete(k);
    if (ghost.size >= GHOST_MAX) ghost.delete(ghost.keys().next().value as string);
  }
  ghost.set(email, s);
}

const toState = (r: { codeHash: string; attempts: number; sentAt: Date; expiresAt: Date; lockedUntil: Date | null }): CodeState => ({
  codeHash: r.codeHash, attempts: r.attempts, sentAt: r.sentAt, expiresAt: r.expiresAt, lockedUntil: r.lockedUntil,
});

export type RequestResult =
  | { status: "sent"; resendAfterSec: number; expiresInSec: number }
  | { status: "wait"; retryAfterSec: number }
  | { status: "locked"; retryAfterSec: number };

/** Gửi mã tới `key`. `exists` = có người thật đứng sau khoá này không (không thì chỉ mô phỏng, không gọi `deliver`). */
async function requestCode(
  key: string, exists: boolean, deliver: (code: string) => Promise<void>, failure: string, now: Date,
): Promise<RequestResult> {
  const row = exists ? await prisma.loginCode.findUnique({ where: { email: key } }) : null;
  const state: CodeState | null = exists ? (row ? toState(row) : null) : ghost.get(key) ?? null;

  const plan = planRequest(state, now);
  if (plan.action === "wait") return { status: "wait", retryAfterSec: plan.retryAfterSec };
  if (plan.action === "locked") return { status: "locked", retryAfterSec: plan.retryAfterSec };

  const code = generateCode();
  const next = {
    codeHash: hashCode(key, code, secret()),
    attempts: plan.attempts,
    sentAt: now,
    expiresAt: expiryFor(now),
    lockedUntil: null as Date | null,
  };

  if (!exists) {
    // Mã giả: băm của một giá trị không ai biết, nên không bao giờ khớp.
    ghostSet(key, { ...next, codeHash: hashCode(key, "ghost-" + generateCode(), secret()) }, now);
  } else {
    if (row) {
      // Khoá lạc quan: hai yêu cầu song song cùng đọc một trạng thái thì chỉ một cái ghi được (cái kia coi như "chờ").
      const r = await prisma.loginCode.updateMany({ where: { email: key, sentAt: row.sentAt }, data: next });
      if (r.count === 0) return { status: "wait", retryAfterSec: Math.ceil(RESEND_MS / 1000) };
    } else {
      try {
        await prisma.loginCode.create({ data: { email: key, ...next } });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return { status: "wait", retryAfterSec: Math.ceil(RESEND_MS / 1000) };
        throw e;
      }
    }
    try {
      await deliver(code);
    } catch (e) {
      // Gửi hỏng thì trả lại trạng thái trước để người dùng xin lại ngay được, không bị kẹt 60 giây.
      if (row) await prisma.loginCode.updateMany({ where: { email: key, sentAt: now }, data: toState(row) });
      else await prisma.loginCode.deleteMany({ where: { email: key, sentAt: now } });
      console.error("[login-code] gửi mã lỗi:", e instanceof Error ? e.message : "không rõ");
      throw new Error(failure);
    }
  }
  return { status: "sent", resendAfterSec: Math.ceil(RESEND_MS / 1000), expiresInSec: Math.ceil(CODE_TTL_MS / 1000) };
}

export async function requestLoginCode(email: string, now: Date = new Date()): Promise<RequestResult> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  return requestCode(email, !!user, code => sendLoginCodeEmail(email, user?.name ?? "", code), MAIL_SEND_FAILED, now);
}

const smsHost = () => { try { return process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).host : undefined; } catch { return undefined; } };

/** Đăng nhập bằng SMS: chỉ số ĐÃ XÁC MINH của một tài khoản mới có người thật phía sau; số khác chỉ bị mô phỏng (không gửi SMS). */
export async function requestPhoneLoginCode(e164: string, now: Date = new Date()): Promise<RequestResult> {
  const user = await prisma.user.findUnique({ where: { phoneE164: e164 }, select: { id: true } });
  return requestCode(phoneLoginKey(e164), !!user, code => sendSms(e164, loginCodeSmsText(code, smsHost())), SMS_SEND_FAILED, now);
}

/** Xác minh số cho người ĐANG đăng nhập: mã gắn với userId + số, nên mã này không dùng được để đăng nhập hay cho người khác. */
export async function requestPhoneClaimCode(userId: string, e164: string, now: Date = new Date()): Promise<RequestResult> {
  return requestCode(phoneClaimKey(userId, e164), true, code => sendSms(e164, loginCodeSmsText(code, smsHost())), SMS_SEND_FAILED, now);
}

type UserRow = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

type CoreResult =
  | { status: "ok" }
  | { status: "wrong"; attemptsLeft: number }
  | { status: "locked"; retryAfterSec: number }
  | { status: "expired" };

export type VerifyResult =
  | { status: "ok"; user: UserRow }
  | Exclude<CoreResult, { status: "ok" }>;

async function verifyCode(key: string, code: string, exists: boolean, now: Date): Promise<CoreResult> {
  const candidate = hashCode(key, code, secret());

  if (!exists) {
    const s = ghost.get(key) ?? null;
    if (!s || s.expiresAt <= now) return s ? blocked(s, now) : { status: "expired" };
    const b = classifyBlocked(s, now);
    if (b.reason === "locked") return { status: "locked", retryAfterSec: b.retryAfterSec };
    if (s.attempts >= MAX_ATTEMPTS) return { status: "expired" };
    s.attempts += 1;
    hashesEqual(candidate, s.codeHash); // giữ thời gian xử lý gần như nhau
    if (s.attempts >= MAX_ATTEMPTS) { s.lockedUntil = lockUntilFor(now); return { status: "locked", retryAfterSec: Math.ceil(LOCK_MS / 1000) }; }
    return { status: "wrong", attemptsLeft: attemptsLeft(s.attempts) };
  }

  // Trừ lượt thử TRƯỚC khi so mã, nguyên tử: dù gửi song song bao nhiêu yêu cầu, tối đa MAX_ATTEMPTS lần so được cho một mã.
  const gate = await prisma.loginCode.updateMany({
    where: { email: key, attempts: { lt: MAX_ATTEMPTS }, lockedUntil: null, expiresAt: { gt: now } },
    data: { attempts: { increment: 1 } },
  });
  if (gate.count === 0) {
    const row = await prisma.loginCode.findUnique({ where: { email: key } });
    return row ? blocked(toState(row), now) : { status: "expired" };
  }

  const row = await prisma.loginCode.findUnique({ where: { email: key } });
  if (!row) return { status: "expired" };

  if (hashesEqual(candidate, row.codeHash)) {
    // Dùng một lần: chỉ yêu cầu xoá được dòng này mới thành công (hai yêu cầu cùng mã đúng thì một cái thua).
    const del = await prisma.loginCode.deleteMany({ where: { email: key, codeHash: row.codeHash } });
    return del.count === 1 ? { status: "ok" } : { status: "expired" };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await prisma.loginCode.updateMany({ where: { email: key, lockedUntil: null }, data: { lockedUntil: lockUntilFor(now) } });
    return { status: "locked", retryAfterSec: Math.ceil(LOCK_MS / 1000) };
  }
  return { status: "wrong", attemptsLeft: attemptsLeft(row.attempts) };
}

export async function verifyLoginCode(email: string, code: string, now: Date = new Date()): Promise<VerifyResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  const r = await verifyCode(email, code, !!user, now);
  return r.status === "ok" ? (user ? { status: "ok", user } : { status: "expired" }) : r;
}

export async function verifyPhoneLoginCode(e164: string, code: string, now: Date = new Date()): Promise<VerifyResult> {
  const user = await prisma.user.findUnique({ where: { phoneE164: e164 } });
  const r = await verifyCode(phoneLoginKey(e164), code, !!user, now);
  return r.status === "ok" ? (user ? { status: "ok", user } : { status: "expired" }) : r;
}

export async function verifyPhoneClaimCode(userId: string, e164: string, code: string, now: Date = new Date()): Promise<CoreResult> {
  return verifyCode(phoneClaimKey(userId, e164), code, true, now);
}

function blocked(s: CodeState, now: Date): CoreResult {
  const b = classifyBlocked(s, now);
  return b.reason === "locked" ? { status: "locked", retryAfterSec: b.retryAfterSec } : { status: "expired" };
}
