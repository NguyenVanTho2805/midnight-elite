// HOCPHI-THEO-BUOI 3.2 — bài THUẦN cho src/lib/feeRuleAudit.ts (metadata audit + nội dung thông báo ghi đè). Có ca phá. Không DB, không mạng.
import { FEE_OVERRIDE_TYPE, buildFeeAuditMetadata, buildFeeOverrideNotification, feeAuditAction, feeOverrideLink, feeRuleRole, isFeeOverride } from "@/lib/feeRuleAudit";
import { check, section, done } from "./h";

(async () => {
section("isFeeOverride");
check("chủ lớp tự đổi → không phải ghi đè", isFeeOverride("u1", "u1") === false);
check("quản trị (khác chủ) → ghi đè", isFeeOverride("adm", "u1") === true);
check("[phá] lớp không chủ (trung tâm) → không có ai để báo, không phải ghi đè", isFeeOverride("adm", null) === false && isFeeOverride("adm", undefined) === false && isFeeOverride("adm", "") === false);

section("feeRuleRole");
check("3 vai hợp lệ giữ nguyên", feeRuleRole("teacher") === "teacher" && feeRuleRole("admin_super") === "admin_super" && feeRuleRole("admin_content") === "admin_content");
check("[phá] vai lạ / null / undefined → unknown (không bịa)", feeRuleRole("root") === "unknown" && feeRuleRole(null) === "unknown" && feeRuleRole(undefined) === "unknown");

section("buildFeeAuditMetadata");
const cls = buildFeeAuditMetadata({ type: "class", actorId: "adm", adminRole: "admin_super", ownerId: "t1", effectiveFrom: "2026-11-10", rate: 160_000, sessionMinutes: null, previousRate: 150_000, repriced: 3, delta: 30_000, frozen: 2 });
check("ghi đè: override true + byRole + ownerId + previousRate + preview false", cls.override === true && cls.byRole === "admin_super" && cls.ownerId === "t1" && cls.previousRate === 150_000 && cls.preview === false, cls);
check("giữ các khoá cũ để bài cũ còn khớp", cls.effectiveFrom === "2026-11-10" && cls.rate === 160_000 && cls.repriced === 3 && cls.delta === 30_000 && cls.frozen === 2 && "sessionMinutes" in cls && !("studentId" in cls));
const own = buildFeeAuditMetadata({ type: "class", actorId: "t1", adminRole: "teacher", ownerId: "t1", effectiveFrom: "2026-11-10", rate: 150_000, previousRate: null, repriced: 0, delta: 0, frozen: 0 });
check("chủ lớp tự đổi: override false, byRole teacher, previousRate null", own.override === false && own.byRole === "teacher" && own.previousRate === null);
const stu = buildFeeAuditMetadata({ type: "student", actorId: "adm", adminRole: "admin_content", ownerId: "t1", effectiveFrom: "2026-11-10", rate: null, studentId: "s9", previousRate: 120_000, repriced: 1, delta: -5_000, frozen: 0 });
check("đơn giá riêng: có studentId (chỉ ID, không tên), rate null được, không có sessionMinutes", stu.studentId === "s9" && stu.rate === null && !("sessionMinutes" in stu) && stu.override === true && stu.byRole === "admin_content");
check("metadata chỉ gồm chuỗi / số / boolean / null (ghi JSON được)", Object.values(cls).every(v => v === null || ["string", "number", "boolean"].includes(typeof v)));
check("tên action cũ giữ nguyên", feeAuditAction("class") === "course_fee.set_rate" && feeAuditAction("student") === "course_fee.set_student_rate");

section("buildFeeOverrideNotification");
const n = buildFeeOverrideNotification("toan-9-abc");
check("loại course_fee_override, liên kết tab Học phí của lớp", n.type === FEE_OVERRIDE_TYPE && n.type === "course_fee_override" && n.link === "/lop-cua-toi/toan-9-abc?tab=hoc-phi", n);
check("[phá] tiêu đề + nội dung KHÔNG có chữ số nào (không tiền, không ngày, không số lớp)", !/\d/.test(n.title) && !/\d/.test(n.message), n);
check("[phá] không nêu tên lớp / tên em dù id lớp có chữ", !n.title.includes("toan") && !n.message.includes("toan") && !/đ\b/.test(n.message));
check("[phá] hai id khác nhau → chữ y hệt, chỉ khác liên kết (chữ dựng từ loại, không từ dữ liệu)", (() => { const m = buildFeeOverrideNotification("lop-khac"); return m.title === n.title && m.message === n.message && m.link !== n.link; })());
check("id có ký tự lạ được mã hoá trong liên kết", feeOverrideLink("a b/c") === "/lop-cua-toi/a%20b%2Fc?tab=hoc-phi");
check("liên kết đi đường gia sư, không phải /admin", !n.link.startsWith("/admin"));

await done();
})();
