// BU-08 mục 4.4-5 — tài khoản HỆ THỐNG (khách hỏi) không phải học sinh: so khớp theo ĐUÔI email (src/lib/adminSystemAccounts.ts).
// Ca phá cố ý: đổi `endsWith` thành `includes` trong isSystemAccountEmail → ca "chứa giữa chuỗi" và "đuôi dài hơn" đỏ;
// bỏ `mode: "insensitive"` trong NOT_SYSTEM_ACCOUNT → ca "điều kiện Prisma không phân biệt hoa thường" đỏ.
import { NOT_SYSTEM_ACCOUNT, SYSTEM_EMAIL_SUFFIX, isSystemAccountEmail } from "@/lib/adminSystemAccounts";
import { check, section, done } from "./h";

section("isSystemAccountEmail");
check("đuôi đúng → true", isSystemAccountEmail("khach@he-thong.kin.invalid"));
check("không phân biệt hoa thường: KHACH@HE-THONG.KIN.INVALID → true", isSystemAccountEmail("KHACH@HE-THONG.KIN.INVALID") && isSystemAccountEmail("  Khach@He-Thong.Kin.Invalid "));
check("đuôi dài hơn: a@he-thong.kin.invalid.vn → false", !isSystemAccountEmail("a@he-thong.kin.invalid.vn"));
check("chứa giữa chuỗi: x@he-thong.kin.invalid.evil.com → false", !isSystemAccountEmail("x@he-thong.kin.invalid.evil.com") && !isSystemAccountEmail("he-thong.kin.invalid@gmail.com"));
check("hai dấu @ (cố ý giả đuôi) không được coi là tài khoản hệ thống", !isSystemAccountEmail("x@evil.com?@he-thong.kin.invalid") && !isSystemAccountEmail("a@b@he-thong.kin.invalid"));
check("chỉ riêng cái đuôi (không có phần tên) → false", !isSystemAccountEmail("@he-thong.kin.invalid") && !isSystemAccountEmail(SYSTEM_EMAIL_SUFFIX));
check("email thường / rỗng / null / undefined → false", !isSystemAccountEmail("hs@gmail.com") && !isSystemAccountEmail("") && !isSystemAccountEmail(null) && !isSystemAccountEmail(undefined));
check("đuôi hằng số đúng như BU-05 đã ghi", SYSTEM_EMAIL_SUFFIX === "@he-thong.kin.invalid");

section("NOT_SYSTEM_ACCOUNT (điều kiện Prisma)");
const cond = NOT_SYSTEM_ACCOUNT.NOT.email;
check("dạng { NOT: { email: { endsWith, mode: insensitive } } } — cột email không null nên NOT an toàn", cond.endsWith === SYSTEM_EMAIL_SUFFIX && cond.mode === "insensitive", NOT_SYSTEM_ACCOUNT);
check("dùng endsWith (đuôi), KHÔNG dùng contains", !("contains" in cond) && "endsWith" in cond);
done();
