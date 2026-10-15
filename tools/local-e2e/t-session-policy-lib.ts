// Mốc phiên (Figma 33:2) — phần thuần src/lib/sessionPolicy.ts: ai được 30 ngày / 12 giờ, khi nào gia hạn, khi nào token quá tuổi.
import { ADMIN_SESSION_MS, DAY_MS, HOUR_MS, RENEW_AFTER_MS, USER_SESSION_MS, isAdminSession, isPastMaxAge, sessionLifetimeLabel, sessionLifetimeMs, shouldRenew } from "@/lib/sessionPolicy";
import { check, section, done } from "./h";

const NOW = Date.UTC(2026, 9, 14, 5, 0, 0);
const iatAgo = (ms: number) => Math.floor((NOW - ms) / 1000);

section("Hằng số");
check("học sinh/gia sư 30 ngày, quản trị 12 giờ, gia hạn tối đa 1 lần/24 giờ", USER_SESSION_MS === 30 * DAY_MS && ADMIN_SESSION_MS === 12 * HOUR_MS && RENEW_AFTER_MS === DAY_MS);

section("Ai là quản trị");
check("admin_super và admin_content là quản trị", isAdminSession({ role: "admin", adminRole: "admin_super" }) && isAdminSession({ role: "admin", adminRole: "admin_content" }));
check("gia sư (role admin, adminRole teacher) KHÔNG phải quản trị", !isAdminSession({ role: "admin", adminRole: "teacher" }));
check("học sinh không phải quản trị", !isAdminSession({ role: "student" }));
check("role admin thiếu adminRole → coi là quản trị (nghiêng về phía an toàn)", isAdminSession({ role: "admin" }) && isAdminSession({ role: "admin", adminRole: null }));

section("Thời gian sống");
check("quản trị 12 giờ; gia sư và học sinh 30 ngày", sessionLifetimeMs({ role: "admin", adminRole: "admin_super" }) === 12 * HOUR_MS && sessionLifetimeMs({ role: "admin", adminRole: "teacher" }) === 30 * DAY_MS && sessionLifetimeMs({ role: "student" }) === 30 * DAY_MS);
check("nhãn chữ '12 giờ' / '30 ngày'", sessionLifetimeLabel({ role: "admin", adminRole: "admin_content" }) === "12 giờ" && sessionLifetimeLabel({ role: "student" }) === "30 ngày");

section("Quá tuổi tối đa (đọc token)");
check("quản trị cấp 11 giờ trước → còn hạn", !isPastMaxAge({ role: "admin", adminRole: "admin_super", iat: iatAgo(11 * HOUR_MS) }, NOW));
check("quản trị cấp đúng 12 giờ trước → hết (ranh giới tính là hết)", isPastMaxAge({ role: "admin", adminRole: "admin_super", iat: iatAgo(12 * HOUR_MS) }, NOW));
check("quản trị cấp 13 giờ trước → hết dù exp của token cũ còn xa", isPastMaxAge({ role: "admin", adminRole: "admin_content", iat: iatAgo(13 * HOUR_MS) }, NOW));
check("học sinh cấp 20 ngày trước → còn hạn; 31 ngày → hết", !isPastMaxAge({ role: "student", iat: iatAgo(20 * DAY_MS) }, NOW) && isPastMaxAge({ role: "student", iat: iatAgo(31 * DAY_MS) }, NOW));
check("gia sư cấp 13 giờ trước vẫn còn hạn (mốc 30 ngày, không phải 12 giờ)", !isPastMaxAge({ role: "admin", adminRole: "teacher", iat: iatAgo(13 * HOUR_MS) }, NOW));
check("token không có iat → coi như quá tuổi (không chứng minh được tuổi)", isPastMaxAge({ role: "student" }, NOW) && isPastMaxAge({ role: "admin", adminRole: "admin_super" }, NOW));

section("Gia hạn");
check("học sinh vừa đăng nhập (1 giờ) → chưa gia hạn", !shouldRenew({ role: "student", iat: iatAgo(HOUR_MS) }, NOW));
check("học sinh 23 giờ 59 phút → chưa; đúng 24 giờ → gia hạn", !shouldRenew({ role: "student", iat: iatAgo(DAY_MS - 60_000) }, NOW) && shouldRenew({ role: "student", iat: iatAgo(DAY_MS) }, NOW));
check("học sinh 10 ngày → gia hạn", shouldRenew({ role: "student", iat: iatAgo(10 * DAY_MS) }, NOW));
check("gia sư 3 ngày → gia hạn", shouldRenew({ role: "admin", adminRole: "teacher", iat: iatAgo(3 * DAY_MS) }, NOW));
check("quản trị KHÔNG BAO GIỜ gia hạn (kể cả 13 giờ, 5 giờ, 1 phút)", [13 * HOUR_MS, 5 * HOUR_MS, 60_000].every(a => !shouldRenew({ role: "admin", adminRole: "admin_super", iat: iatAgo(a) }, NOW)));
check("phiên đã quá 30 ngày thì không 'cứu' bằng gia hạn", !shouldRenew({ role: "student", iat: iatAgo(31 * DAY_MS) }, NOW));
check("không có iat → không gia hạn", !shouldRenew({ role: "student" }, NOW));
done();
