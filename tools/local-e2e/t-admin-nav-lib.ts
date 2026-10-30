// BU-00 bước 2 (25/10/2026) — bản đồ điều hướng vỏ quản trị (src/lib/adminNav.ts), phần THUẦN: không DB, không mạng.
// Gia sư (teacher) KHÔNG còn thấy module quản trị nào; quản trị cấp 1 thấy đủ; quản trị nội dung không thấy trang cần MANAGE_ADMINS / MANAGE_REVENUE.
// Ca phá cố ý: bỏ dòng `if (role === "teacher") return [];` trong visibleModules → 3 ca "teacher" đầu đỏ (gia sư lại thấy Kiểm duyệt, Nội dung, Báo cáo);
// đổi `return []` thành `return visibleModules("admin_content")` → ca "teacher không thấy Khoá học / Đề thi" đỏ.
import { ADMIN_MODULES, visibleModules } from "@/lib/adminNav";
import { PERMISSIONS, ROLE_PERMISSIONS, checkPermission, type AdminRole, type Permission } from "@/lib/permissions";
import { check, section, done } from "./h";

const hrefsOf = (r: AdminRole | null | undefined) => visibleModules(r).flatMap(m => m.subs.map(s => s.href));
const needs = (p: Permission) => ADMIN_MODULES.flatMap(m => m.subs).filter(s => s.permission === p).map(s => s.href);

section("Gia sư (teacher): không dùng vỏ quản trị");
check("visibleModules('teacher') → [] (không module nào)", visibleModules("teacher").length === 0, visibleModules("teacher").map(m => m.key));
check("teacher không thấy cả trang không đòi quyền (Hàng chờ, Tổng quan) — vì cả vỏ quản trị không dành cho gia sư", !hrefsOf("teacher").includes("/admin/kiem-duyet") && !hrefsOf("teacher").includes("/admin"));
check("teacher không thấy Khoá học / Đề thi dù permissions.ts vẫn cho MANAGE_COURSES + MANAGE_CURRICULUM (quyền API giữ, chỉ bỏ lối vào)",
  !hrefsOf("teacher").includes("/admin/khoa-hoc") && !hrefsOf("teacher").includes("/admin/thi-thu")
  && checkPermission("teacher", PERMISSIONS.MANAGE_COURSES) && checkPermission("teacher", PERMISSIONS.MANAGE_CURRICULUM));
check("permissions.ts KHÔNG bị đụng: teacher vẫn đúng 2 quyền MANAGE_COURSES + MANAGE_CURRICULUM", ROLE_PERMISSIONS.teacher.length === 2 && ROLE_PERMISSIONS.teacher.includes(PERMISSIONS.MANAGE_COURSES) && ROLE_PERMISSIONS.teacher.includes(PERMISSIONS.MANAGE_CURRICULUM), ROLE_PERMISSIONS.teacher);

section("Quản trị cấp 1 (admin_super): đủ mọi module");
const sup = visibleModules("admin_super");
check(`admin_super thấy đủ ${ADMIN_MODULES.length} module (hiện có 5: Kiểm duyệt · Người dùng · Nội dung · Báo cáo · Cài đặt)`, sup.length === ADMIN_MODULES.length && ADMIN_MODULES.length === 5 && sup.map(m => m.key).join("|") === ADMIN_MODULES.map(m => m.key).join("|"), sup.map(m => m.key));
check("admin_super thấy đủ mọi trang con (không trang nào bị lọc)", sup.flatMap(m => m.subs).length === ADMIN_MODULES.flatMap(m => m.subs).length);
check("đường vào module = trang con đầu tiên (Người dùng → /admin/hoc-sinh; Báo cáo → /admin)", sup.find(m => m.key === "nguoi-dung")?.href === "/admin/hoc-sinh" && sup.find(m => m.key === "bao-cao")?.href === "/admin");

section("Quản trị nội dung (admin_content): không có trang cần MANAGE_ADMINS / MANAGE_REVENUE");
const content = hrefsOf("admin_content");
const adminsOnly = needs(PERMISSIONS.MANAGE_ADMINS), revenueOnly = needs(PERMISSIONS.MANAGE_REVENUE);
check(`bản đồ có trang cần MANAGE_ADMINS (${adminsOnly.length}) và MANAGE_REVENUE (${revenueOnly.length}) để ca dưới có nghĩa`, adminsOnly.length > 0 && revenueOnly.length > 0, { adminsOnly, revenueOnly });
check("admin_content KHÔNG thấy trang cần MANAGE_ADMINS (Quản trị viên, Nhật ký)", adminsOnly.every(h => !content.includes(h)), adminsOnly.filter(h => content.includes(h)));
check("admin_content KHÔNG thấy trang cần MANAGE_REVENUE (Gói KiN Pro, Triển khai và hạn mức, Duyệt nạp Coin)", revenueOnly.every(h => !content.includes(h)), revenueOnly.filter(h => content.includes(h)));
check("admin_content KHÔNG thấy Doanh thu (VIEW_REVENUE) nhưng vẫn thấy Khoá học, Đề thi, Tin tức, Hàng chờ", !content.includes("/admin/doanh-thu") && ["/admin/khoa-hoc", "/admin/thi-thu", "/admin/tin-tuc", "/admin/kiem-duyet"].every(h => content.includes(h)));
check("module không còn trang con thì ẩn cả module: admin_content không có 'Người dùng'", !visibleModules("admin_content").some(m => m.key === "nguoi-dung"));
check("mọi trang admin_content thấy đều đúng quyền của vai đó (không lọt trang ngoài quyền)", ADMIN_MODULES.flatMap(m => m.subs).filter(s => content.includes(s.href)).every(s => !s.permission || checkPermission("admin_content", s.permission)));

section("Chưa biết vai");
check("null / undefined → chỉ trang không đòi quyền (Hàng chờ, Tổng quan)", JSON.stringify(hrefsOf(null)) === JSON.stringify(["/admin/kiem-duyet", "/admin"]) && JSON.stringify(hrefsOf(undefined)) === JSON.stringify(["/admin/kiem-duyet", "/admin"]), hrefsOf(null));

done();
