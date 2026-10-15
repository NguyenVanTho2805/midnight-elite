// Quên mật khẩu — quy tắc THUẦN (src/lib/passwordReset.ts, src/lib/passwordPolicy.ts). Không cần máy chủ hay cơ sở dữ liệu.
import { check, section, done } from "./h";
import {
  EXPIRED_MESSAGE, INVALID_MESSAGE, MAX_REQUESTS, REQUEST_WINDOW_MS, RESEND_MS, RESET_TTL_MS,
  checkToken, generateResetToken, hashResetToken, parseResetToken, planRequest, sentAtOf, validateNewPassword,
} from "@/lib/passwordReset";
import { MAX_PASSWORD_LEN, MIN_PASSWORD_LEN } from "@/lib/passwordPolicy";

(async () => {
  section("Hằng số: đúng quy tắc đã chốt");
  check("link sống 30 phút", RESET_TTL_MS === 30 * 60_000);
  check("xin lại sau 60 giây", RESEND_MS === 60_000);
  check("một email tối đa 3 lần xin trong 30 phút", MAX_REQUESTS === 3 && REQUEST_WINDOW_MS === 30 * 60_000);
  check("mật khẩu mới 8–1024 ký tự", MIN_PASSWORD_LEN === 8 && MAX_PASSWORD_LEN === 1024);

  section("Link: ngẫu nhiên, đúng dạng, chỉ lưu băm");
  const a = generateResetToken(), b = generateResetToken();
  check("link là 64 ký tự hex", /^[0-9a-f]{64}$/.test(a));
  check("hai link khác nhau", a !== b);
  check("parse: nhận link đúng dạng (cắt khoảng trắng, đổi chữ thường)", parseResetToken(`  ${a.toUpperCase()} `) === a);
  check("parse: từ chối thiếu / thừa / sai ký tự / không phải chuỗi", [parseResetToken(""), parseResetToken(a.slice(1)), parseResetToken(a + "0"), parseResetToken("z".repeat(64)), parseResetToken(undefined), parseResetToken(12345), parseResetToken(null)].every(x => x === null));
  const h1 = hashResetToken(a, "khoa-bi-mat"), h2 = hashResetToken(a, "khoa-bi-mat"), h3 = hashResetToken(a, "khoa-khac"), h4 = hashResetToken(b, "khoa-bi-mat");
  check("băm: ổn định với cùng link + khoá", h1 === h2 && /^[0-9a-f]{64}$/.test(h1));
  check("băm KHÔNG bằng link (không lưu link thô)", h1 !== a);
  check("băm đổi khi đổi khoá bí mật hoặc đổi link", h1 !== h3 && h1 !== h4);

  section("Mật khẩu mới");
  check("rỗng / không phải chuỗi → lỗi", validateNewPassword("") !== null && validateNewPassword(undefined) !== null && validateNewPassword(12345678) !== null);
  check("7 ký tự → lỗi, nêu rõ 8 ký tự", validateNewPassword("1234567")?.includes("8 ký tự") === true);
  check("8 ký tự → hợp lệ", validateNewPassword("12345678") === null);
  check("1024 ký tự hợp lệ, 1025 bị từ chối", validateNewPassword("a".repeat(1024)) === null && validateNewPassword("a".repeat(1025)) !== null);
  check("có dấu cách và tiếng Việt vẫn hợp lệ (không ép ký tự đặc biệt)", validateNewPassword("mật khẩu của tôi") === null);

  section("Giờ gửi suy từ hạn + kế hoạch gửi lại");
  const t0 = new Date("2026-10-15T08:00:00Z");
  const exp = new Date(t0.getTime() + RESET_TTL_MS);
  check("giờ gửi = hạn − 30 phút", sentAtOf(exp).getTime() === t0.getTime());
  check("chưa có link → gửi", planRequest(null, t0).action === "send");
  const at = (s: number) => new Date(t0.getTime() + s * 1000);
  const w = planRequest({ expiresAt: exp }, at(10));
  check("10 giây sau khi gửi → chờ, còn 50 giây", w.action === "wait" && w.retryAfterSec === 50, w);
  check("59 giây sau → còn chờ 1 giây", (() => { const p = planRequest({ expiresAt: exp }, at(59)); return p.action === "wait" && p.retryAfterSec === 1; })());
  check("đúng 60 giây sau → được gửi lại", planRequest({ expiresAt: exp }, at(60)).action === "send");
  check("link đã hết hạn → được gửi (dù mới hết)", planRequest({ expiresAt: exp }, new Date(exp.getTime() + 1)).action === "send");

  section("Kiểm link");
  check("không có bản ghi → invalid", (() => { const c = checkToken(null, t0); return !c.ok && c.reason === "invalid"; })());
  check("còn hạn → ok", checkToken({ expiresAt: exp }, at(60)).ok);
  check("quá hạn → expired", (() => { const c = checkToken({ expiresAt: exp }, new Date(exp.getTime() + 1)); return !c.ok && c.reason === "expired"; })());
  check("đúng giây hết hạn → expired (không cho dùng quá hạn một chút)", (() => { const c = checkToken({ expiresAt: exp }, exp); return !c.ok && c.reason === "expired"; })());

  section("Thông báo cho người dùng");
  check("hai câu báo khác nhau, đều bảo yêu cầu link mới, nêu 30 phút khi hết hạn", (INVALID_MESSAGE as string) !== EXPIRED_MESSAGE && /link mới/.test(INVALID_MESSAGE) && /link mới/.test(EXPIRED_MESSAGE) && /30 phút/.test(EXPIRED_MESSAGE));

  await done();
})();
