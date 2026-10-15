// Người đã đăng nhập, đang ở trang nào thì có THANH BÊN (vỏ KiN)? Thuần để test. Dùng ở khung của các trang khách (src/components/shell/GuestChrome.tsx):
// trang khách như /thu-vien, /khoa-hoc, /giang-vien… nằm ngoài nhóm trang có vỏ, nên trước đây học viên bấm "Thư viện" trên thanh bên là thanh bên biến mất,
// đổi sang thanh trên + chân trang của khách.
//
// Quyết định: chỉ học viên và gia sư có vỏ ở trang khách. Quản trị có vỏ riêng trên tên miền quản trị (admin.midnightelite-edu.com) — trên tên miền
// chính họ không có trang nào cần vỏ. Các trang xác thực không có vỏ dù đã đăng nhập (người dùng chỉ ghé qua rồi bị đưa đi chỗ khác).
export const NO_SHELL_PATHS = ["/dang-nhap", "/dang-ky", "/quen-mat-khau", "/dat-lai-mat-khau", "/xac-thuc-email", "/xac-nhan-phu-huynh"] as const;

export type ShellKind = "student" | "tutor";

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + "/");

export function shellFor(user: { role: string | null; adminRole?: string | null } | null, pathname: string): ShellKind | null {
  if (!user) return null;
  if (NO_SHELL_PATHS.some(p => under(pathname, p))) return null;
  if (user.role === "student") return "student";
  if (user.role === "admin" && user.adminRole === "teacher") return "tutor";
  return null;
}
