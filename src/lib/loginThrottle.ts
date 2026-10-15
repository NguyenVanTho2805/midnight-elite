// Giới hạn đăng nhập bằng MẬT KHẨU (14/10/2026: mật khẩu trở thành đường đăng nhập chính, nên phải chặn dò mật khẩu). Thuần: giờ được truyền vào
// để test từng quy tắc; trạng thái nằm trong bộ nhớ của tiến trình (cùng cách với src/lib/rate-limit.ts).
//
// Hai tầng, theo đúng quyết định cũ ở docs/kin/nhung-cho-de-sai.md ("khoá theo máy đang dò, mật khẩu đúng thì luôn vào được"):
//   1. Theo MÁY (IP): sai 20 lần trong 15 phút thì chặn máy đó cho tới khi lần sai cũ nhất trượt khỏi cửa sổ 15 phút. Chặn trước khi so mật khẩu.
//   2. Theo TÀI KHOẢN: sai từ 5 lần trở lên trong 15 phút thì mỗi lần thử kế tiếp phải chờ thêm 1,5 giây. KHÔNG bao giờ chặn hẳn — nếu chặn thì
//      ai đó gõ sai tài khoản của người khác là khoá được người ấy ra ngoài. Mật khẩu đúng luôn vào được.
//
// Giới hạn đã biết: bộ nhớ riêng từng tiến trình, nên trên máy chủ nhiều bản chạy song song thì ngưỡng nhân lên theo số bản. Muốn chặt hơn thì
// chuyển bộ đếm sang cơ sở dữ liệu (như bảng login_codes của đăng nhập bằng mã) — chưa làm.
export const WINDOW_MS = 15 * 60_000;
export const IP_MAX_WRONG = 20;
export const ACCOUNT_SOFT_AFTER = 5;
export const ACCOUNT_DELAY_MS = 1500;
/** Trần số khoá lưu trong bộ nhớ: kẻ phun nhiều tài khoản/địa chỉ không làm máy chủ phình bộ nhớ. */
export const MAX_KEYS = 5000;

export function createLoginThrottle(now: () => number = Date.now) {
  const byIp = new Map<string, number[]>();
  const byAccount = new Map<string, number[]>();

  const live = (m: Map<string, number[]>, k: string): number[] => {
    const t = now();
    const a = (m.get(k) ?? []).filter(x => t - x < WINDOW_MS);
    if (a.length) m.set(k, a); else m.delete(k);
    return a;
  };
  const push = (m: Map<string, number[]>, k: string) => {
    const a = live(m, k);
    a.push(now());
    m.delete(k); // đưa khoá về cuối thứ tự chèn để phần bị loại là khoá cũ nhất
    m.set(k, a);
    while (m.size > MAX_KEYS) { const oldest = m.keys().next().value; if (oldest === undefined) break; m.delete(oldest); }
  };

  return {
    /** Số giây máy này còn phải chờ vì đã sai quá nhiều; 0 = được thử. */
    ipWaitSec(ip: string): number {
      const a = live(byIp, ip);
      if (a.length < IP_MAX_WRONG) return 0;
      return Math.max(1, Math.ceil((a[a.length - IP_MAX_WRONG] + WINDOW_MS - now()) / 1000));
    },
    /** Thời gian chờ thêm trước khi so mật khẩu của tài khoản này (0 hoặc 1,5 giây); không bao giờ chặn. */
    accountDelayMs(key: string): number {
      return live(byAccount, key).length >= ACCOUNT_SOFT_AFTER ? ACCOUNT_DELAY_MS : 0;
    },
    /** Ghi một lần sai. */
    fail(ip: string, key: string): void { push(byIp, ip); push(byAccount, key); },
    /** Đăng nhập đúng: xoá bộ đếm của tài khoản đó (bộ đếm theo máy vẫn giữ, để kẻ dò không xoá được nhờ một tài khoản của chính mình). */
    ok(key: string): void { byAccount.delete(key); },
    /** Chỉ để test. */
    size: () => ({ ip: byIp.size, account: byAccount.size }),
  };
}

export const loginThrottle = createLoginThrottle();
