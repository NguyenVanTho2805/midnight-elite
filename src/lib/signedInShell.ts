// Người đã đăng nhập, đang ở trang nào thì có THANH BÊN (vỏ KiN)? Thuần để test. Dùng ở khung của các trang khách (src/components/shell/GuestChrome.tsx):
// trang khách như /thu-vien, /khoa-hoc, /giang-vien… nằm ngoài nhóm trang có vỏ, nên trước đây học viên bấm "Thư viện" trên thanh bên là thanh bên biến mất,
// đổi sang thanh trên + chân trang của khách.
//
// Quyết định (sửa 15/10/2026, Thọ: "đã vào vai trò rồi thì chỉ xuất hiện dashboard kiểu left sidebar"): MỌI người đã đăng nhập đều có vỏ ở trang khách.
//   - học viên → vỏ học viên; gia sư → vỏ gia sư;
//   - quản trị cấp 1 / cấp nội dung → vỏ HỌC VIÊN (chế độ xem thử): AuthGuard vốn đã cho họ vào /student/* để xem như học viên, nên bấm "Thi thử", "Thư viện",
//     "Hỏi đáp"… từ đó mà rơi ra khung khách (thanh trên + chân trang) là lỗi. Vỏ quản trị thật vẫn chỉ ở tên miền quản trị (admin.midnightelite-edu.com),
//     tên miền đó không phục vụ trang khách nào.
// Các trang xác thực không có vỏ dù đã đăng nhập (người dùng chỉ ghé qua rồi bị đưa đi chỗ khác).
export const NO_SHELL_PATHS = ["/dang-nhap", "/dang-ky", "/quen-mat-khau", "/dat-lai-mat-khau", "/xac-thuc-email", "/xac-nhan-phu-huynh"] as const;

// BU-00 bước 5 (31/10/2026): "tutor-pending" = gia sư CHỜ DUYỆT (role student + đơn đang chờ, cờ `tutorPending` do /api/auth/me tính) → vỏ gia sư dạng
// chờ duyệt (3 mục) thay vì vỏ học sinh. Quản trị cấp 1 / nội dung vẫn là "student" (vỏ học sinh có băng "Đang xem thử" — StudentShell tự nhận theo role).
export type ShellKind = "student" | "tutor" | "tutor-pending";
const SHELL_KINDS: readonly ShellKind[] = ["student", "tutor", "tutor-pending"];

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + "/");

export interface ShellUser { role: string | null; adminRole?: string | null; tutorPending?: boolean }

export function shellFor(user: ShellUser | null, pathname: string): ShellKind | null {
  if (!user) return null;
  if (NO_SHELL_PATHS.some(p => under(pathname, p))) return null;
  if (user.role === "student") return user.tutorPending ? "tutor-pending" : "student";
  if (user.role === "admin") return user.adminRole === "teacher" ? "tutor" : "student";
  return null;
}

// ─── GỢI Ý VỎ (không nháy khung khách khi tải cứng) ───────────────────────────────────────────────────────────────────────────────────────────
// Quyết định vỏ ở máy khách sau khi /api/auth/me trả lời (xem GuestChrome), nên lần tải cứng đầu tiên một người đã đăng nhập thấy khung khách một thoáng
// (thanh trên + chân trang như trang chủ) rồi mới đổi sang vỏ. Cách chữa giống thanh bên thu/mở (src/lib/railState.ts): nhớ "lần trước máy này đăng nhập
// kiểu gì" trong localStorage, và một dòng chạy TRƯỚC khi vẽ trang đặt data-kin-vo lên <html>; CSS (kin-tokens.css) ẩn khung khách khi có thuộc tính đó.
// Gợi ý chỉ để ẨN khung khách trong lúc chờ — vỏ thật vẫn do shellFor quyết sau khi biết người dùng; gợi ý cũ (đã đăng xuất ở máy khác, phiên hết hạn)
// bị xoá ngay khi /api/auth/me trả lời "không ai".
export const SHELL_HINT_KEY = "kin.vo";
export const SHELL_HINT_ATTR = "data-kin-vo";

/** Giá trị lạ (bản cũ, tay ghi) → null = không gợi ý, khung khách hiện như thường. */
export const parseShellHint = (v: unknown): ShellKind | null => (typeof v === "string" && (SHELL_KINDS as readonly string[]).includes(v) ? (v as ShellKind) : null);

/** Vỏ của người này ở một trang khách thường (không phải trang xác thực) — chính là thứ cần nhớ làm gợi ý. */
export const shellHintFor = (user: ShellUser | null): ShellKind | null => shellFor(user, "/");

/** Chạy TRƯỚC khi trình duyệt vẽ trang (chèn ở layout gốc). Một dòng, không chứa "</script", không ném lỗi khi localStorage bị chặn. */
export const SHELL_INIT_SCRIPT = `try{var v=localStorage.getItem(${JSON.stringify(SHELL_HINT_KEY)});if(${JSON.stringify(SHELL_KINDS)}.indexOf(v)>=0)document.documentElement.setAttribute(${JSON.stringify(SHELL_HINT_ATTR)},v)}catch(e){}`;
