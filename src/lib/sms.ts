// Gửi SMS (mã đăng nhập bằng số điện thoại). TẮT cho tới khi cấu hình — mỗi tin gửi đi đều tốn tiền nên không có "gửi thử" ngầm.
//
// Nhà cung cấp, chọn bằng SMS_PROVIDER:
//   twilio  — cần TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN và MỘT trong TWILIO_MESSAGING_SERVICE_SID hoặc TWILIO_FROM.
//             Gọi thẳng REST API (không thêm thư viện). Nhà mạng Việt Nam thường đòi đăng ký tên người gửi (brandname) trước.
// Chỉ để test cục bộ: đặt SMS_SINK_DIR thì tin KHÔNG gửi đi mà ghi thành tệp JSON {to,text} vào thư mục đó. Biến này bị BỎ QUA ở
// môi trường production (NODE_ENV=production) để một cấu hình sót lại không âm thầm nuốt mã của người dùng thật.
//
// Thêm nhà cung cấp khác (eSMS, SpeedSMS, Viettel…) = thêm một nhánh trong sendSms; phần còn lại của đăng nhập không đổi.
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

/** Lỗi riêng để route trả 502 (không gửi được tin) thay vì 500. */
export const SMS_SEND_FAILED = "SMS_SEND_FAILED";

const env = (k: string) => process.env[k]?.trim() || "";
const sinkDir = () => (process.env.NODE_ENV === "production" ? "" : env("SMS_SINK_DIR"));

function twilioConfig() {
  const sid = env("TWILIO_ACCOUNT_SID"), token = env("TWILIO_AUTH_TOKEN");
  const service = env("TWILIO_MESSAGING_SERVICE_SID"), from = env("TWILIO_FROM");
  if (!sid || !token || (!service && !from)) return null;
  return { sid, token, service, from };
}

/** Đã cấu hình để gửi SMS thật (hoặc ghi ra thư mục test) chưa. Chưa → ô "số điện thoại" ẩn và API trả 503. */
export function smsEnabled(): boolean {
  if (sinkDir()) return true;
  return env("SMS_PROVIDER") === "twilio" && twilioConfig() !== null;
}

/** Nội dung tin: không dấu (ít ký tự hơn, nhà mạng lọc ít hơn), dòng cuối theo mẫu WebOTP để Chrome Android tự điền mã. */
export function loginCodeSmsText(code: string, host?: string): string {
  const base = `KiN: Ma dang nhap cua ban la ${code}. Co hieu luc 10 phut, chi dung mot lan. Khong chia se ma nay cho bat ky ai.`;
  return host ? `${base}\n\n@${host} #${code}` : base;
}

export async function sendSms(to: string, text: string): Promise<void> {
  const dir = sinkDir();
  if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${Date.now()}-${randomBytes(4).toString("hex")}.json`), JSON.stringify({ to, text }));
    return;
  }
  if (env("SMS_PROVIDER") !== "twilio") throw new Error(SMS_SEND_FAILED);
  const cfg = twilioConfig();
  if (!cfg) throw new Error(SMS_SEND_FAILED);

  const body = new URLSearchParams({ To: to, Body: text });
  if (cfg.service) body.set("MessagingServiceSid", cfg.service); else body.set("From", cfg.from);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.sid)}/Messages.json`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || !res.ok) {
    // Không ghi số điện thoại hay nội dung tin (có mã) vào log — chỉ trạng thái.
    console.error("[sms] Twilio từ chối/không phản hồi:", res ? res.status : "mạng");
    throw new Error(SMS_SEND_FAILED);
  }
}
