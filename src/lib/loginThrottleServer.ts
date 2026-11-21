// SCL-J: bộ đếm đăng nhập sai bằng Postgres (bảng login_failures). Quy tắc nằm ở src/lib/loginThrottle.ts (thuần).
import { prisma } from "@/lib/prisma";
import { throttleDecision, WINDOW_MS, IP_MAX_WRONG, PAIR_MAX_WRONG, ACCOUNT_SOFT_AFTER, type LoginFailureRow } from "@/lib/loginThrottle";

/** Dòng cũ hơn mốc này bị xoá khi ghi lần sai mới — bảng không phình, IP/email không nằm lâu trong DB. */
const KEEP_MS = 24 * 60 * 60_000;
const select = { id: true, ip: true, accountKey: true, at: true, cleared: true } as const;

export async function loginThrottleCheck(ip: string, key: string, now = Date.now()): Promise<{ waitSec: number; delayMs: number }> {
  const at = { gte: new Date(now - WINDOW_MS) };
  const desc = { at: "desc" as const };
  // Mỗi tầng chỉ cần N lần sai mới nhất của nó; ba truy vấn có trần nên kẻ phun nhiều dòng không làm truy vấn phình.
  const [byIp, byPair, byAccount] = await Promise.all([
    prisma.loginFailure.findMany({ where: { ip, at }, orderBy: desc, take: IP_MAX_WRONG, select }),
    prisma.loginFailure.findMany({ where: { ip, accountKey: key, cleared: false, at }, orderBy: desc, take: PAIR_MAX_WRONG, select }),
    prisma.loginFailure.findMany({ where: { accountKey: key, cleared: false, at }, orderBy: desc, take: ACCOUNT_SOFT_AFTER, select }),
  ]);
  const rows = new Map<string, LoginFailureRow>();
  for (const r of [...byIp, ...byPair, ...byAccount]) rows.set(r.id, { ip: r.ip, accountKey: r.accountKey, at: r.at.getTime(), cleared: r.cleared });
  return throttleDecision([...rows.values()], ip, key, now);
}

export async function loginThrottleFail(ip: string, key: string, now = Date.now()): Promise<void> {
  await prisma.loginFailure.create({ data: { ip, accountKey: key, at: new Date(now) } });
  await prisma.loginFailure.deleteMany({ where: { at: { lt: new Date(now - KEEP_MS) } } });
}

/** Đăng nhập đúng / đặt lại mật khẩu: xoá bộ đếm theo tài khoản và theo cặp; bộ đếm theo máy giữ nguyên. */
export async function loginThrottleOk(key: string): Promise<void> {
  await prisma.loginFailure.updateMany({ where: { accountKey: key, cleared: false }, data: { cleared: true } });
}
