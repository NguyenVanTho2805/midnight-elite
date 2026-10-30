// BU-00 bước 4–5 (31/10/2026) — cổng gia sư THUẦN (src/lib/tutorGate.ts): vỏ nào cho ai dưới /lop-cua-toi (tutorShellKind), trang chỉ-gia-sư đẩy ai đi đâu
// (tutorGateTarget), AuthGuard đẩy ai khỏi khu học sinh (studentAreaRedirect); cộng vỏ ở trang khách (shellFor / parseShellHint, src/lib/signedInShell.ts).
// Ca phá cố ý ở cuối: giả lập bản mã CŨ (mọi role admin vào /student/*, pending rơi vào danh sách lớp) phải ĐỎ đúng ca.
import { tutorShellKind, tutorGateTarget, studentAreaRedirect, isApplicant, TUTOR_PENDING_PATH, TUTOR_HOME } from "@/lib/tutorGate";
import { shellFor, parseShellHint, shellHintFor, SHELL_INIT_SCRIPT } from "@/lib/signedInShell";
import { check, section, done } from "./h";

const T = { role: "admin", adminRole: "teacher" };
const SA = { role: "admin", adminRole: "admin_super" };
const CA = { role: "admin", adminRole: "admin_content" };
const A0 = { role: "admin", adminRole: null };
const S = { role: "student", adminRole: null };

section("tutorShellKind — vỏ dưới /lop-cua-toi");
check("gia sư → tutor (trạng thái đơn truyền gì cũng bỏ qua)", tutorShellKind(T, "none") === "tutor" && tutorShellKind(T, "pending") === "tutor");
check("học sinh có đơn đang chờ → tutor-pending", tutorShellKind(S, "pending") === "tutor-pending");
check("học sinh thường (none) → student; bị từ chối → student (họ là học sinh thường, vẫn tự mở được trang chờ duyệt để đọc lý do)", tutorShellKind(S, "none") === "student" && tutorShellKind(S, "rejected") === "student" && tutorShellKind(S, undefined) === "student");
check("quản trị cấp 1 / nội dung / admin thiếu adminRole → admin-preview (vỏ học sinh có băng xem thử)", tutorShellKind(SA) === "admin-preview" && tutorShellKind(CA) === "admin-preview" && tutorShellKind(A0) === "admin-preview");
check("khách → null", tutorShellKind(null) === null);
check("isApplicant: chỉ 'pending' (approved đã là teacher; rejected = học sinh thường)", isApplicant("pending") && !isApplicant("rejected") && !isApplicant("approved") && !isApplicant("none") && !isApplicant(null));

section("tutorGateTarget — trang chỉ-gia-sư (null = cho vào)");
const P = { path: "/lop-cua-toi/lop" };
check("gia sư vào được", tutorGateTarget(T, "none", P) === null);
check("khách → /dang-nhap?redirect=<đúng trang, đã mã hoá>", tutorGateTarget(null, "none", { path: "/lop-cua-toi/buoi/abc/2026-11-01?x=1" }) === `/dang-nhap?redirect=${encodeURIComponent("/lop-cua-toi/buoi/abc/2026-11-01?x=1")}`);
check("gia sư chờ duyệt → trang chờ duyệt (không rơi vào danh sách lớp của học sinh)", tutorGateTarget(S, "pending", P) === TUTOR_PENDING_PATH);
check("gia sư chờ duyệt vào được trang có allowPending (Liên hệ hỗ trợ)", tutorGateTarget(S, "pending", { ...P, allowPending: true }) === null);
check("học sinh thường → /lop-cua-toi (mặc định) hoặc studentTo của trang (/student/hoc-phi)", tutorGateTarget(S, "none", P) === TUTOR_HOME && tutorGateTarget(S, "none", { ...P, studentTo: "/student/hoc-phi" }) === "/student/hoc-phi");
check("học sinh bị từ chối → như học sinh thường (allowPending không mở cho họ)", tutorGateTarget(S, "rejected", P) === TUTOR_HOME && tutorGateTarget(S, "rejected", { ...P, allowPending: true }) === TUTOR_HOME);
check("quản trị → /lop-cua-toi (mặc định) hoặc adminTo (/admin ở nhóm nội dung)", tutorGateTarget(SA, "none", P) === TUTOR_HOME && tutorGateTarget(CA, "none", { ...P, adminTo: "/admin" }) === "/admin" && tutorGateTarget(A0, "none", P) === TUTOR_HOME);

section("studentAreaRedirect — AuthGuard (null = cho qua)");
const V = "/student/viec-cua-toi", CD = "/cai-dat/chu-de";
check("học sinh thường vào /student/* và /cai-dat/chu-de", studentAreaRedirect(S, "student", V) === null && studentAreaRedirect(S, "student", CD) === null);
check("gia sư chờ duyệt: /student/* → trang chờ duyệt; /cai-dat/chu-de (trang dùng chung) vẫn vào", studentAreaRedirect({ ...S, tutorPending: true }, "student", V) === TUTOR_PENDING_PATH && studentAreaRedirect({ ...S, tutorPending: true }, "student", "/student") === TUTOR_PENDING_PATH && studentAreaRedirect({ ...S, tutorPending: true }, "student", CD) === null);
check("gia sư: /student/* → Hộp việc; /cai-dat/chu-de vẫn vào (bấm 'Chủ đề màu' từ vỏ gia sư)", studentAreaRedirect(T, "student", V) === TUTOR_HOME && studentAreaRedirect(T, "student", CD) === null);
check("quản trị cấp 1 / nội dung xem thử được /student/*", studentAreaRedirect(SA, "student", V) === null && studentAreaRedirect(CA, "student", V) === null);
check("role admin thiếu adminRole → /admin (không đoán)", studentAreaRedirect(A0, "student", V) === "/admin");
check("'/students-khac' KHÔNG phải khu học sinh (so theo đoạn đường, không theo tiền tố chuỗi)", studentAreaRedirect(T, "student", "/students-khac") === null && studentAreaRedirect({ ...S, tutorPending: true }, "student", "/studentx") === null);
check("requiredRole admin: học sinh → Việc của tôi; admin các loại qua", studentAreaRedirect(S, "admin", "/admin") === V && studentAreaRedirect(T, "admin", "/admin") === null && studentAreaRedirect(SA, "admin", "/admin") === null);
check("không requiredRole → ai cũng qua", studentAreaRedirect(S, null, V) === null && studentAreaRedirect(T, undefined, V) === null);

section("shellFor / parseShellHint — vỏ ở trang khách (src/lib/signedInShell.ts)");
check("học sinh + tutorPending → tutor-pending; học sinh thường → student; gia sư → tutor; quản trị → student (xem thử)", shellFor({ ...S, tutorPending: true }, "/thu-vien") === "tutor-pending" && shellFor(S, "/thu-vien") === "student" && shellFor(T, "/thu-vien") === "tutor" && shellFor(SA, "/thu-vien") === "student");
check("trang xác thực không vỏ dù là gia sư chờ duyệt", shellFor({ ...S, tutorPending: true }, "/dang-nhap") === null && shellFor({ ...S, tutorPending: true }, "/xac-thuc-email") === null);
check("gợi ý vỏ nhớ 'tutor-pending'; giá trị lạ → null", shellHintFor({ ...S, tutorPending: true }) === "tutor-pending" && parseShellHint("tutor-pending") === "tutor-pending" && parseShellHint("student") === "student" && parseShellHint("tutor") === "tutor" && parseShellHint("admin") === null && parseShellHint(1) === null && parseShellHint(null) === null);
check("SHELL_INIT_SCRIPT chấp nhận tutor-pending, một dòng, không chứa '</script'", SHELL_INIT_SCRIPT.includes("tutor-pending") && !SHELL_INIT_SCRIPT.includes("\n") && !SHELL_INIT_SCRIPT.includes("</script"));

section("Ca phá cố ý — bản mã CŨ phải đỏ");
// Bản cũ của AuthGuard: `adminViewingStudent = requiredRole === "student" && user.role === "admin"` → gia sư vào /student/* được.
const oldAuthGuard = (u: { role: string; adminRole?: string | null }) => (u.role === "admin" ? null : null);
check("(phá) bản cũ cho gia sư vào /student/* — ca 'gia sư → Hộp việc' phải bắt được", oldAuthGuard(T) !== studentAreaRedirect(T, "student", V));
// Bản cũ của trang gia sư: `if (role !== "admin" || adminRole !== "teacher") redirect("/lop-cua-toi")` → pending rơi vào danh sách lớp.
const oldGate = (s: { role: string; adminRole?: string | null }) => (s.role === "admin" && s.adminRole === "teacher" ? null : TUTOR_HOME);
check("(phá) bản cũ đẩy gia sư chờ duyệt về danh sách lớp — ca 'pending → trang chờ duyệt' phải bắt được", oldGate(S) !== tutorGateTarget(S, "pending", P));
done();
