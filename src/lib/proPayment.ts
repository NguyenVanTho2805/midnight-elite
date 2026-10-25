// KiN Pro — cấu hình nhận tiền, đọc từ BIẾN MÔI TRƯỜNG. Không bao giờ có số tài khoản mặc định / giả: thiếu cấu hình thì "Chưa mở bán".
//   KINPRO_BANK_BIN       mã ngân hàng VietQR, 6 chữ số
//   KINPRO_ACCOUNT_NO     số tài khoản nhận tiền
//   KINPRO_ACCOUNT_NAME   tên chủ tài khoản
//   KINPRO_CODE_PREFIX    tiền tố nội dung chuyển khoản (mặc định "KINPRO-" khi không đặt hoặc đặt sai)
// Bán hàng cần thêm: không phải bản xem trước (dùng chung DB production), và không đang ở cờ chạy thử (isTrialMode: "KiN miễn phí giai đoạn chạy thử").
import { createHash, timingSafeEqual } from "node:crypto";
import { buildInvoiceQrUrl, extractInvoiceCode, validatePayoutAccount } from "@/lib/tuitionInvoice";
import { bankName } from "@/lib/banks";
import { MEMO_ALPHABET, cleanMemoPrefix, isPreviewEnv } from "@/lib/planLimits";
import { isTrialMode } from "@/lib/trialMode";

export interface ProPayAccount { bankBin: string; bankName: string; accountNo: string; accountName: string }
export type SaleClosedReason = "no-config" | "preview" | "trial";
export interface ProPayConfig { open: boolean; /** Đã đặt đủ biến môi trường nhận tiền (kể cả khi đang chạy thử / xem trước nên chưa bán). */ configured: boolean; reason: SaleClosedReason | null; account: ProPayAccount | null; prefix: string }

export const SALE_CLOSED_TEXT = "Chưa mở bán";

export function proPayConfig(env: Record<string, string | undefined> = process.env): ProPayConfig {
  const prefix = cleanMemoPrefix(env.KINPRO_CODE_PREFIX);
  const v = validatePayoutAccount({ bankBin: env.KINPRO_BANK_BIN, accountNo: env.KINPRO_ACCOUNT_NO, accountName: env.KINPRO_ACCOUNT_NAME });
  const account = v.ok ? { ...v.value, bankName: bankName(v.value.bankBin) } : null;
  const reason: SaleClosedReason | null = isPreviewEnv(env) ? "preview" : isTrialMode(env) ? "trial" : !account ? "no-config" : null;
  return { open: reason === null, configured: !!account, reason, account: reason === null ? account : null, prefix };
}

/** Link ảnh QR VietQR cho một yêu cầu. Chỉ gọi khi `proPayConfig().open`. */
export function proQrUrl(account: ProPayAccount, amountVnd: number, memoCode: string): string {
  return buildInvoiceQrUrl(account, { amount: amountVnd, addInfo: memoCode });
}

// ── Webhook SePay xác nhận thanh toán Pro (POST /api/webhooks/sepay-pro) ────────────────────────────────────────
//   KINPRO_SEPAY_API_KEY  khoá API đặt ở SePay (mục "Chứng thực": Apikey). SePay gửi `Authorization: Apikey <khoá>`. Tối thiểu 16 ký tự.
// Khoá lấy từ BIẾN MÔI TRƯỜNG (không lưu DB, không băm lưu như webhook học phí của từng gia sư). Thiếu khoá, thiếu tài khoản nhận tiền,
// là bản xem trước, hoặc tiền tố mã có thể bị nhầm với mã phiếu học phí (KIN + 5 ký tự) → webhook TẮT (route trả 503, không đụng DB).
export type WebhookOffReason = "preview" | "no-key" | "no-config" | "prefix-clash";
export interface ProWebhookConfig { enabled: boolean; reason: WebhookOffReason | null; apiKey: string | null; prefix: string; accountNo: string | null }
export const PRO_WEBHOOK_KEY_MIN = 16;

/** Tiền tố an toàn khi MỌI mã sinh ra từ nó đều không bị `extractInvoiceCode` (luồng học phí) nhận nhầm. Kiểm bằng các đuôi đại diện cho cả bảng chữ. */
export function proPrefixDisjointFromInvoice(prefix: string): boolean {
  const tails = [MEMO_ALPHABET.slice(0, 8), MEMO_ALPHABET.slice(8, 16), MEMO_ALPHABET.slice(16, 24), MEMO_ALPHABET.slice(23), "AAAAAAAA", "22222222", "ZZZZZZZZ"];
  for (const t of tails) {
    if (extractInvoiceCode(null, prefix + t) !== null) return false;
    if (extractInvoiceCode(null, `${prefix} ${t}`) !== null) return false;
    if (extractInvoiceCode(`${prefix}${t}`, null) !== null) return false;
  }
  return true;
}

export function proWebhookConfig(env: Record<string, string | undefined> = process.env): ProWebhookConfig {
  const pay = proPayConfig(env);
  const v = validatePayoutAccount({ bankBin: env.KINPRO_BANK_BIN, accountNo: env.KINPRO_ACCOUNT_NO, accountName: env.KINPRO_ACCOUNT_NAME });
  const key = (env.KINPRO_SEPAY_API_KEY ?? "").trim();
  const reason: WebhookOffReason | null = isPreviewEnv(env) ? "preview" : key.length < PRO_WEBHOOK_KEY_MIN ? "no-key" : !pay.configured ? "no-config" : !proPrefixDisjointFromInvoice(pay.prefix) ? "prefix-clash" : null;
  return { enabled: reason === null, reason, apiKey: reason === null ? key : null, prefix: pay.prefix, accountNo: v.ok ? v.value.accountNo : null };
}

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest();
/** So khoá nhận được với khoá trong env bằng thời gian không đổi. Thiếu một bên → sai. */
export function verifyEnvApiKey(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false;
  return timingSafeEqual(sha(provided), sha(expected));
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Tìm mã đơn Pro (đã chuẩn hoá "<tiền tố><8 ký tự>") trong trường `code` hoặc `content` của SePay. Ngân hàng hay bỏ hoặc đổi dấu gạch / khoảng trắng,
 * và có thể dán liền tên người chuyển ngay sau mã, nên: gạch trong tiền tố khớp "-", " " hoặc không có gì; không đòi ký tự ngăn sau mã. Trả null nếu không thấy.
 */
export function extractProCode(prefix: string, providerCode: string | null | undefined, content: string | null | undefined): string | null {
  const pre = prefix.toUpperCase();
  const body = pre.split("-").map(esc).join("[- ]?");
  const re = new RegExp(`(?<![A-Z0-9])${body}([${MEMO_ALPHABET}]{8})`);
  for (const raw of [providerCode, content]) {
    if (!raw) continue;
    const m = re.exec(raw.toUpperCase());
    if (m) return `${pre}${m[1]}`;
  }
  return null;
}

// ── Quyết định khi tiền về (thuần, có test) ─────────────────────────────────────────────────────────────────────
export type ProReviewReason = "no_code" | "unknown_code" | "amount_mismatch" | "order_not_pending" | "order_not_purchase";
export type ProPaymentDecision = { action: "activate" } | { action: "review"; reason: ProReviewReason };
/**
 * Chỉ KÍCH HOẠT khi: tìm thấy mã, mã thuộc một yêu cầu mua, yêu cầu còn "pending" và số tiền về BẰNG ĐÚNG số tiền đã chụp trên yêu cầu (thiếu hay thừa đều không).
 * Mọi trường hợp khác → "review" cho admin duyệt tay. Không bao giờ tự hoàn tiền, không ghép theo số tiền khi không có mã.
 */
export function decideProPayment(i: { code: string | null; order: { status: string; source: string; priceVnd: number } | null; amount: number }): ProPaymentDecision {
  if (!i.code) return { action: "review", reason: "no_code" };
  if (!i.order) return { action: "review", reason: "unknown_code" };
  if (i.order.source !== "purchase") return { action: "review", reason: "order_not_purchase" };
  if (i.order.status !== "pending") return { action: "review", reason: "order_not_pending" };
  if (!Number.isInteger(i.amount) || i.amount !== i.order.priceVnd || i.order.priceVnd <= 0) return { action: "review", reason: "amount_mismatch" };
  return { action: "activate" };
}

export const PRO_REVIEW_REASON_TEXT: Record<ProReviewReason, string> = {
  no_code: "Không thấy mã đơn Pro trong nội dung chuyển khoản",
  unknown_code: "Có mã nhưng không khớp yêu cầu Pro nào",
  amount_mismatch: "Có mã đúng nhưng số tiền khác số trên yêu cầu",
  order_not_pending: "Yêu cầu này đã kích hoạt hoặc đã huỷ, tiền về thêm",
  order_not_purchase: "Mã thuộc suất tặng, không phải yêu cầu mua",
};
