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

// Ranh giới từ theo Unicode (\b của JS chỉ hiểu ASCII nên "xuống" bị coi là "xu" + "ống").
const NOT_WORD_BEFORE = "(?<![\\p{L}\\p{N}])";
const NOT_WORD_AFTER = "(?![\\p{L}\\p{N}])";
// Số tiền kiểu VN: 20, 1.000, 12.500,5 — dấu chấm/phẩy nằm GIỮA chữ số, không bao giờ kết thúc số.
const AMOUNT = "[+\\-\u2212]?\\d+(?:[.,]\\d+)*";
const RE_DEDUCT = new RegExp(`,?\\s*bạn bị trừ ${AMOUNT}\\s*(?:xu|coin)${NOT_WORD_AFTER}`, "giu");
const RE_AMOUNT_UNIT = new RegExp(`\\s*${NOT_WORD_BEFORE}${AMOUNT}\\s*(?:xu|coin|🪙)${NOT_WORD_AFTER}`, "giu");
const RE_COIN_AMOUNT = new RegExp(`\\s*🪙\\s*${AMOUNT}${NOT_WORD_AFTER}`, "gu");
const RE_COIN_WORD = new RegExp(`${NOT_WORD_BEFORE}coin${NOT_WORD_AFTER}`, "giu");

/**
 * Chữ thông báo đã lưu từ trước (hàng cũ trong bảng thông báo có thể ghi "+20 xu", "bị trừ 20 xu", "Coin"):
 * khi Coin ẩn, bỏ phần "số + xu/Coin/🪙" khỏi chữ hiển thị. Không sửa dữ liệu đã lưu.
 * Chỉ "xu" là ĐƠN VỊ TIỀN đứng sau số mới bị bỏ: "Xu thế", "xu hướng", "xuống" giữ nguyên; "xu" không đi kèm số cũng giữ nguyên.
 * Số có dấu chấm hàng nghìn ("1.000 xu") bỏ nguyên số, không để sót "1.".
 */
export function hideCoinText(s: string): string {
  if (COIN_VISIBLE) return s;
  const out = s
    .replace(RE_DEDUCT, ", phần thưởng của câu trả lời này bị trừ lại")
    .replace(RE_AMOUNT_UNIT, "")
    .replace(RE_COIN_AMOUNT, "")
    .replace(/🪙/gu, "")
    .replace(RE_COIN_WORD, "điểm thưởng");
  return out === s ? s : out.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}
