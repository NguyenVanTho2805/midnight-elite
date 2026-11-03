// TUT-002 — canSelfEnroll (src/lib/enrollEligibility.ts): bảng chân lý mục 3 đặc tả + hằng đúng từng chữ.
// Thuần, không DB, không máy chủ. Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-enroll-eligibility-lib.ts
//
// Ca phá (bẻ X thì ca Y đỏ):
//   - bẻ nhánh pending thành { ok: true }            → ca "pending → tutor_pending" đỏ
//   - bỏ kiểm `role !== "student"`                     → ca "admin → not_student" và "teacher/chuỗi lạ → not_student" đỏ
//   - đổi rejected sang chặn                           → ca "rejected → ok" đỏ
//   - đổi approved+student sang tutor_pending          → ca "approved nhưng role student → not_student" đỏ
//   - sửa một chữ trong ENROLL_TUTOR_PENDING_MESSAGE  → ca "hằng đúng từng chữ" đỏ
import {
  canSelfEnroll, ENROLL_NOT_STUDENT_MESSAGE, ENROLL_TUTOR_PENDING_MESSAGE,
  type SelfEnrollInput, type SelfEnrollVerdict,
} from "@/lib/enrollEligibility";
import { check, section, done } from "./h";

const D = new Date("2026-10-30T03:00:00Z");
const u = (o: Partial<SelfEnrollInput> = {}): SelfEnrollInput => ({
  role: "student", tutorAppliedAt: null, tutorVerified: false, tutorRejectedAt: null, ...o,
});
const eq = (a: SelfEnrollVerdict, b: SelfEnrollVerdict) => JSON.stringify(a) === JSON.stringify(b);
const OK: SelfEnrollVerdict = { ok: true };
const PENDING: SelfEnrollVerdict = { ok: false, reason: "tutor_pending" };
const NOT_STU: SelfEnrollVerdict = { ok: false, reason: "not_student" };

(async () => {
  section("Hằng chữ (UI học sinh hiện nguyên câu json.error)");
  check("hằng đúng từng chữ",
    ENROLL_TUTOR_PENDING_MESSAGE === "Hồ sơ gia sư của bạn đang chờ duyệt — chưa vào lớp với tư cách học sinh được",
    ENROLL_TUTOR_PENDING_MESSAGE);
  check("hằng not_student giữ chữ cũ của redeem/route.ts", ENROLL_NOT_STUDENT_MESSAGE === "Chỉ học viên mới redeem mã mời");

  section("Bảng chân lý — role student");
  check("học sinh thường (none) → ok", eq(canSelfEnroll(u()), OK));
  check("pending → tutor_pending (ca TUT-002)", eq(canSelfEnroll(u({ tutorAppliedAt: D })), PENDING), canSelfEnroll(u({ tutorAppliedAt: D })));
  check("rejected → ok (bị từ chối trở lại là học sinh)", eq(canSelfEnroll(u({ tutorAppliedAt: D, tutorRejectedAt: D })), OK));
  check("approved nhưng role student → not_student (lệch dữ liệu, không nói 'đang chờ duyệt')",
    eq(canSelfEnroll(u({ tutorAppliedAt: D, tutorVerified: true })), NOT_STU)
    && eq(canSelfEnroll(u({ tutorVerified: true })), NOT_STU)
    && eq(canSelfEnroll(u({ tutorAppliedAt: D, tutorVerified: true, tutorRejectedAt: D })), NOT_STU));
  check("lệch: tutorRejectedAt có nhưng tutorAppliedAt null → none → ok (khoá hành vi)",
    eq(canSelfEnroll(u({ tutorRejectedAt: D })), OK));

  section("Bảng chân lý — role khác student (giữ 403 cũ)");
  check("admin → not_student", eq(canSelfEnroll(u({ role: "admin" })), NOT_STU));
  check("admin đang pending vẫn là not_student (role kiểm trước)", eq(canSelfEnroll(u({ role: "admin", tutorAppliedAt: D })), NOT_STU));
  check("teacher/chuỗi lạ → not_student", eq(canSelfEnroll(u({ role: "teacher" })), NOT_STU) && eq(canSelfEnroll(u({ role: "" })), NOT_STU));

  section("Bất biến: thuần, không tác dụng phụ");
  const inp = u({ tutorAppliedAt: D });
  const before = JSON.stringify(inp);
  canSelfEnroll(inp); canSelfEnroll(inp);
  check("không sửa đối số, gọi hai lần cùng kết quả", JSON.stringify(inp) === before && eq(canSelfEnroll(inp), canSelfEnroll(inp)));

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
