// HP-28 — gợi ý phí trễ hạn (phần THUẦN): chỉ phiếu còn nợ + quá hạn + đang bật; chữ không chứa số tiền; khoá theo gia sư.
import { LATE_FEE_HINT_TEXT, lateFeeHintKey, parseLateFeeHintSetting, showLateFeeHint } from "@/lib/lateFeeHint";
import { check, section, done } from "./h";

section("Bật/tắt cấu hình");
check("chưa cấu hình → bật", parseLateFeeHintSetting(null) === true && parseLateFeeHintSetting(undefined) === true);
check("'1' bật, '0' tắt, rác không làm tắt (mặc định bật)", parseLateFeeHintSetting("1") === true && parseLateFeeHintSetting("0") === false && parseLateFeeHintSetting("abc") === true && parseLateFeeHintSetting("") === true);
check("khoá theo từng gia sư, không trùng nhau", lateFeeHintKey("u1") !== lateFeeHintKey("u2") && lateFeeHintKey("u1").endsWith("u1"));

section("Chỉ hiện trên phiếu còn nợ và đã quá hạn");
const base = { enabled: true, status: "sent", remaining: 500_000, overdueDays: 3 };
check("phiếu quá hạn còn nợ → hiện", showLateFeeHint(base) === true);
check("tắt → không hiện", showLateFeeHint({ ...base, enabled: false }) === false);
check("chưa quá hạn (0 ngày) → không", showLateFeeHint({ ...base, overdueDays: 0 }) === false);
check("còn 0đ → không", showLateFeeHint({ ...base, remaining: 0 }) === false);
check("đã thu đủ / đã huỷ → không (dù số liệu cũ còn quá hạn)", showLateFeeHint({ ...base, status: "paid" }) === false && showLateFeeHint({ ...base, status: "cancelled" }) === false);
check("[phá] số âm / NaN không làm hiện", showLateFeeHint({ ...base, remaining: -1 }) === false && showLateFeeHint({ ...base, overdueDays: NaN }) === false);

section("Chữ trung thực, KHÔNG số tiền, KHÔNG hứa tự thu");
check("đúng câu chủ duyệt", LATE_FEE_HINT_TEXT === "Gợi ý: có thể thu thêm phí trễ hạn — KiN không tự cộng tiền.");
check("không chứa chữ số (không số tiền) và không 'đã gửi' / 'đã xác minh'", !/\d/.test(LATE_FEE_HINT_TEXT) && !/đã gửi|đã xác minh/i.test(LATE_FEE_HINT_TEXT));
done();
