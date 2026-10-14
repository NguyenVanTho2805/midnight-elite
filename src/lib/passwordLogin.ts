// Đăng nhập bằng "tài khoản + mật khẩu". Phần THUẦN: đọc và kiểm dữ liệu gửi lên. Phần có cơ sở dữ liệu ở src/app/api/auth/login/route.ts.
//
// "Tài khoản" là email, hoặc số điện thoại di động VN ĐÃ XÁC MINH trong Hồ sơ (cùng quy tắc với đăng nhập bằng mã SMS: số chưa xác minh
// không thể dùng để vào, nếu không ai cũng "chiếm trước" được số của người khác bằng cách ghi số đó vào hồ sơ mình).
import { normalizeVnPhone } from "@/lib/phone";

export const MAX_IDENTIFIER_LEN = 254;
export const MAX_PASSWORD_LEN = 1024;

export type LoginTarget =
  | { kind: "email"; key: string; email: string }
  | { kind: "phone"; key: string; e164: string };

export type ParsedLogin = { ok: true; target: LoginTarget; password: string } | { ok: false; error: string };

export function parsePasswordLogin(body: unknown): ParsedLogin {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "Dữ liệu không hợp lệ" };
  const b = body as Record<string, unknown>;
  const raw = b.identifier ?? b.email; // `email` là tên cũ của ô này, vẫn nhận để các nơi gọi cũ không gãy
  const password = b.password;
  if (typeof raw !== "string" || !raw.trim() || typeof password !== "string" || !password) {
    return { ok: false, error: "Vui lòng nhập tài khoản và mật khẩu" };
  }
  if (raw.length > MAX_IDENTIFIER_LEN || password.length > MAX_PASSWORD_LEN) return { ok: false, error: "Thông tin quá dài" };

  // Có '@' → email. KHÔNG kiểm dạng email chặt hơn bản cũ: tài khoản cũ có thể mang email lạ, và kiểm chặt thì khoá họ ra ngoài.
  if (raw.includes("@")) {
    const email = raw.trim().toLowerCase();
    return { ok: true, target: { kind: "email", key: email, email }, password };
  }
  const e164 = normalizeVnPhone(raw);
  if (!e164) return { ok: false, error: "Nhập email hoặc số điện thoại di động hợp lệ" };
  return { ok: true, target: { kind: "phone", key: `tel:${e164}`, e164 }, password };
}

/** Câu báo khi sai: không cho biết tài khoản có tồn tại hay không. Giữ nguyên chữ "Email hoặc mật khẩu không đúng" của bản cũ. */
export const wrongMessage = (t: LoginTarget): string =>
  t.kind === "email" ? "Email hoặc mật khẩu không đúng" : "Số điện thoại hoặc mật khẩu không đúng";

export function waitMessage(retryAfterSec: number): string {
  const min = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Bạn đã nhập sai nhiều lần. Thử lại sau ${min} phút, hoặc đăng nhập bằng mã một lần.`;
}
