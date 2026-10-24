// KiN Pro — cấu hình nhận tiền, đọc từ BIẾN MÔI TRƯỜNG. Không bao giờ có số tài khoản mặc định / giả: thiếu cấu hình thì "Chưa mở bán".
//   KINPRO_BANK_BIN       mã ngân hàng VietQR, 6 chữ số
//   KINPRO_ACCOUNT_NO     số tài khoản nhận tiền
//   KINPRO_ACCOUNT_NAME   tên chủ tài khoản
//   KINPRO_CODE_PREFIX    tiền tố nội dung chuyển khoản (mặc định "KINPRO-" khi không đặt hoặc đặt sai)
// Bán hàng cần thêm: không phải bản xem trước (dùng chung DB production), và không đang ở cờ chạy thử (isTrialMode: "KiN miễn phí giai đoạn chạy thử").
import { buildInvoiceQrUrl, validatePayoutAccount } from "@/lib/tuitionInvoice";
import { bankName } from "@/lib/banks";
import { cleanMemoPrefix, isPreviewEnv } from "@/lib/planLimits";
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
