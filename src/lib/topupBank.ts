// PRO D8 — tài khoản nhận tiền nạp Coin. Trước đây là một tài khoản giả (tên "công ty" chưa tồn tại) viết cứng trong mã;
// KiN chưa có pháp nhân nên KHÔNG hiện bất kỳ số tài khoản nào cho tới khi chủ dự án đặt đủ ba biến môi trường ở
// Production. MỘT chỗ đọc ba biến này; thiếu hoặc sai dạng thì trả null (giao diện báo "chưa công bố tài khoản nhận",
// không bịa số).

export interface TopupBank { bankName: string; accountNo: string; accountName: string }

export function getTopupBank(env: Record<string, string | undefined> = process.env): TopupBank | null {
  const bankName = (env.KIN_TOPUP_BANK_NAME ?? "").trim();
  const accountName = (env.KIN_TOPUP_ACCOUNT_NAME ?? "").trim();
  const accountNo = (env.KIN_TOPUP_ACCOUNT_NO ?? "").replace(/\s+/g, "");
  if (!bankName || !accountName || !/^[0-9]{6,20}$/.test(accountNo)) return null;
  return { bankName, accountNo, accountName };
}
