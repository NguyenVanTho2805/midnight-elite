// ADM-xoa-tk (phần THUẦN, không DB) — ẩn danh hoá tài khoản + chặn 409 + ma trận quyền DELETE_ACCOUNTS.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-adm-xoa-tk-lib.ts
//
// CA PHÁ CỐ Ý (chạy tay, mỗi lần một thứ, rồi hoàn lại):
//   - Bỏ `phone: null` khỏi buildAnonymizedUserData → ca "không còn PII" đỏ.
//   - Đổi thứ tự hai dòng đầu của pickBlocker (active_enrollments / owned_courses_active) → ca "thứ tự cố định" đỏ.
//   - Thêm DELETE_ACCOUNTS vào ROLE_PERMISSIONS.admin_content → ca "ma trận quyền" đỏ.
//   - Đổi anonEmail thành "del+..." → ca "anonEmail" đỏ.
import { check, section, done } from "./h";
import { ANON_NAME, anonEmail, isAnonEmail, NOT_ANONYMIZED, buildAnonymizedUserData, pickBlocker, type BlockerCounts } from "@/lib/accountDelete";
import { ROLE_PERMISSIONS, checkPermission, PERMISSIONS } from "@/lib/permissions";

const ZERO: BlockerCounts = { activeEnrollments: 0, ownedCoursesActive: 0, openInvoices: 0, uninvoicedFees: 0, activePackages: 0, pendingTopups: 0, pendingProOrders: 0, walletBalance: 0, approvedTopups: 0, activeSubscriptions: 0 };
const NOW = new Date("2026-11-07T00:00:00Z");

section("anonEmail / isAnonEmail");
check("anonEmail(id) = deleted+<id>@invalid", anonEmail("abc") === "deleted+abc@invalid");
check("isAnonEmail đúng/sai", isAnonEmail(anonEmail("x")) && !isAnonEmail("a@b.vn") && !isAnonEmail("xdeleted+1@b.vn") && !isAnonEmail(null) && !isAnonEmail(undefined));
check("NOT_ANONYMIZED loại tiền tố deleted+", JSON.stringify(NOT_ANONYMIZED) === JSON.stringify({ NOT: { email: { startsWith: "deleted+" } } }));

section("buildAnonymizedUserData");
for (const kind of ["student", "tutor"] as const) {
  const d = buildAnonymizedUserData("u1", kind, NOW) as Record<string, unknown>;
  check(`${kind}: deletedAt, banned, email, name`, d.deletedAt === NOW && d.banned === true && d.email === "deleted+u1@invalid" && d.name === ANON_NAME);
  const nulls = ["phone", "phoneE164", "phoneVerifiedAt", "dateOfBirth", "parentPhone", "parentName", "school", "highSchool", "city", "avatarBase64", "facebookUrl", "zaloPhone", "bio"];
  check(`${kind}: không còn PII (13 trường = null)`, nulls.every(k => k in d && d[k] === null), nulls.filter(k => d[k] !== null));
  check(`${kind}: subjects=[] và preferences được xoá`, Array.isArray(d.subjects) && (d.subjects as unknown[]).length === 0 && "preferences" in d && d.preferences !== undefined && d.preferences !== null);
  const pw = String(d.password);
  check(`${kind}: password ngẫu nhiên 64 hex, không phải bcrypt, mỗi lần khác`, /^[0-9a-f]{64}$/.test(pw) && !pw.startsWith("$2") && pw !== String((buildAnonymizedUserData("u1", kind) as Record<string, unknown>).password));
  check(`${kind}: không đổi role/adminRole/studentId/số tiền`, !("role" in d) && !("adminRole" in d) && !("studentId" in d) && !Object.keys(d).some(k => /balance|amount|coin/i.test(k)));
  check(`${kind}: ${kind === "tutor" ? "tutorVerified=false + khoá hồ sơ" : "không đụng cờ gia sư"}`,
    kind === "tutor" ? d.tutorVerified === false && d.profileLockedAt === NOW && d.profileLockReason === "Tài khoản đã xóa" : !("tutorVerified" in d) && !("profileLockedAt" in d));
}

section("pickBlocker: từng mã + thứ tự");
check("không vướng → null", pickBlocker(ZERO) === null);
const one: [string, Partial<BlockerCounts>][] = [
  ["active_enrollments", { activeEnrollments: 2 }], ["owned_courses_active", { ownedCoursesActive: 1 }], ["open_invoices", { openInvoices: 3 }], ["uninvoiced_fees", { uninvoicedFees: 4 }],
  ["active_packages", { activePackages: 1 }], ["pending_money", { pendingTopups: 1 }], ["pending_money", { pendingProOrders: 1 }],
  ["wallet_from_money", { walletBalance: 10, approvedTopups: 1 }], ["active_subscription", { activeSubscriptions: 1 }],
];
for (const [code, c] of one) { const b = pickBlocker({ ...ZERO, ...c }); check(`${code} (${JSON.stringify(c)}) → 409 + tiếng Việt`, b?.code === code && b.status === 409 && /[à-ỹ]/.test(b.error) && b.error.length > 20, b); }
check("số lượng nằm trong câu: 2 lớp / 3 phiếu", /2 lớp/.test(pickBlocker({ ...ZERO, activeEnrollments: 2 })!.error) && /3 phiếu/.test(pickBlocker({ ...ZERO, openInvoices: 3 })!.error));
check("ví có Coin nhưng chưa từng nạp tiền thật (thưởng đăng ký) → KHÔNG chặn", pickBlocker({ ...ZERO, walletBalance: 500, approvedTopups: 0 }) === null);
check("đã nạp tiền thật nhưng ví 0 → KHÔNG chặn", pickBlocker({ ...ZERO, walletBalance: 0, approvedTopups: 2 }) === null);
const c: BlockerCounts = { activeEnrollments: 1, ownedCoursesActive: 1, openInvoices: 1, uninvoicedFees: 1, activePackages: 1, pendingTopups: 1, pendingProOrders: 1, walletBalance: 1, approvedTopups: 1, activeSubscriptions: 1 };
const order = ["active_enrollments", "owned_courses_active", "open_invoices", "uninvoiced_fees", "active_packages", "pending_money", "wallet_from_money", "active_subscription"];
const clear: Record<string, (x: BlockerCounts) => void> = {
  active_enrollments: x => { x.activeEnrollments = 0; }, owned_courses_active: x => { x.ownedCoursesActive = 0; }, open_invoices: x => { x.openInvoices = 0; }, uninvoiced_fees: x => { x.uninvoicedFees = 0; },
  active_packages: x => { x.activePackages = 0; }, pending_money: x => { x.pendingTopups = 0; x.pendingProOrders = 0; }, wallet_from_money: x => { x.walletBalance = 0; }, active_subscription: x => { x.activeSubscriptions = 0; },
};
const seen: string[] = [];
for (let b = pickBlocker(c); b && seen.length < 20; b = pickBlocker(c)) { seen.push(b.code); clear[b.code](c); }
check("thứ tự cố định khi vướng tất cả", seen.join() === order.join(), seen);

section("Ma trận quyền DELETE_ACCOUNTS");
check("admin_super có", checkPermission("admin_super", PERMISSIONS.DELETE_ACCOUNTS));
check("admin_content KHÔNG có (dù có MANAGE_TUTORS)", !checkPermission("admin_content", PERMISSIONS.DELETE_ACCOUNTS) && checkPermission("admin_content", PERMISSIONS.MANAGE_TUTORS));
check("teacher KHÔNG có", !checkPermission("teacher", PERMISSIONS.DELETE_ACCOUNTS));
check("không vai/null KHÔNG có", !checkPermission(null, PERMISSIONS.DELETE_ACCOUNTS) && !checkPermission(undefined, PERMISSIONS.DELETE_ACCOUNTS));
check("chỉ đúng 1 vai có quyền", (Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]).filter(r => ROLE_PERMISSIONS[r].includes(PERMISSIONS.DELETE_ACCOUNTS)).join() === "admin_super");
done();
