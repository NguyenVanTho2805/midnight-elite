// Đăng nhập xong đi đâu (src/lib/landing.ts): học sinh → Việc của tôi, gia sư → Hộp việc, quản trị → /admin.
import { landingPath } from "@/lib/landing";
import { check, section, done } from "./h";

section("landingPath");
check("học sinh → /student/viec-cua-toi", landingPath("student") === "/student/viec-cua-toi" && landingPath("student", null) === "/student/viec-cua-toi");
check("gia sư (role admin + adminRole teacher) → /lop-cua-toi, KHÔNG vào bảng quản trị", landingPath("admin", "teacher") === "/lop-cua-toi");
check("quản trị cấp 1 và quản trị nội dung → /admin", landingPath("admin", "admin_super") === "/admin" && landingPath("admin", "admin_content") === "/admin");
check("role admin thiếu adminRole → /admin (mặc định an toàn, không đoán là gia sư)", landingPath("admin") === "/admin" && landingPath("admin", null) === "/admin");
check("vai lạ → coi như học sinh (không văng lỗi)", landingPath("khac") === "/student/viec-cua-toi");
done();
