// BU-08 (02/11/2026) — bản đồ điều hướng vỏ quản trị (src/lib/adminNav.ts), phần THUẦN: không DB, không mạng.
// BỐN module (Việc chờ · Con người · Học vụ · Vận hành). Gia sư (teacher) KHÔNG thấy module nào; quản trị cấp 1 thấy hết;
// quản trị nội dung không thấy Quản trị viên, Nhật ký, Doanh thu, Triển khai, Gói Pro, Lịch sử nạp Coin, Học sinh.
// Ca phá cố ý: (1) bỏ dòng `if (role === "teacher") return [];` trong visibleModules → các ca "teacher" đỏ;
// (2) gỡ `permission` khỏi "Lịch sử nạp Coin" → ca "admin_content không thấy Lịch sử nạp Coin" đỏ;
// (3) thêm một module thứ năm → ca "đúng 4 module" đỏ.
import { ADMIN_MODULES, groupSubs, matchSub, visibleModules } from "@/lib/adminNav";
import { PERMISSIONS, ROLE_PERMISSIONS, checkPermission, type AdminRole, type Permission } from "@/lib/permissions";
import { check, section, done } from "./h";
import { COIN_VISIBLE, FEATURES, type FeatureEnv } from "@/lib/features";
// LOI-01 (11/11/2026): trang con của phần đang ẩn (Tin tức, Video tham khảo, Cộng đồng, Vinh danh, Điểm chuẩn) rút khỏi menu theo cờ src/lib/features.ts. Các ca dưới
// kiểm phân quyền KHI CÁC PHẦN ĐANG MỞ (FE = cả 9 cờ =1, Coin vẫn theo COIN_VISIBLE như cũ); khi tắt: ca "LOI-01" cuối tệp và t-features-lib.ts.
const FE: FeatureEnv = Object.fromEntries(FEATURES.map(k => [k, "1"])) as FeatureEnv;

const hrefsOf = (r: AdminRole | null | undefined) => visibleModules(r, FE).flatMap(m => m.subs.map(s => s.href));
const needs = (p: Permission) => ADMIN_MODULES.flatMap(m => m.subs).filter(s => s.permission === p).map(s => s.href);
const allSubs = ADMIN_MODULES.flatMap(m => m.subs);

section("Cấu trúc: đúng bốn module");
check("đúng 4 module, đúng thứ tự: viec-cho · con-nguoi · hoc-vu · van-hanh", ADMIN_MODULES.map(m => m.key).join("|") === "viec-cho|con-nguoi|hoc-vu|van-hanh", ADMIN_MODULES.map(m => m.key));
check("nhãn module tiếng Việt: Việc chờ · Con người · Học vụ · Vận hành", ADMIN_MODULES.map(m => m.label).join("|") === "Việc chờ|Con người|Học vụ|Vận hành");
check("không trùng href giữa các trang con", new Set(allSubs.map(s => s.href)).size === allSubs.length);
check("không trùng khoá module", new Set(ADMIN_MODULES.map(m => m.key)).size === ADMIN_MODULES.length);
const overGroup: string[] = [];
for (const m of ADMIN_MODULES) for (const g of groupSubs(m.subs)) if (g.subs.length > 6) overGroup.push(`${m.key}/${g.group}:${g.subs.length}`);
check("mỗi nhóm trong module ≤ 6 tab (dải tab của vỏ)", overGroup.length === 0, overGroup);
check("module không có `group` thì cả module ≤ 6 trang con", ADMIN_MODULES.filter(m => m.subs.every(s => !s.group)).every(m => m.subs.length <= 6));
check("Hàng chờ nằm ở module Việc chờ; Hôm nay (/admin) KHÔNG còn là trang con của module nào nhưng matchSub gán cho Việc chờ; Gia sư (lịch sử) ở Con người", matchSub("/admin/kiem-duyet")?.moduleKey === "viec-cho" && matchSub("/admin")?.moduleKey === "viec-cho" && !allSubs.some(s => s.href === "/admin") && matchSub("/admin/gia-su")?.moduleKey === "con-nguoi");
check("hai đường đã gỡ không còn là trang con riêng (đã 308)", !allSubs.some(s => s.href === "/admin/ho-so-gia-su" || s.href === "/admin/cong-dong/bao-cao"));
check("groupSubs giữ thứ tự xuất hiện và gom đúng: Học vụ có 4 nhóm", groupSubs(ADMIN_MODULES[2].subs).map(g => g.group).join("|") === "Lớp|Đề và ngân hàng|Truyền thông|Tuyển sinh", groupSubs(ADMIN_MODULES[2].subs).map(g => g.group));

section("Gia sư (teacher): không dùng vỏ quản trị");
check("visibleModules('teacher') → [] (không module nào)", visibleModules("teacher", FE).length === 0, visibleModules("teacher", FE).map(m => m.key));
check("teacher không thấy trang không đòi quyền (Hàng chờ) và không có lối vào Hôm nay", !hrefsOf("teacher").includes("/admin/kiem-duyet") && !hrefsOf("teacher").includes("/admin"));
check("teacher không thấy Lớp / Đề thi dù permissions.ts vẫn cho MANAGE_COURSES + MANAGE_CURRICULUM (quyền API giữ, chỉ bỏ lối vào)",
  !hrefsOf("teacher").includes("/admin/khoa-hoc") && !hrefsOf("teacher").includes("/admin/thi-thu")
  && checkPermission("teacher", PERMISSIONS.MANAGE_COURSES) && checkPermission("teacher", PERMISSIONS.MANAGE_CURRICULUM));
check("permissions.ts KHÔNG bị đụng: teacher vẫn đúng 2 quyền MANAGE_COURSES + MANAGE_CURRICULUM", ROLE_PERMISSIONS.teacher.length === 2 && ROLE_PERMISSIONS.teacher.includes(PERMISSIONS.MANAGE_COURSES) && ROLE_PERMISSIONS.teacher.includes(PERMISSIONS.MANAGE_CURRICULUM), ROLE_PERMISSIONS.teacher);

section("Quản trị cấp 1 (admin_super): đủ mọi module");
const sup = visibleModules("admin_super", FE);
check("admin_super thấy đủ 4 module theo đúng thứ tự", sup.length === 4 && sup.map(m => m.key).join("|") === ADMIN_MODULES.map(m => m.key).join("|"), sup.map(m => m.key));
check("admin_super thấy đủ mọi trang con (không trang nào bị lọc)", sup.flatMap(m => m.subs).length === allSubs.length);
check("lối vào module = trang con đầu tiên được phép (Con người → /admin/gia-su; Vận hành → /admin/doanh-thu, không còn /admin vì Hôm nay chỉ vào bằng logo)", sup.find(m => m.key === "con-nguoi")?.href === "/admin/gia-su" && sup.find(m => m.key === "van-hanh")?.href === "/admin/doanh-thu");

section("Quản trị nội dung (admin_content)");
const content = hrefsOf("admin_content");
const adminsOnly = needs(PERMISSIONS.MANAGE_ADMINS), revenueOnly = needs(PERMISSIONS.MANAGE_REVENUE);
check(`bản đồ có trang cần MANAGE_ADMINS (${adminsOnly.length}) và MANAGE_REVENUE (${revenueOnly.length}) để ca dưới có nghĩa`, adminsOnly.length > 0 && revenueOnly.length > 0, { adminsOnly, revenueOnly });
check("admin_content KHÔNG thấy trang cần MANAGE_ADMINS (Quản trị viên, Nhật ký)", adminsOnly.every(h => !content.includes(h)), adminsOnly.filter(h => content.includes(h)));
check("admin_content KHÔNG thấy Gói KiN Pro, Triển khai và hạn mức, Lịch sử nạp Coin (MANAGE_REVENUE)", ["/admin/goi-pro", "/admin/trien-khai", ...(COIN_VISIBLE ? ["/admin/topups"] : [])].every(h => !content.includes(h) && revenueOnly.includes(h)), revenueOnly.filter(h => content.includes(h)));
check("admin_content KHÔNG thấy Học sinh (MANAGE_STUDENTS) và Doanh thu (VIEW_REVENUE)", !content.includes("/admin/hoc-sinh") && !content.includes("/admin/doanh-thu"));
check("admin_content vẫn thấy Hàng chờ, Gia sư, Lớp, Lịch sử đánh giá, Đề thi, Tin tức, Cộng đồng, Hỗ trợ gia sư",
  ["/admin/kiem-duyet", "/admin/gia-su", "/admin/khoa-hoc", "/admin/danh-gia", "/admin/thi-thu", "/admin/tin-tuc", "/admin/cong-dong", "/admin/ho-tro"].every(h => content.includes(h)));
check("module không còn trang con nào thì ẩn cả module (không có trường hợp này với admin_content: Con người còn Gia sư)", visibleModules("admin_content", FE).some(m => m.key === "con-nguoi") && visibleModules("admin_content", FE).find(m => m.key === "con-nguoi")!.subs.length === 1);
check("mọi trang admin_content thấy đều đúng quyền của vai đó (không lọt trang ngoài quyền)", allSubs.filter(s => content.includes(s.href)).every(s => !s.permission || checkPermission("admin_content", s.permission)));
check("Hôm nay chỉ có MỘT đường vào: không vai nào có /admin trong menu (logo dẫn /admin ở vỏ); mọi vai quản lý vẫn thấy Hàng chờ", !hrefsOf("admin_super").includes("/admin") && !hrefsOf("admin_content").includes("/admin") && hrefsOf("admin_super").includes("/admin/kiem-duyet") && hrefsOf("admin_content").includes("/admin/kiem-duyet"));

section("Chưa biết vai");
check("null / undefined → chỉ trang không đòi quyền (chỉ Hàng chờ)", JSON.stringify(hrefsOf(null)) === JSON.stringify(["/admin/kiem-duyet"]) && JSON.stringify(hrefsOf(undefined)) === JSON.stringify(["/admin/kiem-duyet"]), hrefsOf(null));

section("Khớp đường dẫn");
const at = (p: string) => matchSub(p);
check("/admin chỉ khớp đúng /admin (Hôm nay, module Việc chờ); /admin/khong-co không khớp", at("/admin")?.sub.label === "Hôm nay" && at("/admin")?.moduleKey === "viec-cho" && at("/admin/khong-co") === null);
check("khớp dài nhất thắng: /admin/khoa-hoc/danh-muc → Danh mục lớp; /admin/khoa-hoc/abc/diem-danh → Lớp; /admin/thi-thu/ngan-hang-cau-hoi/cau-hoi → Ngân hàng câu hỏi",
  at("/admin/khoa-hoc/danh-muc")?.sub.label === "Danh mục lớp" && at("/admin/khoa-hoc/abc/diem-danh")?.sub.label === "Lớp" && at("/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi")?.sub.label === "Ngân hàng câu hỏi");
check("không khớp nhầm tiền tố chữ: /admin/khoa-hocxyz không phải Lớp", at("/admin/khoa-hocxyz") === null);
check(COIN_VISIBLE ? "/admin/topups thuộc Vận hành · Lịch sử nạp Coin; /admin/nhat-ky thuộc Vận hành · Nhật ký" : "Coin ẩn: /admin/topups KHÔNG còn trong menu; /admin/nhat-ky thuộc Vận hành · Nhật ký", (COIN_VISIBLE ? at("/admin/topups")?.sub.label === "Lịch sử nạp Coin" && at("/admin/topups")?.moduleKey === "van-hanh" : at("/admin/topups") === null) && at("/admin/nhat-ky")?.moduleKey === "van-hanh");
check("/admin/danh-gia thuộc Học vụ · Lịch sử đánh giá (còn lịch sử + xoá)", at("/admin/danh-gia")?.moduleKey === "hoc-vu" && at("/admin/danh-gia")?.sub.label === "Lịch sử đánh giá");

section("LOI-01 — các phần đang ẩn (không cờ nào)");
const hidden = ["/admin/tin-tuc", "/admin/thu-vien-video", "/admin/cong-dong", "/admin/vinh-danh", "/admin/diem-chuan", "/admin/diem-chuan/cong-thuc"];
for (const role of ["admin_super", "admin_content"] as const) {
  const hs = visibleModules(role, {}).flatMap(m => m.subs.map(x => x.href));
  // DG (14/11/2026): ĐỔI CÓ CHỦ ĐÍCH — "Chữ trang chủ" nay cũng ẩn (cờ VAN_HANH_PHU), cùng Doanh thu, Gói KiN Pro (KINH_DOANH), Phễu gia sư, Số đo, Lịch sử đánh giá.
  const dgHidden = ["/admin/trang-chu", "/admin/doanh-thu", "/admin/goi-pro", "/admin/pheu", "/admin/so-do", "/admin/danh-gia"];
  check(`${role}: không thấy trang của phần ẩn (kể cả 6 trang DG); vẫn thấy Hàng chờ, Lớp, Đề thi`, [...hidden, ...dgHidden].every(h => !hs.includes(h)) && ["/admin/kiem-duyet", "/admin/khoa-hoc", "/admin/thi-thu"].every(h => hs.includes(h)), hs);
}

done();
