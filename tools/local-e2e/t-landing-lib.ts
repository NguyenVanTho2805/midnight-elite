// Đăng nhập xong đi đâu (src/lib/landing.ts): học sinh → Việc của tôi, gia sư → Hộp việc, gia sư CHỜ DUYỆT → trang chờ duyệt (BU-00 bước 5), quản trị → /admin.
import { landingPath } from "@/lib/landing";
import { check, section, done } from "./h";

section("landingPath");
check("học sinh → /student/viec-cua-toi", landingPath("student") === "/student/viec-cua-toi" && landingPath("student", null) === "/student/viec-cua-toi");
check("học sinh thường (tutorPending=false tường minh) → /student/viec-cua-toi", landingPath("student", null, false) === "/student/viec-cua-toi");
check("gia sư (role admin + adminRole teacher) → /lop-cua-toi, KHÔNG vào bảng quản trị", landingPath("admin", "teacher") === "/lop-cua-toi");
check("quản trị cấp 1 và quản trị nội dung → /admin", landingPath("admin", "admin_super") === "/admin" && landingPath("admin", "admin_content") === "/admin");
check("role admin thiếu adminRole → /admin (mặc định an toàn, không đoán là gia sư)", landingPath("admin") === "/admin" && landingPath("admin", null) === "/admin");
check("vai lạ → coi như học sinh (không văng lỗi)", landingPath("khac") === "/student/viec-cua-toi");

section("BU-00 bước 5: gia sư chờ duyệt (vẫn là role student, cờ tutorPending do API tính)");
check("student + tutorPending → /lop-cua-toi/cho-duyet", landingPath("student", null, true) === "/lop-cua-toi/cho-duyet" && landingPath("student", undefined, true) === "/lop-cua-toi/cho-duyet");
check("tutorPending KHÔNG đổi đích của gia sư đã duyệt (cờ thừa bị bỏ qua)", landingPath("admin", "teacher", true) === "/lop-cua-toi");
check("tutorPending KHÔNG đổi đích của quản trị", landingPath("admin", "admin_super", true) === "/admin" && landingPath("admin", "admin_content", true) === "/admin");
check("vai lạ + tutorPending → vẫn Việc của tôi (chỉ role student mới có đơn gia sư)", landingPath("khac", null, true) === "/student/viec-cua-toi");
done();
