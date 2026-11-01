// Điều hướng của vỏ quản trị (Figma "Vỏ — Quản trị" 606:7): BỐN module theo HIEN-CO-VA-DINH-VI §4.3 — Việc chờ · Con người · Học vụ · Vận hành.
// PHẦN THUẦN, không đụng React: gom MỌI trang quản trị vào bốn module, giữ nguyên quyền từng trang (có test đối chiếu).
// Quy tắc: trang không đủ quyền thì KHÔNG hiện lối vào; module không còn trang con nào thì ẩn cả module.
// `group` (BU-08): nhóm con trong module. Vỏ chỉ hiện dải tab của NHÓM đang ở (≤ 6 tab) và đặt tên nhóm làm tiêu đề phụ ở thanh bên rộng.
import { checkPermission, PERMISSIONS, type AdminRole, type Permission } from "@/lib/permissions";

export interface AdminSub { label: string; href: string; permission?: Permission; group?: string }
export interface AdminModuleDef { key: string; label: string; icon: string; subs: AdminSub[] }
export interface AdminModuleView { key: string; label: string; icon: string; href: string; subs: AdminSub[] }

export const ADMIN_MODULES: AdminModuleDef[] = [
  {
    // Một hàng chờ duy nhất (gia sư, bài viết, hồ sơ, trả lời, đánh giá khoá, nạp Coin, …). Badge của vỏ nằm ở module này.
    key: "viec-cho", label: "Việc chờ", icon: "kiem-duyet",
    subs: [
      { label: "Hàng chờ", href: "/admin/kiem-duyet" },
    ],
  },
  {
    key: "con-nguoi", label: "Con người", icon: "nguoi",
    subs: [
      // Chỉ ĐỌC lịch sử đơn gia sư; việc duyệt nằm ở Hàng chờ (BU-08).
      { label: "Gia sư", href: "/admin/gia-su", permission: PERMISSIONS.MANAGE_TUTORS },
      { label: "Học sinh", href: "/admin/hoc-sinh", permission: PERMISSIONS.MANAGE_STUDENTS },
      { label: "Quản trị viên", href: "/admin/quan-tri-vien", permission: PERMISSIONS.MANAGE_ADMINS },
    ],
  },
  {
    key: "hoc-vu", label: "Học vụ", icon: "lop",
    subs: [
      { label: "Lớp", href: "/admin/khoa-hoc", permission: PERMISSIONS.MANAGE_COURSES, group: "Lớp" },
      { label: "Danh mục", href: "/admin/khoa-hoc/danh-muc", permission: PERMISSIONS.MANAGE_COURSES, group: "Lớp" },
      { label: "Đánh giá khoá học", href: "/admin/danh-gia", permission: PERMISSIONS.MANAGE_COURSES, group: "Lớp" },
      { label: "Đề thi", href: "/admin/thi-thu", permission: PERMISSIONS.MANAGE_CURRICULUM, group: "Đề và ngân hàng" },
      { label: "Ngân hàng câu hỏi", href: "/admin/thi-thu/ngan-hang-cau-hoi", permission: PERMISSIONS.MANAGE_CURRICULUM, group: "Đề và ngân hàng" },
      { label: "Ngân hàng đề", href: "/admin/thi-thu/ngan-hang-de-thi", permission: PERMISSIONS.MANAGE_CURRICULUM, group: "Đề và ngân hàng" },
      { label: "Tin tức & Blog", href: "/admin/tin-tuc", permission: PERMISSIONS.MANAGE_NEWS, group: "Truyền thông" },
      // NC2-046: video YouTube do quản trị chọn, hiện ở ô tìm của trang Thư viện.
      { label: "Video tham khảo", href: "/admin/thu-vien-video", permission: PERMISSIONS.MANAGE_NEWS, group: "Truyền thông" },
      { label: "Cộng đồng", href: "/admin/cong-dong", permission: PERMISSIONS.MANAGE_COMMUNITY, group: "Truyền thông" },
      { label: "Bảng vinh danh", href: "/admin/vinh-danh", permission: PERMISSIONS.MANAGE_HONOR, group: "Truyền thông" },
      { label: "Điểm chuẩn", href: "/admin/diem-chuan", permission: PERMISSIONS.MANAGE_NEWS, group: "Tuyển sinh" },
      // NC2-050: công thức tính điểm xét tuyển (công cụ "Tính điểm" ở trang công khai /diem-chuan).
      { label: "Công thức tính điểm", href: "/admin/diem-chuan/cong-thuc", permission: PERMISSIONS.MANAGE_NEWS, group: "Tuyển sinh" },
    ],
  },
  {
    key: "van-hanh", label: "Vận hành", icon: "bao-cao",
    subs: [
      { label: "Hôm nay", href: "/admin", group: "Theo dõi" },
      { label: "Doanh thu", href: "/admin/doanh-thu", permission: PERMISSIONS.VIEW_REVENUE, group: "Theo dõi" },
      { label: "Phễu gia sư", href: "/admin/pheu", permission: PERMISSIONS.MANAGE_TUTORS, group: "Theo dõi" },
      { label: "Số đo sản phẩm", href: "/admin/so-do", permission: PERMISSIONS.MANAGE_TUTORS, group: "Theo dõi" },
      // QT-02: trang ĐỌC nhật ký kiểm toán; chỉ quản trị cấp 1 (MANAGE_ADMINS), vì nhật ký ghi việc đổi vai, đồng ý, tiền.
      { label: "Nhật ký", href: "/admin/nhat-ky", permission: PERMISSIONS.MANAGE_ADMINS, group: "Hệ thống" },
      // QT-03: màn xem cờ triển khai + hạn mức (chỉ đọc), cùng quyền với Gói KiN Pro.
      { label: "Triển khai và hạn mức", href: "/admin/trien-khai", permission: PERMISSIONS.MANAGE_REVENUE, group: "Hệ thống" },
      { label: "Gói KiN Pro", href: "/admin/goi-pro", permission: PERMISSIONS.MANAGE_REVENUE, group: "Hệ thống" },
      // Lịch sử nạp Coin chỉ ĐỌC (việc chờ duyệt nằm ở Hàng chờ). Chỉ quản trị cấp 1, như API duyệt.
      { label: "Lịch sử nạp Coin", href: "/admin/topups", permission: PERMISSIONS.MANAGE_REVENUE, group: "Hệ thống" },
      { label: "Hỗ trợ gia sư", href: "/admin/ho-tro", permission: PERMISSIONS.MANAGE_TUTORS, group: "Hệ thống" },
    ],
  },
];

const allowed = (role: AdminRole | undefined | null, s: AdminSub) => !s.permission || checkPermission(role, s.permission);

/**
 * Các module người này thấy, mỗi module kèm các trang con được phép và đường dẫn vào (trang con đầu tiên được phép).
 * BU-00 (31/10/2026): GIA SƯ (`teacher`) không còn dùng vỏ quản trị → trả RỖNG. Quyền API của gia sư (MANAGE_COURSES / MANAGE_CURRICULUM
 * trong permissions.ts) giữ nguyên — chỉ bỏ lối vào trên thanh quản trị.
 */
export function visibleModules(role: AdminRole | undefined | null): AdminModuleView[] {
  if (role === "teacher") return [];
  const out: AdminModuleView[] = [];
  for (const m of ADMIN_MODULES) {
    const subs = m.subs.filter(s => allowed(role, s));
    if (subs.length) out.push({ key: m.key, label: m.label, icon: m.icon, href: subs[0].href, subs });
  }
  return out;
}

/** Chia các trang con thành nhóm theo thứ tự xuất hiện; trang không có `group` gộp vào một nhóm không tên (`group: null`). */
export function groupSubs(subs: AdminSub[]): { group: string | null; subs: AdminSub[] }[] {
  const out: { group: string | null; subs: AdminSub[] }[] = [];
  for (const s of subs) {
    const g = s.group ?? null;
    const slot = out.find(o => o.group === g);
    if (slot) slot.subs.push(s); else out.push({ group: g, subs: [s] });
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
