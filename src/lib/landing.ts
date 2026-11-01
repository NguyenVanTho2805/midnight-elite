// Đăng nhập xong thì đi đâu (khi người dùng KHÔNG đang định vào một trang cụ thể — nếu có ?redirect= thì luôn ưu tiên trang đó).
//   Học sinh : "Việc của tôi"
//   Gia sư   : Hộp việc ở /lop-cua-toi (nhà của gia sư, Figma "Vỏ — Gia sư"). Gia sư cũng là role "admin" (adminRole "teacher") nên
//              trước đây bị đưa nhầm vào bảng quản trị /admin.
//   Gia sư CHỜ DUYỆT (BU-00 bước 5, 31/10/2026): vẫn là role "student" (không cột mới, không đổi JWT) nhưng có đơn đang chờ / bị từ chối → trang chờ duyệt
//              /lop-cua-toi/cho-duyet trong vỏ gia sư, không rơi vào khu học sinh. `tutorPending` do API tính (src/lib/tutorProfile.ts tutorApplicationStatus);
//              nơi không biết (proxy chỉ có cookie) bỏ trống → về Việc của tôi rồi AuthGuard đẩy sang trang chờ duyệt.
//   Quản trị : /admin
export function landingPath(role: string, adminRole?: string | null, tutorPending?: boolean): string {
  if (role === "admin") return adminRole === "teacher" ? "/lop-cua-toi" : "/admin";
  if (role === "student" && tutorPending) return "/lop-cua-toi/cho-duyet";
  return "/student/viec-cua-toi";
}
