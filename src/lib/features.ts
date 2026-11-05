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
// \p{M} (dấu kết hợp): chữ ở dạng NFD như "xu" + dấu sắc ("xú") vẫn là MỘT từ khác, không được cắt "xu" ra rồi để dấu mồ côi.
const NOT_WORD_BEFORE = "(?<![\\p{L}\\p{N}\\p{M}])";
const NOT_WORD_AFTER = "(?![\\p{L}\\p{N}\\p{M}])";
// "xu" là đơn vị tiền, trừ khi đi liền "hướng"/"thế" ("Top 10 xu hướng", "Năm 2024 xu thế mới", "Điểm 8,5 xu thế" — số đứng trước không biến chúng thành tiền).
const XU = `xu(?!\\s+(?:hướng|thế)${NOT_WORD_AFTER})`;
// Số tiền kiểu VN: 20, 1.000, 12.500,5, và nhóm bằng khoảng trắng ("500 000", NBSP, thin space, narrow NBSP) — dấu/khoảng nằm GIỮA chữ số, không bao giờ kết thúc số.
const GROUP_SPACE = "[ \u00A0\u2007\u2009\u202F]";
const AMOUNT = `[+\\-\u2212]?(?:\\d{1,3}(?:${GROUP_SPACE}\\d{3})+(?:[.,]\\d+)*|\\d+(?:[.,]\\d+)*)`;
// Ký tự điều hướng / độ rộng bằng không (LRM, RLM, LRE…RLO, PDF, LRI…PDI, ZWSP, ZWNJ, ZWJ, BOM, word-joiner): vô hình nhưng chen giữa "20" và "xu" làm hụt khớp.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const COIN = "coins?";
const RE_DEDUCT = new RegExp(`,?\\s*bạn bị trừ ${AMOUNT}\\s*(?:${XU}|${COIN})${NOT_WORD_AFTER}`, "giu");
const RE_AMOUNT_UNIT = new RegExp(`\\s*${NOT_WORD_BEFORE}${AMOUNT}\\s*(?:${XU}|${COIN}|🪙)${NOT_WORD_AFTER}`, "giu");
const RE_COIN_AMOUNT = new RegExp(`\\s*🪙\\s*${AMOUNT}${NOT_WORD_AFTER}`, "gu");
// Nhãn rồi số: "Coin: 50", "Coin 50", "Coin = +50", "Xu: 50" — bỏ cả nhãn lẫn số (không để lọt "điểm thưởng: 50"). "xu" trơ trọi + số không có dấu hai chấm thì giữ (không chắc là tiền).
const RE_LABEL_AMOUNT = new RegExp(`\\s*${NOT_WORD_BEFORE}(?:${COIN}\\s*[:=\\-\u2013\u2014]?|xu\\s*[:=])\\s*${AMOUNT}${NOT_WORD_AFTER}`, "giu");
const RE_COIN_WORD = new RegExp(`${NOT_WORD_BEFORE}${COIN}${NOT_WORD_AFTER}`, "giu");

const DEDUCT_TAIL = "phần thưởng của câu trả lời này bị trừ lại";

/**
 * Chữ thông báo đã lưu từ trước (hàng cũ trong bảng thông báo có thể ghi "+20 xu", "bị trừ 20 xu", "Coin"):
 * khi Coin ẩn, bỏ phần "số + xu/Coin/🪙" khỏi chữ hiển thị. Không sửa dữ liệu đã lưu.
 * Chỉ "xu" là ĐƠN VỊ TIỀN đứng sau số mới bị bỏ: "Xu thế", "xu hướng", "xuống" giữ nguyên; "xu" không đi kèm số cũng giữ nguyên.
 * Số có dấu chấm hàng nghìn ("1.000 xu") hay nhóm bằng khoảng trắng ("500 000 xu") bỏ nguyên số, không để sót "1." / "Phí 500".
 * Ưu tiên KHÔNG để lộ số xu; mất ngữ cảnh ("1 xu rồi 2 xu" → "rồi") chấp nhận được, nhưng không để dấu phẩy / ngoặc rỗng / khoảng trắng mồ côi.
 */
export function hideCoinText(s: string): string {
  if (COIN_VISIBLE) return s;
  // So khớp trên chuỗi NFC, bỏ ký tự vô hình; không có gì để ẩn thì trả NGUYÊN chuỗi gốc.
  const n = s.normalize("NFC").replace(INVISIBLE, "");
  const out = n
    .replace(RE_DEDUCT, (_m, offset: number, whole: string) => {
      // Đầu chuỗi / đầu câu: không có dấu phẩy dẫn, viết hoa; giữa câu: ", phần thưởng…".
      const before = whole.slice(0, offset).replace(/\s+$/, "");
      return !before || /[.!?\n]$/.test(before) ? (before ? " " : "") + DEDUCT_TAIL.charAt(0).toUpperCase() + DEDUCT_TAIL.slice(1) : ", " + DEDUCT_TAIL;
    })
    .replace(RE_LABEL_AMOUNT, "")
    .replace(RE_AMOUNT_UNIT, "")
    .replace(RE_COIN_AMOUNT, "")
    .replace(/🪙/gu, "")
    .replace(RE_COIN_WORD, "điểm thưởng");
  if (out === n) return s;
  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\(\s*\)|\[\s*\]/g, "")            // ngoặc rỗng sau khi bỏ "(20 xu)"
    .replace(/\s+([,.;:!?)\]])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .replace(/([,;:])(?:\s*[,;:])+/g, "$1")        // dấu phẩy chồng nhau
    .replace(/^[\s,;:.]+/, "")                       // dấu dẫn mồ côi
    .replace(/[\s,;:]+$/, "")                       // dấu cuối mồ côi
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
