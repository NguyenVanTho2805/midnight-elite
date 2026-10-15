// Đăng nhập xong thì đi đâu (khi người dùng KHÔNG đang định vào một trang cụ thể — nếu có ?redirect= thì luôn ưu tiên trang đó).
//   Học sinh : "Việc của tôi"
//   Gia sư   : Hộp việc ở /lop-cua-toi (nhà của gia sư, Figma "Vỏ — Gia sư"). Gia sư cũng là role "admin" (adminRole "teacher") nên
//              trước đây bị đưa nhầm vào bảng quản trị /admin.
//   Quản trị : /admin
export function landingPath(role: string, adminRole?: string | null): string {
  if (role === "admin") return adminRole === "teacher" ? "/lop-cua-toi" : "/admin";
  return "/student/viec-cua-toi";
}
