// TK-170 — phần có cơ sở dữ liệu + gửi email của đăng nhập bằng mã 6 số. Quy tắc thuần nằm ở src/lib/loginCode.ts.
//
// KHÔNG ĐỂ LỘ email nào có tài khoản: với email không có tài khoản, mọi bước (gửi, chờ 60 giây, đếm lần sai, khoá 15 phút)
// được mô phỏng y hệt bằng bộ nhớ ("ghost") và không gửi thư. Người ngoài chỉ thấy cùng một dạng phản hồi.
import { prisma } from "@/lib/prisma";
import { sendLoginCodeEmail } from "@/lib/email";
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

export async function requestLoginCode(email: string, now: Date = new Date()): Promise<RequestResult> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  const row = user ? await prisma.loginCode.findUnique({ where: { email } }) : null;
  const state: CodeState | null = user ? (row ? toState(row) : null) : ghost.get(email) ?? null;

  const plan = planRequest(state, now);
  if (plan.action === "wait") return { status: "wait", retryAfterSec: plan.retryAfterSec };
  if (plan.action === "locked") return { status: "locked", retryAfterSec: plan.retryAfterSec };

  const code = generateCode();
  const next = {
    codeHash: hashCode(email, code, secret()),
    attempts: plan.attempts,
    sentAt: now,
    expiresAt: expiryFor(now),
    lockedUntil: null as Date | null,
  };

  if (!user) {
    // Mã giả: băm của một giá trị không ai biết, nên không bao giờ khớp.
    ghostSet(email, { ...next, codeHash: hashCode(email, "ghost-" + generateCode(), secret()) }, now);
  } else {
    if (row) {
      // Khoá lạc quan: hai yêu cầu song song cùng đọc một trạng thái thì chỉ một cái ghi được (cái kia coi như "chờ").
      const r = await prisma.loginCode.updateMany({ where: { email, sentAt: row.sentAt }, data: next });
      if (r.count === 0) return { status: "wait", retryAfterSec: Math.ceil(RESEND_MS / 1000) };
    } else {
      try {
        await prisma.loginCode.create({ data: { email, ...next } });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return { status: "wait", retryAfterSec: Math.ceil(RESEND_MS / 1000) };
        throw e;
      }
    }
    try {
      await sendLoginCodeEmail(email, user.name, code);
    } catch (e) {
      // Gửi thư hỏng thì trả lại trạng thái trước để người dùng xin lại ngay được, không bị kẹt 60 giây.
      if (row) await prisma.loginCode.updateMany({ where: { email, sentAt: now }, data: toState(row) });
      else await prisma.loginCode.deleteMany({ where: { email, sentAt: now } });
      console.error("[login-code] gửi email lỗi:", e);
      throw new Error(MAIL_SEND_FAILED);
    }
  }
  return { status: "sent", resendAfterSec: Math.ceil(RESEND_MS / 1000), expiresInSec: Math.ceil(CODE_TTL_MS / 1000) };
}

type UserRow = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

export type VerifyResult =
  | { status: "ok"; user: UserRow }
  | { status: "wrong"; attemptsLeft: number }
  | { status: "locked"; retryAfterSec: number }
  | { status: "expired" };

export async function verifyLoginCode(email: string, code: string, now: Date = new Date()): Promise<VerifyResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  const candidate = hashCode(email, code, secret());

  if (!user) {
    const s = ghost.get(email) ?? null;
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
    where: { email, attempts: { lt: MAX_ATTEMPTS }, lockedUntil: null, expiresAt: { gt: now } },
    data: { attempts: { increment: 1 } },
  });
  if (gate.count === 0) {
    const row = await prisma.loginCode.findUnique({ where: { email } });
    return row ? blocked(toState(row), now) : { status: "expired" };
  }

  const row = await prisma.loginCode.findUnique({ where: { email } });
  if (!row) return { status: "expired" };

  if (hashesEqual(candidate, row.codeHash)) {
    // Dùng một lần: chỉ yêu cầu xoá được dòng này mới thành công (hai yêu cầu cùng mã đúng thì một cái thua).
    const del = await prisma.loginCode.deleteMany({ where: { email, codeHash: row.codeHash } });
    return del.count === 1 ? { status: "ok", user } : { status: "expired" };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await prisma.loginCode.updateMany({ where: { email, lockedUntil: null }, data: { lockedUntil: lockUntilFor(now) } });
    return { status: "locked", retryAfterSec: Math.ceil(LOCK_MS / 1000) };
  }
  return { status: "wrong", attemptsLeft: attemptsLeft(row.attempts) };
}

function blocked(s: CodeState, now: Date): VerifyResult {
  const b = classifyBlocked(s, now);
  return b.reason === "locked" ? { status: "locked", retryAfterSec: b.retryAfterSec } : { status: "expired" };
}
