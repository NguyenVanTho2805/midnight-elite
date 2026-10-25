// NC2-023 (Q9) — Cờ "chạy thử miễn phí". MỘT chỗ đọc duy nhất.
// Bật khi KIN_TRIAL_MODE đúng bằng "1"; mọi giá trị khác (rỗng, "0", "true", thiếu) = TẮT.
// Cờ CHỈ ẩn lối MUA phía gia sư (mua VIP, nạp Coin). Không xoá gói/giá, không đụng ví,
// không đổi cách tính; gia sư đã có gói đang hiệu lực không bị ảnh hưởng.
// Mặc định TẮT; chủ dự án tự bật bằng biến môi trường ở Production.

export function isTrialMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.KIN_TRIAL_MODE === "1";
}

export const TRIAL_MODE_MESSAGE = "KiN đang miễn phí trong giai đoạn chạy thử, chưa cần mua gói.";
export const TRIAL_MODE_BANNER_TITLE = "KiN miễn phí trong giai đoạn chạy thử";
export const TRIAL_MODE_BANNER_BODY = "Bạn chưa cần mua gói hay nạp Coin để dùng KiN.";
export const TRIAL_TOPUP_MESSAGE = "KiN đang miễn phí trong giai đoạn chạy thử, chưa cần nạp Coin.";
export const PREVIEW_MONEY_MESSAGE = "Bản xem trước không có thao tác tiền.";
