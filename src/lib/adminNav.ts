// Điều hướng của vỏ quản trị (Figma "Vỏ — Quản trị" 11:287): thanh module bên trái, mỗi module có các trang con hiện thành dải tab phía trên nội dung.
// PHẦN THUẦN, không đụng React: gom MỌI trang quản trị cũ vào bốn module, giữ nguyên quyền từng trang (cùng bảng quyền với thanh bên cũ, có test đối chiếu).
// Quy tắc: trang không đủ quyền thì KHÔNG hiện lối vào; module không còn trang con nào thì ẩn cả module.
import { checkPermission, PERMISSIONS, type AdminRole, type Permission } from "@/lib/permissions";

export interface AdminSub { label: string; href: string; permission?: Permission }
export interface AdminModuleDef { key: string; label: string; icon: string; subs: AdminSub[] }
export interface AdminModuleView { key: string; label: string; icon: string; href: string; subs: AdminSub[] }

export const ADMIN_MODULES: AdminModuleDef[] = [
  {
    key: "kiem-duyet", label: "Kiểm duyệt", icon: "kiem-duyet",
    subs: [
      { label: "Hàng chờ", href: "/admin/kiem-duyet" },
      { label: "Duyệt gia sư", href: "/admin/ho-so-gia-su", permission: PERMISSIONS.MANAGE_TUTORS },
      { label: "Bài viết cộng đồng", href: "/admin/cong-dong", permission: PERMISSIONS.MANAGE_COMMUNITY },
      { label: "Báo cáo trả lời", href: "/admin/cong-dong/bao-cao", permission: PERMISSIONS.MANAGE_COMMUNITY },
      { label: "Đánh giá khoá học", href: "/admin/danh-gia", permission: PERMISSIONS.MANAGE_COURSES },
      // QT-02 (24/10/2026): trang ĐỌC nhật ký kiểm toán; chỉ quản trị cấp 1 (MANAGE_ADMINS), vì nhật ký ghi việc đổi vai, đồng ý, tiền.
      { label: "Nhật ký", href: "/admin/nhat-ky", permission: PERMISSIONS.MANAGE_ADMINS },
    ],
  },
  {
    key: "nguoi-dung", label: "Người dùng", icon: "nguoi",
    subs: [
      { label: "Hồ sơ học sinh", href: "/admin/hoc-sinh", permission: PERMISSIONS.MANAGE_STUDENTS },
      { label: "Quản trị viên", href: "/admin/quan-tri-vien", permission: PERMISSIONS.MANAGE_ADMINS },
    ],
  },
  {
    key: "noi-dung", label: "Nội dung", icon: "lop",
    subs: [
      { label: "Khoá học", href: "/admin/khoa-hoc", permission: PERMISSIONS.MANAGE_COURSES },
      { label: "Danh mục", href: "/admin/khoa-hoc/danh-muc", permission: PERMISSIONS.MANAGE_COURSES },
      { label: "Đề thi", href: "/admin/thi-thu", permission: PERMISSIONS.MANAGE_CURRICULUM },
      { label: "Ngân hàng câu hỏi", href: "/admin/thi-thu/ngan-hang-cau-hoi", permission: PERMISSIONS.MANAGE_CURRICULUM },
      { label: "Ngân hàng đề", href: "/admin/thi-thu/ngan-hang-de-thi", permission: PERMISSIONS.MANAGE_CURRICULUM },
      { label: "Tin tức & Blog", href: "/admin/tin-tuc", permission: PERMISSIONS.MANAGE_NEWS },
      { label: "Điểm chuẩn", href: "/admin/diem-chuan", permission: PERMISSIONS.MANAGE_NEWS },
      { label: "Bảng vinh danh", href: "/admin/vinh-danh", permission: PERMISSIONS.MANAGE_HONOR },
    ],
  },
  {
    key: "bao-cao", label: "Báo cáo", icon: "bao-cao",
    subs: [
      { label: "Tổng quan", href: "/admin" },
      { label: "Doanh thu", href: "/admin/doanh-thu", permission: PERMISSIONS.VIEW_REVENUE },
      { label: "Phễu gia sư", href: "/admin/pheu", permission: PERMISSIONS.MANAGE_TUTORS },
      { label: "Số đo sản phẩm", href: "/admin/so-do", permission: PERMISSIONS.MANAGE_TUTORS },
    ],
  },
  {
    key: "cai-dat", label: "Cài đặt", icon: "cai-dat",
    subs: [
      { label: "Gói KiN Pro", href: "/admin/goi-pro", permission: PERMISSIONS.MANAGE_REVENUE },
      { label: "Hỗ trợ gia sư", href: "/admin/ho-tro", permission: PERMISSIONS.MANAGE_TUTORS },
      // QT-03 (24/10/2026): màn xem cờ triển khai + hạn mức (chỉ đọc), cùng quyền với Gói KiN Pro.
      { label: "Triển khai và hạn mức", href: "/admin/trien-khai", permission: PERMISSIONS.MANAGE_REVENUE },
      // QT-06 (24/10/2026): lối vào duyệt nạp Coin (trang đã có từ FE-128, trước đây không có trong menu). Chỉ quản trị cấp 1, như API duyệt.
      { label: "Duyệt nạp Coin", href: "/admin/topups", permission: PERMISSIONS.MANAGE_REVENUE },
    ],
  },
];

const allowed = (role: AdminRole | undefined | null, s: AdminSub) => !s.permission || checkPermission(role, s.permission);

/** Các module người này thấy, mỗi module kèm các trang con được phép và đường dẫn vào (trang con đầu tiên). */
export function visibleModules(role: AdminRole | undefined | null): AdminModuleView[] {
  const out: AdminModuleView[] = [];
  for (const m of ADMIN_MODULES) {
    const subs = m.subs.filter(s => allowed(role, s));
    if (subs.length) out.push({ key: m.key, label: m.label, icon: m.icon, href: subs[0].href, subs });
  }
  return out;
}

/** Trang con khớp đường dẫn nhất (khớp dài nhất thắng; "/admin" chỉ khớp đúng "/admin"). Cả những trang không đủ quyền cũng được tính để biết đang ở module nào. */
export function matchSub(pathname: string): { moduleKey: string; sub: AdminSub } | null {
  let best: { moduleKey: string; sub: AdminSub } | null = null;
  for (const m of ADMIN_MODULES) {
    for (const s of m.subs) {
      const hit = s.href === "/admin" ? pathname === "/admin" : pathname === s.href || pathname.startsWith(s.href + "/");
      if (hit && (!best || s.href.length > best.sub.href.length)) best = { moduleKey: m.key, sub: s };
    }
  }
  return best;
}
