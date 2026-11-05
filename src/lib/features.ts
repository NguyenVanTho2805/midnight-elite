// Cờ giao diện tập trung. Chỉ điều khiển phần HIỂN THỊ; không đụng bảng, cột, API hay logic ghi.
// COIN_VISIBLE (quyết định chủ CHỦ-02, 05/11/2026): false = ẩn mọi hiển thị Coin khỏi giao diện
// học sinh, gia sư, khách và quản trị (số dư, ví, thưởng, nạp, hàng chờ nạp). Bật lại: đổi thành true.
// Dữ liệu cũ và API ghi Coin giữ nguyên; chỉ không còn lối vào từ giao diện.
export const COIN_VISIBLE = false;

/** Loại hàng chờ thuộc Coin: không hiện khi COIN_VISIBLE = false. */
export const COIN_QUEUE_KIND = "nap-coin";

/** Nhãn mô tả dữ liệu cũ (nhật ký, quyền): khi Coin ẩn, không để chữ "Coin" lọt ra màn hình. */
export function hideCoin(s: string): string {
  return COIN_VISIBLE ? s : s.replace(/Coin/g, "điểm thưởng");
}

/**
 * Chữ thông báo đã lưu từ trước (hàng cũ trong bảng thông báo có thể ghi "+20 xu", "bị trừ 20 xu", "Coin"):
 * khi Coin ẩn, bỏ phần số xu/Coin khỏi chữ hiển thị. Không sửa dữ liệu đã lưu.
 */
export function hideCoinText(s: string): string {
  if (COIN_VISIBLE) return s;
  return s
    .replace(/,?\s*bạn bị trừ \d+\s*(xu|Coin)/gi, ", phần thưởng của câu trả lời này bị trừ lại")
    .replace(/\s*[+\-]?\d+\s*(xu|Coin)\b/gi, "")
    .replace(/🪙/g, "")
    .replace(/\bCoin\b/g, "điểm thưởng")
    .replace(/(^|[^\p{L}])xu(?![\p{L}])(?!\s+hướng)/giu, "$1điểm thưởng");
}
