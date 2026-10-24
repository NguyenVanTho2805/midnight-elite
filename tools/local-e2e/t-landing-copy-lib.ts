import { TUTOR_CTA, TUTOR_FAQ, TUTOR_PAINS, TUTOR_STEPS } from "@/lib/landingCopy";
import { check, section, done } from "./h";

const all = [...TUTOR_PAINS.flatMap(p => [p.title, p.desc]), ...TUTOR_STEPS.flatMap(p => [p.title, p.desc]), ...TUTOR_FAQ.flatMap(f => [f.q, f.a])];
const BANNED: [RegExp, string][] = [
  [/đúng luật|hợp pháp|miễn thuế|giảm thuế|đã xác minh|xác thực/i, "chữ pháp lý / xác minh bị cấm (D17)"],
  [/miễn phí|không cần thẻ|dùng thử|hoàn tiền|giá|\d+\s?%|\d{2,}\s?(gia sư|học sinh|phụ huynh)/i, "hứa giá / số liệu bịa"],
  [/hàng đầu|số 1|tốt nhất|đảm bảo|cam kết/i, "lời tự xưng / cam kết không có căn cứ"],
  [/đã gửi|tự động gửi|tự gửi/i, "KiN không biết tin Zalo có đi thật"],
  [/Midnight Elite/i, "tên cũ"],
];

section("KH-01 chữ trang chủ gia sư");
check("đúng 6 nỗi đau", TUTOR_PAINS.length === 6);
check("đúng 3 bước", TUTOR_STEPS.length === 3);
check("đúng 10 câu FAQ", TUTOR_FAQ.length === 10);
check("câu hỏi không trùng nhau, mọi ô có chữ", new Set(TUTOR_FAQ.map(f => f.q)).size === 10 && all.every(t => t.trim().length > 8));
for (const [re, why] of BANNED) { const hit = all.filter(t => re.test(t)); check(`không có ${re.source.slice(0, 36)}… — ${why}`, hit.length === 0, hit); }
check("nói rõ KiN không giữ tiền, không tự gửi Zalo, không phải kế toán/thuế",
  TUTOR_FAQ.some(f => /Không\. Phụ huynh chuyển thẳng/.test(f.a) && /không giữ tiền/.test(f.a)) && TUTOR_FAQ.some(f => /bạn là người bấm gửi/.test(f.a)) && TUTOR_FAQ.some(f => /không xác minh/.test(f.a)));
check("nút tạo tài khoản mở thẳng vai gia sư", TUTOR_CTA.signup === "/dang-ky?vai=gia-su");
// ca phá cố ý: bộ quét phải bắt được câu vi phạm
check("[phá cố ý] bộ quét bắt 'đúng luật', 'miễn thuế', 'đã xác minh', 'miễn phí'", ["Hoàn toàn đúng luật", "Được miễn thuế", "Hồ sơ đã xác minh", "Dùng miễn phí"].every(t => BANNED.some(([re]) => re.test(t))));
done();
