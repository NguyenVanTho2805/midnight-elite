// Số điện thoại đăng nhập — phần thuần src/lib/phone.ts: chuẩn hoá di động VN sang E.164, che số, khoá mã, phân loại ô nhập.
import { classifyIdentifier, maskPhone, normalizeVnPhone, phoneClaimKey, phoneLoginKey, toNationalVn } from "@/lib/phone";
import { normalizeEmail } from "@/lib/loginCode";
import { check, section, done } from "./h";

section("normalizeVnPhone — các cách người Việt gõ cùng một số");
for (const [raw, why] of [
  ["0901234567", "dạng thường"], ["0901 234 567", "cách bằng dấu cách"], ["090.123.4567", "chấm"], ["090-123-4567", "gạch"],
  ["+84901234567", "+84"], ["+84 901 234 567", "+84 có cách"], ["84901234567", "84 không dấu +"], ["(+84) 901-234-567", "ngoặc"], ["  0901234567  ", "khoảng trắng hai đầu"],
] as const) check(`${JSON.stringify(raw)} (${why}) → +84901234567`, normalizeVnPhone(raw) === "+84901234567", normalizeVnPhone(raw));
check("đầu số 03/05/07/08/09 đều là di động", ["0321234567", "0521234567", "0721234567", "0821234567", "0921234567"].every(p => normalizeVnPhone(p) === `+84${p.slice(1)}`));

section("normalizeVnPhone — từ chối");
for (const [raw, why] of [
  ["0201234567", "đầu 02 là số bàn"], ["0101234567", "đầu 01 không có"], ["090123456", "thiếu số (9)"], ["09012345678", "thừa số (11)"], ["+14155552671", "số Mỹ"],
  ["+8490123456", "+84 thiếu số"], ["+849012345678", "+84 thừa số"], ["abc", "chữ"], ["", "rỗng"], ["   ", "toàn khoảng trắng"], ["0901234567@x.vn", "có @"],
  ["0901-234-567-8", "thừa một số sau khi bỏ gạch"], ["+0901234567", "+ rồi số 0"], ["0".repeat(30), "quá dài"],
] as const) check(`${JSON.stringify(raw.length > 20 ? raw.slice(0, 8) + "…" : raw)} (${why}) → null`, normalizeVnPhone(raw) === null, normalizeVnPhone(raw));
check("không phải chuỗi (null, số, object) → null", normalizeVnPhone(null) === null && normalizeVnPhone(901234567) === null && normalizeVnPhone({}) === null && normalizeVnPhone(undefined) === null);
check("chống chèn: mã nguy hiểm không lọt qua", normalizeVnPhone("0901234567; DROP TABLE users") === null && normalizeVnPhone("0901234567\n0911111111") === null);

section("Hiển thị + khoá");
check("toNationalVn: +84901234567 → 0901234567", toNationalVn("+84901234567") === "0901234567");
check("maskPhone che giữa, giữ đầu số + 4 số cuối", maskPhone("+84901234567") === "090 ••• 4567", maskPhone("+84901234567"));
check("maskPhone không để lộ các số giữa (123, 012)", !maskPhone("+84901234567").includes("123") && !maskPhone("+84901234567").includes("012"));
check("khoá đăng nhập có tiền tố 'tel:' → không thể trùng một email (email nào cũng có @, khoá này thì không)", phoneLoginKey("+84901234567") === "tel:+84901234567" && !phoneLoginKey("+84901234567").includes("@") && normalizeEmail(phoneLoginKey("+84901234567")) === null);
check("khoá xác minh gắn userId: hai người khác nhau ra hai khoá khác nhau", phoneClaimKey("u1", "+84901234567") !== phoneClaimKey("u2", "+84901234567") && phoneClaimKey("u1", "+84901234567") !== phoneLoginKey("+84901234567"));

section("classifyIdentifier — một ô 'Số điện thoại hoặc email'");
const idOf = (v: unknown) => classifyIdentifier(v, normalizeEmail);
check("có @ → email, chuẩn hoá chữ thường", JSON.stringify(idOf("  An@Mail.COM ")) === JSON.stringify({ kind: "email", email: "an@mail.com" }), idOf("  An@Mail.COM "));
check("số → phone E.164", JSON.stringify(idOf("0901 234 567")) === JSON.stringify({ kind: "phone", e164: "+84901234567" }));
check("email sai dạng → null; số sai dạng → null; rỗng → null", idOf("an@") === null && idOf("123") === null && idOf("") === null && idOf(undefined) === null);
check("chuỗi có @ nhưng giống số → vẫn xét như email (sai → null), không rơi sang số", idOf("0901234567@") === null);
done();
