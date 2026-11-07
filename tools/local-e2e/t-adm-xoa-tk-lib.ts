// ADM-xoa-tk (phần THUẦN, không DB) — ẩn danh hoá tài khoản + chặn 409 + ma trận quyền DELETE_ACCOUNTS.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-adm-xoa-tk-lib.ts
//
// CA PHÁ CỐ Ý (chạy tay, mỗi lần một thứ, rồi hoàn lại):
//   - Bỏ `phone: null` khỏi buildAnonymizedUserData → ca "không còn PII" đỏ.
//   - Đổi thứ tự hai dòng đầu của pickBlocker (active_enrollments / owned_courses_active) → ca "thứ tự cố định" đỏ.
//   - Thêm DELETE_ACCOUNTS vào ROLE_PERMISSIONS.admin_content → ca "ma trận quyền" đỏ.
//   - Đổi anonEmail thành "del+..." → ca "anonEmail" đỏ.
//   - Đổi chỗ unused_credit / bank_pending với pending_money trong pickBlocker → ca "thứ tự" đỏ.
//   - Bỏ DELETE_REASONS.includes ở readDeleteReason → ca "mã lạ" đỏ.
//   - Đổi chỗ co_teaching_active với open_invoices trong pickBlocker → ca "thứ tự" và ca co_teaching_active đỏ.
//   - Đổi `Array.from(given)[0]` trong shortNameOf thành cả tên → ca shortNameOf đỏ.
import { check, section, done } from "./h";
import { ANON_NAME, anonEmail, isAnonEmail, NOT_ANONYMIZED, buildAnonymizedUserData, pickBlocker, shortNameOf, readDeleteReason, DELETE_REASONS, type BlockerCounts } from "@/lib/accountDelete";
import { ROLE_PERMISSIONS, checkPermission, PERMISSIONS } from "@/lib/permissions";

const ZERO: BlockerCounts = { activeEnrollments: 0, ownedCoursesActive: 0, coTeachingActive: 0, openInvoices: 0, uninvoicedFees: 0, activePackages: 0, pendingTopups: 0, pendingProOrders: 0, walletBalance: 0, approvedTopups: 0, activeSubscriptions: 0, unusedCredits: 0, bankPending: 0 };
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
  ["active_enrollments", { activeEnrollments: 2 }], ["owned_courses_active", { ownedCoursesActive: 1 }], ["co_teaching_active", { coTeachingActive: 2 }], ["open_invoices", { openInvoices: 3 }], ["uninvoiced_fees", { uninvoicedFees: 4 }],
  ["unused_credit", { unusedCredits: 2 }], ["bank_pending", { bankPending: 3 }],
  ["active_packages", { activePackages: 1 }], ["pending_money", { pendingTopups: 1 }], ["pending_money", { pendingProOrders: 1 }],
  ["wallet_from_money", { walletBalance: 10, approvedTopups: 1 }], ["active_subscription", { activeSubscriptions: 1 }],
];
for (const [code, c] of one) { const b = pickBlocker({ ...ZERO, ...c }); check(`${code} (${JSON.stringify(c)}) → 409 + tiếng Việt`, b?.code === code && b.status === 409 && /[à-ỹ]/.test(b.error) && b.error.length > 20, b); }
check("co_teaching_active: extra.count + lời Việt, đứng ngay sau owned_courses_active, trước open_invoices", (() => { const b = pickBlocker({ ...ZERO, coTeachingActive: 2, openInvoices: 1 })!; const o = pickBlocker({ ...ZERO, coTeachingActive: 1, ownedCoursesActive: 1 })!; return b.code === "co_teaching_active" && b.extra?.count === 2 && /2 lớp đang đồng giảng/.test(b.error) && /Rời lớp/.test(b.error) && o.code === "owned_courses_active"; })());
check("số lượng nằm trong câu: 2 lớp / 3 phiếu", /2 lớp/.test(pickBlocker({ ...ZERO, activeEnrollments: 2 })!.error) && /3 phiếu/.test(pickBlocker({ ...ZERO, openInvoices: 3 })!.error));
check("ví có Coin nhưng chưa từng nạp tiền thật (thưởng đăng ký) → KHÔNG chặn", pickBlocker({ ...ZERO, walletBalance: 500, approvedTopups: 0 }) === null);
check("đã nạp tiền thật nhưng ví 0 → KHÔNG chặn", pickBlocker({ ...ZERO, walletBalance: 0, approvedTopups: 2 }) === null);
const c: BlockerCounts = { activeEnrollments: 1, ownedCoursesActive: 1, coTeachingActive: 1, openInvoices: 1, uninvoicedFees: 1, activePackages: 1, pendingTopups: 1, pendingProOrders: 1, walletBalance: 1, approvedTopups: 1, activeSubscriptions: 1, unusedCredits: 1, bankPending: 1 };
const order = ["active_enrollments", "owned_courses_active", "co_teaching_active", "open_invoices", "uninvoiced_fees", "unused_credit", "bank_pending", "active_packages", "pending_money", "wallet_from_money", "active_subscription"];
const clear: Record<string, (x: BlockerCounts) => void> = {
  active_enrollments: x => { x.activeEnrollments = 0; }, owned_courses_active: x => { x.ownedCoursesActive = 0; }, co_teaching_active: x => { x.coTeachingActive = 0; }, open_invoices: x => { x.openInvoices = 0; }, uninvoiced_fees: x => { x.uninvoicedFees = 0; },
  unused_credit: x => { x.unusedCredits = 0; }, bank_pending: x => { x.bankPending = 0; },
  active_packages: x => { x.activePackages = 0; }, pending_money: x => { x.pendingTopups = 0; x.pendingProOrders = 0; }, wallet_from_money: x => { x.walletBalance = 0; }, active_subscription: x => { x.activeSubscriptions = 0; },
};
const seen: string[] = [];
for (let b = pickBlocker(c); b && seen.length < 20; b = pickBlocker(c)) { seen.push(b.code); clear[b.code](c); }
check("thứ tự cố định khi vướng tất cả", seen.join() === order.join(), seen);

check("unused_credit / bank_pending: mã, số lượng trong câu", (() => { const a = pickBlocker({ ...ZERO, unusedCredits: 2 })!, b = pickBlocker({ ...ZERO, bankPending: 3 })!; return a.code === "unused_credit" && /2 khoản/.test(a.error) && b.code === "bank_pending" && /3 khoản/.test(b.error); })());
check("bank_pending đứng sau unused_credit, trước wallet_from_money", pickBlocker({ ...ZERO, unusedCredits: 1, bankPending: 1, walletBalance: 5, approvedTopups: 1 })!.code === "unused_credit" && pickBlocker({ ...ZERO, bankPending: 1, walletBalance: 5, approvedTopups: 1 })!.code === "bank_pending");

section("shortNameOf");
check("'Nguyễn Văn Tuấn' → 'Nguyễn T.'", shortNameOf("Nguyễn Văn Tuấn") === "Nguyễn T.");
check("hai từ / chữ thường đầu tên / khoảng trắng thừa", shortNameOf("Lê  an") === "Lê A." && shortNameOf("  Trần   Đức  ") === "Trần Đ.");
check("một từ giữ nguyên; rỗng → 'Học sinh'", shortNameOf("Bi") === "Bi" && shortNameOf("   ") === "Học sinh" && shortNameOf("") === "Học sinh");
check("không lộ tên đệm / tên đầy đủ", !/Văn|Tuấn/.test(shortNameOf("Nguyễn Văn Tuấn")));

(async () => {
section("readDeleteReason");
const rq = (b?: string) => new Request("http://x/", { method: "POST", body: b });
check("DELETE_REASONS đúng 5 mã", DELETE_REASONS.join() === "user_request,duplicate,spam_or_abuse,wrong_account,other");
for (const m of DELETE_REASONS) { const r = await readDeleteReason(rq(JSON.stringify({ reason: m }))); check(`mã hợp lệ ${m}`, "reason" in r && r.reason === m, r); }
for (const [name, b] of [["không body", undefined], ["body rỗng", "  "], ["JSON hỏng", "{x"], ["reason thiếu", "{}"], ["reason null", '{"reason":null}'], ["reason rỗng", '{"reason":""}']] as const) {
  const r = await readDeleteReason(rq(b)); check(`${name} → reason null`, "reason" in r && r.reason === null, r);
}
for (const b of ['{"reason":"hack"}', '{"reason":"OTHER"}', '{"reason":5}', '{"reason":["other"]}', '{"reason":" other"}', '{"reason":"user_request; drop"}']) {
  const r = await readDeleteReason(rq(b)); check(`mã lạ ${b} → error`, "error" in r && /[à-ỹ]/.test(r.error), r);
}

section("Ma trận quyền DELETE_ACCOUNTS");
check("admin_super có", checkPermission("admin_super", PERMISSIONS.DELETE_ACCOUNTS));
check("admin_content KHÔNG có (dù có MANAGE_TUTORS)", !checkPermission("admin_content", PERMISSIONS.DELETE_ACCOUNTS) && checkPermission("admin_content", PERMISSIONS.MANAGE_TUTORS));
check("teacher KHÔNG có", !checkPermission("teacher", PERMISSIONS.DELETE_ACCOUNTS));
check("không vai/null KHÔNG có", !checkPermission(null, PERMISSIONS.DELETE_ACCOUNTS) && !checkPermission(undefined, PERMISSIONS.DELETE_ACCOUNTS));
check("chỉ đúng 1 vai có quyền", (Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]).filter(r => ROLE_PERMISSIONS[r].includes(PERMISSIONS.DELETE_ACCOUNTS)).join() === "admin_super");
done();
})().catch(e => { console.error(e); process.exit(1); });
