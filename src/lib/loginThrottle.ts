// Giới hạn đăng nhập bằng MẬT KHẨU (14/10/2026: mật khẩu trở thành đường đăng nhập chính, nên phải chặn dò mật khẩu). Phần THUẦN: nhận danh sách
// lần sai và giờ hiện tại, trả quyết định — để test từng quy tắc. Lần sai lưu ở Postgres (bảng login_failures, src/lib/loginThrottleServer.ts),
// nên SCL-J (21/11/2026) bền qua khởi động lại và đúng cho mọi bản chạy song song (trước đây chỉ trong bộ nhớ từng tiến trình).
//
// Ba tầng, cùng cửa sổ trượt 15 phút (lần sai cũ nhất trượt khỏi cửa sổ thì tự mở, không cần ai mở khoá):
//   1. Theo MÁY (IP): sai 20 lần thì chặn máy đó. Chặn trước khi so mật khẩu.
//   2. Theo CẶP email + máy: sai 5 lần thì lần thứ 6 bị chặn (kể cả mật khẩu đúng). Chỉ chặn đúng máy đang dò — người thật ở máy khác vẫn vào được,
//      nên kẻ gõ sai hộ không khoá được ai ra ngoài (docs/kin/nhung-cho-de-sai.md).
//   3. Theo TÀI KHOẢN (mọi máy): sai từ 5 lần thì mỗi lần thử kế tiếp chờ thêm 1,5 giây. KHÔNG bao giờ chặn hẳn.
// Đăng nhập đúng / đặt lại mật khẩu: xoá tầng 2 và 3 của tài khoản đó (đánh dấu `cleared`); tầng 1 giữ nguyên, để kẻ dò không rửa bộ đếm theo
// máy bằng một tài khoản của chính mình.
export const WINDOW_MS = 15 * 60_000;
export const IP_MAX_WRONG = 20;
export const PAIR_MAX_WRONG = 5;
export const ACCOUNT_SOFT_AFTER = 5;
export const ACCOUNT_DELAY_MS = 1500;

/** Một lần sai đã ghi. `at` = mili giây; `cleared` = đã bị xoá bởi lần đăng nhập đúng (chỉ còn tính cho tầng máy). */
export interface LoginFailureRow { ip: string; accountKey: string; at: number; cleared: boolean }

/** Số giây còn phải chờ khi đã có ≥ `max` lần sai trong cửa sổ: tới lúc lần sai thứ `max` tính từ mới nhất trượt khỏi 15 phút. */
function slidingWaitSec(times: number[], max: number, now: number): number {
  const a = times.filter(t => now - t < WINDOW_MS).sort((x, y) => x - y);
  if (a.length < max) return 0;
  return Math.max(1, Math.ceil((a[a.length - max] + WINDOW_MS - now) / 1000));
}

/** Quyết định cho một lần thử: `waitSec` > 0 ⇒ trả 429 ngay, không so mật khẩu; `delayMs` = chờ thêm trước khi so. */
export function throttleDecision(rows: LoginFailureRow[], ip: string, key: string, now: number): { waitSec: number; delayMs: number } {
  const live = rows.filter(r => now - r.at < WINDOW_MS);
  const ipWait = slidingWaitSec(live.filter(r => r.ip === ip).map(r => r.at), IP_MAX_WRONG, now);
  const pairWait = slidingWaitSec(live.filter(r => r.ip === ip && r.accountKey === key && !r.cleared).map(r => r.at), PAIR_MAX_WRONG, now);
  const accountWrong = live.filter(r => r.accountKey === key && !r.cleared).length;
  return { waitSec: Math.max(ipWait, pairWait), delayMs: accountWrong >= ACCOUNT_SOFT_AFTER ? ACCOUNT_DELAY_MS : 0 };
}
