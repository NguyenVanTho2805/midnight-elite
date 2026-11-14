// Đăng nhập xong đi đâu (src/lib/landing.ts): học sinh → Việc của tôi, gia sư → Hộp việc, gia sư CHỜ DUYỆT → trang chờ duyệt (BU-00 bước 5), quản trị → /admin.
import { landingPath } from "@/lib/landing";
import { check, section, done } from "./h";

section("landingPath");
check("học sinh → /student/viec-cua-toi", landingPath("student") === "/student/viec-cua-toi" && landingPath("student", null) === "/student/viec-cua-toi");
check("học sinh thường (tutorPending=false tường minh) → /student/viec-cua-toi", landingPath("student", null, false) === "/student/viec-cua-toi");
// DG (14/11/2026): ĐỔI CÓ CHỦ ĐÍCH — đích của gia sư theo cờ HOP_VIEC: tắt (mặc định) → thư viện Lớp /lop-cua-toi/lop; =1 → Hộp việc /lop-cua-toi như cũ.
const TUTOR_HOME = process.env.NEXT_PUBLIC_KIN_MO_HOP_VIEC === "1" ? "/lop-cua-toi" : "/lop-cua-toi/lop";
check(`gia sư (role admin + adminRole teacher) → ${TUTOR_HOME}, KHÔNG vào bảng quản trị`, landingPath("admin", "teacher") === TUTOR_HOME);
{
  const prev = process.env.NEXT_PUBLIC_KIN_MO_HOP_VIEC;
  delete process.env.NEXT_PUBLIC_KIN_MO_HOP_VIEC;
  const off = landingPath("admin", "teacher");
  process.env.NEXT_PUBLIC_KIN_MO_HOP_VIEC = "1";
  const on = landingPath("admin", "teacher");
  if (prev === undefined) delete process.env.NEXT_PUBLIC_KIN_MO_HOP_VIEC; else process.env.NEXT_PUBLIC_KIN_MO_HOP_VIEC = prev;
  check("DG: HOP_VIEC tắt → /lop-cua-toi/lop; HOP_VIEC=1 → /lop-cua-toi (quản trị / học sinh không đổi)", off === "/lop-cua-toi/lop" && on === "/lop-cua-toi" && landingPath("admin", "admin_super") === "/admin" && landingPath("student") === "/student/viec-cua-toi", { off, on });
}
check("quản trị cấp 1 và quản trị nội dung → /admin", landingPath("admin", "admin_super") === "/admin" && landingPath("admin", "admin_content") === "/admin");
check("role admin thiếu adminRole → /admin (mặc định an toàn, không đoán là gia sư)", landingPath("admin") === "/admin" && landingPath("admin", null) === "/admin");
check("vai lạ → coi như học sinh (không văng lỗi)", landingPath("khac") === "/student/viec-cua-toi");

section("BU-00 bước 5: gia sư chờ duyệt (vẫn là role student, cờ tutorPending do API tính)");
check("student + tutorPending → /lop-cua-toi/cho-duyet", landingPath("student", null, true) === "/lop-cua-toi/cho-duyet" && landingPath("student", undefined, true) === "/lop-cua-toi/cho-duyet");
check("tutorPending KHÔNG đổi đích của gia sư đã duyệt (cờ thừa bị bỏ qua)", landingPath("admin", "teacher", true) === TUTOR_HOME);
check("tutorPending KHÔNG đổi đích của quản trị", landingPath("admin", "admin_super", true) === "/admin" && landingPath("admin", "admin_content", true) === "/admin");
check("vai lạ + tutorPending → vẫn Việc của tôi (chỉ role student mới có đơn gia sư)", landingPath("khac", null, true) === "/student/viec-cua-toi");
done();
